"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/shared/utils/currency";
import {
  Card,
  Badge,
  EmptyState,
  TableWrap,
  SelectField,
  useToast,
  type BadgeTone,
} from "@/shared/components/ui";

const BUCKETS = [
  "Not due",
  "1-30 days",
  "31-60 days",
  "61-90 days",
  "Over 90 days",
] as const;

type Bucket = (typeof BUCKETS)[number];

/** Older money is worse money, so the colour escalates with the bucket. */
const BUCKET_TONE: Record<Bucket, BadgeTone> = {
  "Not due": "info",
  "1-30 days": "neutral",
  "31-60 days": "payable",
  "61-90 days": "payable",
  "Over 90 days": "danger",
};

export interface AgingReportData {
  asAt: string;
  kind: "SALES" | "PURCHASE";
  totalOutstandingMinor: string;
  overdueMinor: string;
  bucketTotals: Record<Bucket, string>;
  parties: Array<{
    partyId: string;
    partyName: string;
    totalOutstandingMinor: string;
    buckets: Record<Bucket, string>;
    invoices: Array<{
      id: string;
      number: string | null;
      issueDate: string;
      dueDate: string | null;
      outstandingMinor: string;
      daysOverdue: number;
      bucket: Bucket;
    }>;
  }>;
}

export default function AgingClient({
  initialReport,
  currency,
}: {
  initialReport: AgingReportData;
  currency: string;
}) {
  const toast = useToast();
  const [report, setReport] = useState(initialReport);
  const [kind, setKind] = useState<"SALES" | "PURCHASE">(initialReport.kind);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = async (nextKind: "SALES" | "PURCHASE") => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/reports/aging?kind=${nextKind}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the report.");

      setReport(data.report);
      setKind(nextKind);
      setExpanded(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load the report.");
    } finally {
      setIsLoading(false);
    }
  };

  const isReceivable = kind === "SALES";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">
            {isReceivable ? "Receivables aging" : "Payables aging"}
          </h1>
          <p className="text-sm text-fg-subtle mt-1">
            How long {isReceivable ? "money owed to you" : "money you owe"} has been
            outstanding, as at{" "}
            {new Date(report.asAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
        <div className="w-full sm:w-56">
          <SelectField
            label="Report"
            value={kind}
            disabled={isLoading}
            onChange={(e) => void load(e.target.value as "SALES" | "PURCHASE")}
          >
            <option value="SALES">Receivables (customers)</option>
            <option value="PURCHASE">Payables (suppliers)</option>
          </SelectField>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-5 space-y-1">
          <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wider">
            Total outstanding
          </p>
          <p className="text-2xl font-bold text-fg">
            {formatCurrency(report.totalOutstandingMinor, currency)}
          </p>
        </Card>
        <Card className="p-5 space-y-1">
          <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wider">
            Past due
          </p>
          <p className="text-2xl font-bold text-danger">
            {formatCurrency(report.overdueMinor, currency)}
          </p>
        </Card>
        <Card className="p-5 space-y-1">
          <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wider">
            Counterparties
          </p>
          <p className="text-2xl font-bold text-fg">{report.parties.length}</p>
        </Card>
      </div>

      {report.parties.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing outstanding"
            description={
              isReceivable
                ? "Every issued invoice has been settled."
                : "Every supplier bill has been paid."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <TableWrap>
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                Outstanding amounts by counterparty and age
              </caption>
              <thead className="bg-raised text-fg-subtle border-b border-line">
                <tr>
                  <th scope="col" className="py-3 px-4 font-semibold">Counterparty</th>
                  {BUCKETS.map((bucket) => (
                    <th key={bucket} scope="col" className="py-3 px-4 font-semibold text-right whitespace-nowrap">
                      {bucket}
                    </th>
                  ))}
                  <th scope="col" className="py-3 px-4 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.parties.map((party) => (
                  <Fragment key={party.partyId}>
                    <tr
                      className="hover:bg-raised/50 transition-colors cursor-pointer"
                      onClick={() =>
                        setExpanded(expanded === party.partyId ? null : party.partyId)
                      }
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          aria-expanded={expanded === party.partyId}
                          className="font-medium text-fg hover:text-accent-subtle transition-colors text-left"
                        >
                          {party.partyName}
                        </button>
                      </td>
                      {BUCKETS.map((bucket) => {
                        const amount = BigInt(party.buckets[bucket] ?? "0");
                        return (
                          <td key={bucket} className="py-3 px-4 text-right">
                            {amount > 0n ? (
                              <span className={bucket === "Over 90 days" ? "text-danger font-medium" : "text-fg-muted"}>
                                {formatCurrency(amount.toString(), currency)}
                              </span>
                            ) : (
                              <span className="text-fg-subtle">&mdash;</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-right font-bold text-fg">
                        {formatCurrency(party.totalOutstandingMinor, currency)}
                      </td>
                    </tr>

                    {expanded === party.partyId &&
                      party.invoices.map((invoice) => (
                        <tr key={invoice.id} className="bg-canvas/60">
                          <td className="py-2 px-4 pl-10" colSpan={2}>
                            <Link
                              href={`/invoices/${invoice.id}`}
                              className="font-mono text-[11px] text-accent-subtle hover:text-fg transition-colors"
                            >
                              {invoice.number ?? "Draft"}
                            </Link>
                            <span className="text-[11px] text-fg-subtle ml-2">
                              issued{" "}
                              {new Date(invoice.issueDate).toLocaleDateString("en-IN", {
                                day: "numeric", month: "short", year: "numeric",
                              })}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-[11px] text-fg-subtle" colSpan={2}>
                            {invoice.dueDate
                              ? `due ${new Date(invoice.dueDate).toLocaleDateString("en-IN", {
                                  day: "numeric", month: "short", year: "numeric",
                                })}`
                              : "no due date"}
                          </td>
                          <td className="py-2 px-4">
                            <Badge tone={BUCKET_TONE[invoice.bucket]}>
                              {invoice.daysOverdue > 0
                                ? `${invoice.daysOverdue}d overdue`
                                : "Not due"}
                            </Badge>
                          </td>
                          <td className="py-2 px-4 text-right text-fg-muted">
                            {formatCurrency(invoice.outstandingMinor, currency)}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot className="bg-raised border-t border-line">
                <tr>
                  <th scope="row" className="py-3 px-4 font-bold text-fg text-left">
                    Total
                  </th>
                  {BUCKETS.map((bucket) => (
                    <td key={bucket} className="py-3 px-4 text-right font-bold text-fg-muted">
                      {formatCurrency(report.bucketTotals[bucket] ?? "0", currency)}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right font-bold text-fg">
                    {formatCurrency(report.totalOutstandingMinor, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}
