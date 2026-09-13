import { prisma } from "@/db";
import type { Prisma, InvoiceKind } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";
import { journalRepository } from "@/modules/accounting/repositories/journal.repository";
import { postPaymentReceived, postPaymentMade } from "@/modules/accounting/postings";
import {
  autoAllocate,
  assertAllocationsValid,
  statusForPaid,
  type Allocation,
  type AllocatableInvoice,
} from "../allocation";

export interface RecordPaymentParams {
  businessId: string;
  createdById: string;
  partyId: string;
  kind: InvoiceKind;
  amountMinor: bigint;
  paymentDate: Date;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
  /**
   * Explicit allocations. When omitted, the payment is spread across open
   * invoices oldest first; pass an empty array to hold it entirely on account.
   */
  allocations?: Allocation[];
}

const PAYMENT_INCLUDE = {
  allocations: { include: { invoice: { select: { id: true, number: true, totalMinor: true } } } },
  party: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  reversedBy: { select: { id: true, name: true } },
} satisfies Prisma.PaymentInclude;

/**
 * Recalculates an invoice from its allocations.
 *
 * paidMinor and status are both derived from the allocation rows rather than
 * adjusted incrementally, so they cannot drift away from the payments that
 * justify them.
 */
async function refreshInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { id: true, totalMinor: true, status: true },
  });

  const applied = await tx.paymentAllocation.aggregate({
    where: { invoiceId },
    _sum: { amountMinor: true },
  });

  const paidMinor = applied._sum.amountMinor ?? 0n;

  return tx.invoice.update({
    where: { id: invoiceId },
    data: {
      paidMinor,
      status: statusForPaid(invoice.totalMinor, paidMinor, invoice.status),
    },
  });
}

/** Open invoices for a counterparty, in the shape the allocation rules expect. */
async function openInvoicesFor(
  tx: Prisma.TransactionClient,
  businessId: string,
  partyId: string,
  kind: InvoiceKind
): Promise<AllocatableInvoice[]> {
  const invoices = await tx.invoice.findMany({
    where: {
      businessId,
      partyId,
      kind,
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
    },
    select: {
      id: true,
      totalMinor: true,
      paidMinor: true,
      status: true,
      issueDate: true,
      dueDate: true,
    },
    orderBy: { issueDate: "asc" },
  });

  return invoices;
}

export const paymentRepository = {
  /**
   * Records money received or paid, posts it, and applies it to invoices.
   *
   * The posting and the allocations commit together with the payment: a
   * payment that reached the books but settled no invoice would leave every
   * invoice looking unpaid while the balance said otherwise.
   */
  async record(params: RecordPaymentParams) {
    if (params.amountMinor <= 0n) {
      throw new AppError("A payment must be for more than zero.", 400);
    }

    return prisma.$transaction(async (tx) => {
      const party = await tx.party.findFirst({
        where: { id: params.partyId, businessId: params.businessId },
        select: { id: true },
      });
      if (!party) throw new AppError("Party not found", 404);

      const open = await openInvoicesFor(
        tx,
        params.businessId,
        params.partyId,
        params.kind
      );

      let allocations: Allocation[];
      if (params.allocations === undefined) {
        allocations = autoAllocate(params.amountMinor, open).allocations;
      } else {
        allocations = params.allocations;
        assertAllocationsValid(
          params.amountMinor,
          allocations,
          new Map(open.map((i) => [i.id, i]))
        );
      }

      const entry = await journalRepository.post(
        {
          businessId: params.businessId,
          createdById: params.createdById,
          entryDate: params.paymentDate,
          sourceType: "PAYMENT",
          narration:
            params.reference ??
            (params.kind === "SALES" ? "Payment received" : "Payment made"),
          lines:
            params.kind === "SALES"
              ? postPaymentReceived(params.partyId, params.amountMinor)
              : postPaymentMade(params.partyId, params.amountMinor),
        },
        tx
      );

      const payment = await tx.payment.create({
        data: {
          businessId: params.businessId,
          partyId: params.partyId,
          kind: params.kind,
          amountMinor: params.amountMinor,
          paymentDate: params.paymentDate,
          method: params.method ?? null,
          reference: params.reference ?? null,
          notes: params.notes ?? null,
          journalEntryId: entry.id,
          createdById: params.createdById,
          allocations: {
            create: allocations.map((allocation) => ({
              invoiceId: allocation.invoiceId,
              amountMinor: allocation.amountMinor,
            })),
          },
        },
        include: PAYMENT_INCLUDE,
      });

      // Point the entry at the payment now that it exists.
      await tx.journalEntry.update({
        where: { id: entry.id },
        data: { sourceId: payment.id },
      });

      for (const allocation of allocations) {
        await refreshInvoice(tx, allocation.invoiceId);
      }

      return payment;
    });
  },

  /**
   * Replaces how an existing payment is split across invoices.
   *
   * The amount and its posting do not change - only which documents it settles
   * - so nothing needs to be reversed in the journal.
   */
  async reallocate(
    paymentId: string,
    businessId: string,
    allocations: Allocation[]
  ) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, businessId },
        include: { allocations: true },
      });
      if (!payment) throw new AppError("Payment not found", 404);
      // Reversal empties the allocations, which would otherwise leave this
      // method free to re-apply money that is no longer in the books.
      if (payment.reversedAt) {
        throw new AppError(
          "This payment has been reversed, so it cannot be allocated.",
          409
        );
      }

      const touched = new Set(payment.allocations.map((a) => a.invoiceId));
      allocations.forEach((a) => touched.add(a.invoiceId));

      // Clear first, so validation sees outstanding amounts without this
      // payment's own contribution counted against them.
      await tx.paymentAllocation.deleteMany({ where: { paymentId } });
      for (const invoiceId of touched) {
        await refreshInvoice(tx, invoiceId);
      }

      const candidates = await tx.invoice.findMany({
        where: { businessId, id: { in: [...touched] } },
        select: {
          id: true,
          totalMinor: true,
          paidMinor: true,
          status: true,
          issueDate: true,
          dueDate: true,
        },
      });

      assertAllocationsValid(
        payment.amountMinor,
        allocations,
        new Map(candidates.map((i) => [i.id, i]))
      );

      for (const allocation of allocations) {
        await tx.paymentAllocation.create({
          data: {
            paymentId,
            invoiceId: allocation.invoiceId,
            amountMinor: allocation.amountMinor,
          },
        });
      }

      for (const invoiceId of touched) {
        await refreshInvoice(tx, invoiceId);
      }

      return tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: PAYMENT_INCLUDE,
      });
    });
  },

  /**
   * Reverses a payment out of the books.
   *
   * The payment row and its journal entry are both kept; an opposing entry is
   * posted instead, so the history of what was recorded and then undone
   * survives. Because reversal deletes the allocations, the row is also marked
   * with reversedAt and the reversing entry - otherwise a reversed payment
   * would be indistinguishable from one deliberately held on account.
   *
   * Everything here runs in one transaction, the reversing entry included: the
   * posting and the allocation cleanup it justifies must not be able to land
   * separately, or an invoice would go on reading as paid with the money
   * already reversed out of the books.
   */
  async reverse(paymentId: string, businessId: string, actorUserId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, businessId },
        include: { allocations: true },
      });
      if (!payment) throw new AppError("Payment not found", 404);
      if (!payment.journalEntryId) {
        throw new AppError("This payment was never posted.", 409);
      }
      // Advisory only. The real guard is the unique constraint on
      // reversalEntryId below, which two concurrent callers cannot both pass.
      if (payment.reversedAt) {
        throw new AppError("This payment has already been reversed.", 409);
      }

      const invoiceIds = payment.allocations.map((a) => a.invoiceId);

      const reversalEntry = await journalRepository.reverse(
        payment.journalEntryId,
        businessId,
        actorUserId,
        reason ? `Payment reversed: ${reason}` : "Payment reversed",
        tx
      );

      await tx.paymentAllocation.deleteMany({ where: { paymentId } });
      for (const invoiceId of invoiceIds) {
        await refreshInvoice(tx, invoiceId);
      }

      const reversed = await tx.payment
        .update({
          where: { id: paymentId },
          data: {
            reversedAt: new Date(),
            reversedById: actorUserId,
            reversalReason: reason ?? null,
            reversalEntryId: reversalEntry.id,
          },
          include: PAYMENT_INCLUDE,
        })
        .catch((err: unknown) => {
          if (
            typeof err === "object" &&
            err !== null &&
            (err as { code?: string }).code === "P2002"
          ) {
            throw new AppError("This payment has already been reversed.", 409);
          }
          throw err;
        });

      return {
        paymentId,
        reversed: true,
        invoicesUpdated: invoiceIds.length,
        payment: reversed,
      };
    });
  },

  async findMany(
    businessId: string,
    options?: { partyId?: string; kind?: InvoiceKind; limit?: number; offset?: number }
  ) {
    const { partyId, kind, limit = 50, offset = 0 } = options ?? {};
    const where: Prisma.PaymentWhereInput = {
      businessId,
      ...(partyId ? { partyId } : {}),
      ...(kind ? { kind } : {}),
    };

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, totalCount };
  },
};
