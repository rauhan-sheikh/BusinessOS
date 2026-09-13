/**
 * Receivables and payables aging.
 *
 * The report the whole invoicing module was built to make possible: before
 * payments settled specific documents, the only thing a balance could say was
 * how much a counterparty owed in total, never how long any of it had been
 * outstanding.
 */
import { prisma } from "@/db";
import type { InvoiceKind } from "@/generated/prisma/client";
import {
  AGING_BUCKETS,
  bucketFor,
  daysOverdue,
  outstandingOf,
  type AgingBucketLabel,
} from "../allocation";

export interface AgedInvoice {
  id: string;
  number: string | null;
  issueDate: Date;
  dueDate: Date | null;
  totalMinor: bigint;
  paidMinor: bigint;
  outstandingMinor: bigint;
  daysOverdue: number;
  bucket: AgingBucketLabel;
}

export interface AgedParty {
  partyId: string;
  partyName: string;
  totalOutstandingMinor: bigint;
  /** Outstanding per bucket, every bucket present so columns line up. */
  buckets: Record<AgingBucketLabel, bigint>;
  invoices: AgedInvoice[];
}

export interface AgingReport {
  asAt: Date;
  kind: InvoiceKind;
  parties: AgedParty[];
  totalOutstandingMinor: bigint;
  bucketTotals: Record<AgingBucketLabel, bigint>;
  /** Of the total, how much is past its due date. */
  overdueMinor: bigint;
}

function emptyBuckets(): Record<AgingBucketLabel, bigint> {
  return Object.fromEntries(AGING_BUCKETS.map((b) => [b.label, 0n])) as Record<
    AgingBucketLabel,
    bigint
  >;
}

/**
 * Builds the report from open documents.
 *
 * Only issued and partly paid invoices are open: a draft was never issued, a
 * paid one is settled, and a cancelled one was reversed out of the books.
 */
export async function buildAgingReport(
  businessId: string,
  options: { kind?: InvoiceKind; asAt?: Date } = {}
): Promise<AgingReport> {
  const kind = options.kind ?? "SALES";
  const asAt = options.asAt ?? new Date();

  const invoices = await prisma.invoice.findMany({
    where: {
      businessId,
      kind,
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
    },
    select: {
      id: true,
      number: true,
      issueDate: true,
      dueDate: true,
      totalMinor: true,
      paidMinor: true,
      status: true,
      party: { select: { id: true, name: true } },
    },
    orderBy: [{ issueDate: "asc" }],
  });

  const byParty = new Map<string, AgedParty>();
  const bucketTotals = emptyBuckets();
  let totalOutstandingMinor = 0n;
  let overdueMinor = 0n;

  for (const invoice of invoices) {
    const outstandingMinor = outstandingOf(invoice);
    // A rounding or allocation edge could leave nothing owed while the status
    // still says open; such a document does not belong on an aging report.
    if (outstandingMinor <= 0n) continue;

    const overdue = daysOverdue(
      {
        id: invoice.id,
        totalMinor: invoice.totalMinor,
        paidMinor: invoice.paidMinor,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
      },
      asAt
    );
    const bucket = bucketFor(overdue);

    const existing =
      byParty.get(invoice.party.id) ??
      {
        partyId: invoice.party.id,
        partyName: invoice.party.name,
        totalOutstandingMinor: 0n,
        buckets: emptyBuckets(),
        invoices: [],
      };

    existing.totalOutstandingMinor += outstandingMinor;
    existing.buckets[bucket] += outstandingMinor;
    existing.invoices.push({
      id: invoice.id,
      number: invoice.number,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      totalMinor: invoice.totalMinor,
      paidMinor: invoice.paidMinor,
      outstandingMinor,
      daysOverdue: overdue,
      bucket,
    });

    byParty.set(invoice.party.id, existing);

    bucketTotals[bucket] += outstandingMinor;
    totalOutstandingMinor += outstandingMinor;
    if (overdue > 0) overdueMinor += outstandingMinor;
  }

  return {
    asAt,
    kind,
    // Largest exposure first, which is what anyone chasing payment wants.
    parties: [...byParty.values()].sort((a, b) =>
      a.totalOutstandingMinor === b.totalOutstandingMinor
        ? a.partyName.localeCompare(b.partyName)
        : b.totalOutstandingMinor > a.totalOutstandingMinor
          ? 1
          : -1
    ),
    totalOutstandingMinor,
    bucketTotals,
    overdueMinor,
  };
}
