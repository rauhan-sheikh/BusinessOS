import { invoiceRepository } from "../repositories/invoice.repository";
import { paymentRepository } from "../repositories/payment.repository";
import { itemRepository, type ItemInput } from "../repositories/item.repository";
import { buildAgingReport } from "../reports/aging";
import { auditService } from "@/modules/audit/services/audit.service";
import { PERMISSION, requirePermission, type Actor } from "@/modules/auth/permissions";
import type { InvoiceKind, InvoiceStatus } from "@/generated/prisma/client";
import type { LineInput } from "../calculate";
import type { Allocation } from "../allocation";

type ClientInfo = { ipAddress?: string | null; userAgent?: string | null };

export interface CreateInvoiceInput {
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

export class InvoiceService {
  async listInvoices(
    businessId: string,
    actor: Actor,
    options?: {
      kind?: InvoiceKind;
      status?: InvoiceStatus;
      partyId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    requirePermission(actor, PERMISSION.INVOICE_VIEW);
    return invoiceRepository.findMany(businessId, options);
  }

  async getInvoice(id: string, businessId: string, actor: Actor) {
    requirePermission(actor, PERMISSION.INVOICE_VIEW);
    return invoiceRepository.findById(id, businessId);
  }

  async createDraft(
    businessId: string,
    actor: Actor,
    input: CreateInvoiceInput,
    clientInfo?: ClientInfo
  ) {
    requirePermission(actor, PERMISSION.INVOICE_CREATE);

    const invoice = await invoiceRepository.createDraft({
      businessId,
      createdById: actor.userId,
      ...input,
    });

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "INVOICE_DRAFTED",
      metadata: {
        invoiceId: invoice.id,
        kind: invoice.kind,
        partyId: invoice.partyId,
        totalMinor: invoice.totalMinor.toString(),
      },
      ...clientInfo,
    });

    return invoice;
  }

  /** Allocates the number and posts to the books. */
  async issue(id: string, businessId: string, actor: Actor, clientInfo?: ClientInfo) {
    requirePermission(actor, PERMISSION.INVOICE_ISSUE);

    const invoice = await invoiceRepository.issue(id, businessId, actor.userId);

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "INVOICE_ISSUED",
      metadata: {
        invoiceId: invoice.id,
        number: invoice.number,
        totalMinor: invoice.totalMinor.toString(),
        journalEntryId: invoice.journalEntryId,
      },
      ...clientInfo,
    });

    return invoice;
  }

  async cancel(
    id: string,
    businessId: string,
    actor: Actor,
    reason?: string,
    clientInfo?: ClientInfo
  ) {
    requirePermission(actor, PERMISSION.INVOICE_CANCEL);

    const invoice = await invoiceRepository.cancel(id, businessId, actor.userId, reason);

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "INVOICE_CANCELLED",
      metadata: { invoiceId: invoice.id, number: invoice.number, reason },
      ...clientInfo,
    });

    return invoice;
  }

  async deleteDraft(id: string, businessId: string, actor: Actor, clientInfo?: ClientInfo) {
    // Deleting a draft removes a document, so it is gated with cancelling
    // rather than with creating.
    requirePermission(actor, PERMISSION.INVOICE_CANCEL);

    const deleted = await invoiceRepository.deleteDraft(id, businessId);

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "INVOICE_DRAFT_DELETED",
      metadata: { invoiceId: id },
      ...clientInfo,
    });

    return deleted;
  }

  // ---- payments ----------------------------------------------------------

  async listPayments(
    businessId: string,
    actor: Actor,
    options?: { partyId?: string; kind?: InvoiceKind; limit?: number; offset?: number }
  ) {
    requirePermission(actor, PERMISSION.PAYMENT_VIEW);
    return paymentRepository.findMany(businessId, options);
  }

  async recordPayment(
    businessId: string,
    actor: Actor,
    input: {
      partyId: string;
      kind: InvoiceKind;
      amountMinor: bigint;
      paymentDate: Date;
      method?: string | null;
      reference?: string | null;
      notes?: string | null;
      allocations?: Allocation[];
    },
    clientInfo?: ClientInfo
  ) {
    requirePermission(actor, PERMISSION.PAYMENT_RECORD);

    const payment = await paymentRepository.record({
      businessId,
      createdById: actor.userId,
      ...input,
    });

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "PAYMENT_RECORDED",
      metadata: {
        paymentId: payment.id,
        partyId: payment.partyId,
        amountMinor: payment.amountMinor.toString(),
        allocations: payment.allocations.length,
      },
      ...clientInfo,
    });

    return payment;
  }

  async reallocatePayment(
    paymentId: string,
    businessId: string,
    actor: Actor,
    allocations: Allocation[],
    clientInfo?: ClientInfo
  ) {
    requirePermission(actor, PERMISSION.PAYMENT_RECORD);

    const payment = await paymentRepository.reallocate(paymentId, businessId, allocations);

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "PAYMENT_REALLOCATED",
      metadata: { paymentId, allocations: allocations.length },
      ...clientInfo,
    });

    return payment;
  }

  async reversePayment(
    paymentId: string,
    businessId: string,
    actor: Actor,
    reason?: string,
    clientInfo?: ClientInfo
  ) {
    requirePermission(actor, PERMISSION.PAYMENT_REVERSE);

    const result = await paymentRepository.reverse(
      paymentId,
      businessId,
      actor.userId,
      reason
    );

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "PAYMENT_REVERSED",
      metadata: { paymentId, reason },
      ...clientInfo,
    });

    return result;
  }

  // ---- items -------------------------------------------------------------

  async listItems(
    businessId: string,
    actor: Actor,
    options?: { search?: string; includeArchived?: boolean; limit?: number; offset?: number }
  ) {
    requirePermission(actor, PERMISSION.ITEM_VIEW);
    return itemRepository.findMany(businessId, options);
  }

  async createItem(businessId: string, actor: Actor, input: ItemInput) {
    requirePermission(actor, PERMISSION.ITEM_MANAGE);
    return itemRepository.create(businessId, input);
  }

  async updateItem(id: string, businessId: string, actor: Actor, input: Partial<ItemInput>) {
    requirePermission(actor, PERMISSION.ITEM_MANAGE);
    return itemRepository.update(id, businessId, input);
  }

  async archiveItem(id: string, businessId: string, actor: Actor) {
    requirePermission(actor, PERMISSION.ITEM_MANAGE);
    return itemRepository.archive(id, businessId);
  }

  // ---- reports -----------------------------------------------------------

  async agingReport(
    businessId: string,
    actor: Actor,
    options?: { kind?: InvoiceKind; asAt?: Date }
  ) {
    requirePermission(actor, PERMISSION.REPORT_VIEW);
    return buildAgingReport(businessId, options);
  }
}

export const invoiceService = new InvoiceService();
