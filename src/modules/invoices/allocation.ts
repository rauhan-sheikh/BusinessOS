/**
 * Applying payments to invoices.
 *
 * Without allocation a payment can only reduce a running balance, and no
 * invoice can be called paid or overdue - which is what an aging report is
 * made of. These are pure functions so the rules can be tested without a
 * database, and so the same logic serves both automatic and manual allocation.
 */
import type { InvoiceStatus } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";

export interface AllocatableInvoice {
  id: string;
  /** What the document asks for. */
  totalMinor: bigint;
  /** Already settled by other payments. */
  paidMinor: bigint;
  status: InvoiceStatus;
  /** Used to settle oldest first. */
  issueDate: Date;
  dueDate?: Date | null;
}

export interface Allocation {
  invoiceId: string;
  amountMinor: bigint;
}

/** Still owed on an invoice. Never negative. */
export function outstandingOf(invoice: AllocatableInvoice): bigint {
  const remaining = invoice.totalMinor - invoice.paidMinor;
  return remaining > 0n ? remaining : 0n;
}

/**
 * Whether a payment may be applied to this document at all.
 *
 * A draft has not been issued, so there is nothing to owe; a cancelled invoice
 * has been reversed out of the books and settling it would resurrect a
 * liability that no longer exists.
 */
export function isAllocatable(invoice: AllocatableInvoice): boolean {
  return invoice.status !== "DRAFT" && invoice.status !== "CANCELLED";
}

/**
 * The status implied by how much has been paid.
 *
 * Derived rather than stored independently, so the status can never disagree
 * with the figures it describes.
 */
export function statusForPaid(
  totalMinor: bigint,
  paidMinor: bigint,
  current: InvoiceStatus
): InvoiceStatus {
  // A cancelled document stays cancelled regardless of what was once paid
  // against it, and a draft is not in the books to be paid.
  if (current === "CANCELLED" || current === "DRAFT") return current;

  if (paidMinor <= 0n) return "ISSUED";
  if (paidMinor >= totalMinor) return "PAID";
  return "PARTIALLY_PAID";
}

/**
 * Spreads a payment across open invoices, oldest first.
 *
 * FIFO is the usual convention and the one a customer expects when they pay a
 * round sum against several bills. Anything left over is returned rather than
 * forced onto the newest invoice, so it can be held as an advance.
 */
export function autoAllocate(
  amountMinor: bigint,
  invoices: readonly AllocatableInvoice[]
): { allocations: Allocation[]; unallocatedMinor: bigint } {
  if (amountMinor <= 0n) {
    throw new AppError("A payment must be for more than zero.", 400);
  }

  const open = invoices
    .filter((invoice) => isAllocatable(invoice) && outstandingOf(invoice) > 0n)
    .sort((a, b) => {
      const byDate = a.issueDate.getTime() - b.issueDate.getTime();
      // Stable on equal dates, so the same input always allocates the same way.
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
    });

  const allocations: Allocation[] = [];
  let remaining = amountMinor;

  for (const invoice of open) {
    if (remaining <= 0n) break;

    const outstanding = outstandingOf(invoice);
    const applied = remaining < outstanding ? remaining : outstanding;

    allocations.push({ invoiceId: invoice.id, amountMinor: applied });
    remaining -= applied;
  }

  return { allocations, unallocatedMinor: remaining };
}

/**
 * Checks a hand-made allocation before it is written.
 *
 * Over-allocating either side is the failure that matters: paying more than a
 * payment is worth invents money, and settling more than an invoice asks for
 * would leave the ledger disagreeing with the document.
 */
export function assertAllocationsValid(
  paymentAmountMinor: bigint,
  allocations: readonly Allocation[],
  invoicesById: ReadonlyMap<string, AllocatableInvoice>
): void {
  if (allocations.length === 0) return;

  let total = 0n;
  const seen = new Set<string>();

  for (const allocation of allocations) {
    if (allocation.amountMinor <= 0n) {
      throw new AppError("An allocation must be for more than zero.", 400);
    }

    if (seen.has(allocation.invoiceId)) {
      throw new AppError(
        "The same invoice appears twice in one allocation. Combine them into a single amount.",
        400
      );
    }
    seen.add(allocation.invoiceId);

    const invoice = invoicesById.get(allocation.invoiceId);
    if (!invoice) {
      throw new AppError("One of the invoices being paid could not be found.", 404);
    }

    if (!isAllocatable(invoice)) {
      throw new AppError(
        invoice.status === "DRAFT"
          ? "A draft invoice has not been issued and cannot be paid."
          : "A cancelled invoice cannot be paid.",
        400
      );
    }

    if (allocation.amountMinor > outstandingOf(invoice)) {
      throw new AppError(
        "An allocation is larger than the amount still outstanding on that invoice.",
        400
      );
    }

    total += allocation.amountMinor;
  }

  if (total > paymentAmountMinor) {
    throw new AppError(
      "The allocations add up to more than the payment is for.",
      400
    );
  }
}

/** Days overdue as at a given date. Zero when not yet due. */
export function daysOverdue(invoice: AllocatableInvoice, asAt: Date): number {
  if (!invoice.dueDate || outstandingOf(invoice) === 0n) return 0;

  const millis = asAt.getTime() - invoice.dueDate.getTime();
  if (millis <= 0) return 0;

  return Math.floor(millis / (24 * 60 * 60 * 1000));
}

/** The buckets an aging report is usually presented in. */
export const AGING_BUCKETS = [
  { label: "Not due", minDays: -Infinity, maxDays: 0 },
  { label: "1-30 days", minDays: 1, maxDays: 30 },
  { label: "31-60 days", minDays: 31, maxDays: 60 },
  { label: "61-90 days", minDays: 61, maxDays: 90 },
  { label: "Over 90 days", minDays: 91, maxDays: Infinity },
] as const;

export type AgingBucketLabel = (typeof AGING_BUCKETS)[number]["label"];

export function bucketFor(days: number): AgingBucketLabel {
  const bucket = AGING_BUCKETS.find((b) => days >= b.minDays && days <= b.maxDays);
  // The buckets span the whole line, so this only guards a future edit.
  return (bucket ?? AGING_BUCKETS[0]).label;
}
