import { prisma } from "@/db";
import type { Prisma, InvoiceKind, InvoiceStatus } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";
import { journalRepository } from "@/modules/accounting/repositories/journal.repository";
import { postInvoice, postBill } from "@/modules/accounting/postings";
import { invertLines } from "@/modules/accounting/journal";
import {
  calculateInvoice,
  resolveGstTreatment,
  stateCodeFromGstin,
  type LineInput,
} from "../calculate";
import {
  financialYearOf,
  formatDocumentNumber,
  DEFAULT_PREFIXES,
  DOCUMENT_TYPES,
  type DocumentType,
} from "../numbering";

export interface CreateInvoiceParams {
  businessId: string;
  createdById: string;
  partyId: string;
  kind: InvoiceKind;
  issueDate: Date;
  dueDate?: Date | null;
  placeOfSupply?: string | null;
  isExempt?: boolean;
  roundTotalToUnit?: boolean;
  notes?: string | null;
  terms?: string | null;
  lines: LineInput[];
}

const INVOICE_INCLUDE = {
  lines: { orderBy: { position: "asc" } },
  party: { select: { id: true, name: true, gstin: true, email: true, address: true } },
  createdBy: { select: { id: true, name: true } },
  allocations: true,
} satisfies Prisma.InvoiceInclude;

/**
 * Allocates the next number for a document type and financial year.
 *
 * The increment takes a row lock, so two invoices issued at once cannot receive
 * the same number. Because it runs inside the caller's transaction, a failure
 * after this point releases the number rather than leaving a gap - which GST
 * does not permit.
 */
async function allocateNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  documentType: DocumentType,
  issueDate: Date
): Promise<{ number: string; financialYear: string; sequence: number }> {
  const financialYear = financialYearOf(issueDate);
  const prefix = DEFAULT_PREFIXES[documentType];

  const sequence = await tx.numberSequence.upsert({
    where: {
      businessId_documentType_financialYear: { businessId, documentType, financialYear },
    },
    create: { businessId, documentType, financialYear, prefix, nextValue: 2 },
    update: { nextValue: { increment: 1 } },
    select: { nextValue: true, prefix: true },
  });

  // upsert returns the row after the write, so on create nextValue is already
  // 2 and the number just allocated is 1.
  const allocated = sequence.nextValue - 1;

  return {
    number: formatDocumentNumber(sequence.prefix, financialYear, allocated),
    financialYear,
    sequence: allocated,
  };
}

function documentTypeFor(kind: InvoiceKind): DocumentType {
  return kind === "SALES" ? DOCUMENT_TYPES.SALES_INVOICE : DOCUMENT_TYPES.PURCHASE_BILL;
}

export const invoiceRepository = {
  /**
   * Creates a draft.
   *
   * A draft is not numbered and does not touch the books: an abandoned draft
   * must not consume an invoice number, and must not appear in the ledger.
   */
  async createDraft(params: CreateInvoiceParams) {
    return prisma.$transaction(async (tx) => {
      const [party, business] = await Promise.all([
        tx.party.findFirst({
          where: { id: params.partyId, businessId: params.businessId },
          select: { id: true, gstin: true },
        }),
        tx.business.findUniqueOrThrow({
          where: { id: params.businessId },
          select: { gstin: true },
        }),
      ]);

      if (!party) throw new AppError("Party not found", 404);

      const placeOfSupply =
        params.placeOfSupply ?? stateCodeFromGstin(party.gstin) ?? null;
      const treatment = resolveGstTreatment(
        stateCodeFromGstin(business.gstin),
        placeOfSupply,
        params.isExempt
      );

      const totals = calculateInvoice(params.lines, treatment, {
        roundTotalToUnit: params.roundTotalToUnit,
      });

      return tx.invoice.create({
        data: {
          businessId: params.businessId,
          partyId: params.partyId,
          kind: params.kind,
          status: "DRAFT",
          issueDate: params.issueDate,
          dueDate: params.dueDate ?? null,
          placeOfSupply,
          gstTreatment: treatment,
          subtotalMinor: totals.subtotalMinor,
          discountMinor: totals.discountMinor,
          cgstMinor: totals.cgstMinor,
          sgstMinor: totals.sgstMinor,
          igstMinor: totals.igstMinor,
          roundingMinor: totals.roundingMinor,
          totalMinor: totals.totalMinor,
          notes: params.notes ?? null,
          terms: params.terms ?? null,
          createdById: params.createdById,
          lines: {
            create: params.lines.map((line, index) => {
              const computed = totals.lines[index];
              return {
                position: index,
                itemId: line.itemId ?? null,
                description: line.description,
                hsnSacCode: line.hsnSacCode ?? null,
                quantityMilli: line.quantityMilli,
                unitOfMeasure: line.unitOfMeasure ?? null,
                unitPriceMinor: line.unitPriceMinor,
                discountMinor: computed.discountMinor,
                taxRateBps: computed.taxRateBps,
                lineSubtotalMinor: computed.lineSubtotalMinor,
                cgstMinor: computed.cgstMinor,
                sgstMinor: computed.sgstMinor,
                igstMinor: computed.igstMinor,
                lineTotalMinor: computed.lineTotalMinor,
              };
            }),
          },
        },
        include: INVOICE_INCLUDE,
      });
    });
  },

  /**
   * Issues a draft: allocates its number and posts it to the journal.
   *
   * Numbering and posting commit together, so an invoice can never exist with a
   * number but no entry, or an entry but no number.
   */
  async issue(invoiceId: string, businessId: string, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, businessId },
        include: { lines: true },
      });

      if (!invoice) throw new AppError("Invoice not found", 404);
      if (invoice.status !== "DRAFT") {
        throw new AppError(
          `This invoice is already ${invoice.status.toLowerCase()} and cannot be issued again.`,
          409
        );
      }
      if (invoice.lines.length === 0) {
        throw new AppError("An invoice needs at least one line before it is issued.", 400);
      }

      const { number, financialYear, sequence } = await allocateNumber(
        tx,
        businessId,
        documentTypeFor(invoice.kind),
        invoice.issueDate
      );

      const posting = {
        partyId: invoice.partyId,
        subtotalMinor: invoice.subtotalMinor,
        tax: {
          cgstMinor: invoice.cgstMinor,
          sgstMinor: invoice.sgstMinor,
          igstMinor: invoice.igstMinor,
        },
        totalMinor: invoice.totalMinor,
      };

      const entry = await journalRepository.post(
        {
          businessId,
          createdById: actorUserId,
          entryDate: invoice.issueDate,
          sourceType: invoice.kind === "SALES" ? "INVOICE" : "BILL",
          sourceId: invoice.id,
          narration: `${invoice.kind === "SALES" ? "Invoice" : "Bill"} ${number}`,
          lines: invoice.kind === "SALES" ? postInvoice(posting) : postBill(posting),
        },
        tx
      );

      return tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "ISSUED",
          number,
          financialYear,
          sequence,
          journalEntryId: entry.id,
        },
        include: INVOICE_INCLUDE,
      });
    });
  },

  /**
   * Cancels an issued invoice by reversing its posting.
   *
   * The document and its number are kept: removing either would leave a gap in
   * the sequence, which GST does not permit. Nothing is edited or deleted.
   */
  async cancel(invoiceId: string, businessId: string, actorUserId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, businessId },
        include: { lines: true, allocations: true },
      });

      if (!invoice) throw new AppError("Invoice not found", 404);
      if (invoice.status === "CANCELLED") {
        throw new AppError("This invoice is already cancelled.", 409);
      }
      if (invoice.status === "DRAFT") {
        throw new AppError(
          "A draft has not been issued, so there is nothing to cancel. Delete it instead.",
          400
        );
      }
      if (invoice.allocations.length > 0) {
        throw new AppError(
          "Payments are allocated to this invoice. Remove the allocations before cancelling it.",
          409
        );
      }

      if (invoice.journalEntryId) {
        const original = await tx.journalEntry.findUniqueOrThrow({
          where: { id: invoice.journalEntryId },
          include: { lines: { include: { account: true } } },
        });

        const lines = invertLines(
          original.lines.map((line) => ({
            accountKey: line.account.systemKey!,
            amountMinor: line.amountMinor,
            partyId: line.partyId,
            description: line.description,
          }))
        );

        await journalRepository.post(
          {
            businessId,
            createdById: actorUserId,
            entryDate: new Date(),
            sourceType: "CREDIT_NOTE",
            sourceId: invoice.id,
            narration: reason
              ? `Cancellation of ${invoice.number}: ${reason}`
              : `Cancellation of ${invoice.number}`,
            lines,
          },
          tx
        );
      }

      return tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "CANCELLED" },
        include: INVOICE_INCLUDE,
      });
    });
  },

  /** Deletes a draft. Only ever a draft: an issued document is cancelled. */
  async deleteDraft(invoiceId: string, businessId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
      select: { id: true, status: true },
    });

    if (!invoice) throw new AppError("Invoice not found", 404);
    if (invoice.status !== "DRAFT") {
      throw new AppError(
        "Only a draft can be deleted. Cancel the invoice instead, so the number and its posting are kept.",
        409
      );
    }

    return prisma.invoice.delete({ where: { id: invoice.id } });
  },

  async findById(invoiceId: string, businessId: string) {
    return prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: INVOICE_INCLUDE,
    });
  },

  async findMany(
    businessId: string,
    options?: {
      kind?: InvoiceKind;
      status?: InvoiceStatus;
      partyId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const { kind, status, partyId, search, limit = 50, offset = 0 } = options ?? {};

    const where: Prisma.InvoiceWhereInput = {
      businessId,
      ...(kind ? { kind } : {}),
      ...(status ? { status } : {}),
      ...(partyId ? { partyId } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
              { party: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [invoices, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.invoice.count({ where }),
    ]);

    return { invoices, totalCount };
  },
};
