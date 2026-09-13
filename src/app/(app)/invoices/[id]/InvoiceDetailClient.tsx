"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/shared/utils/currency";
import {
  Card,
  CardHeader,
  Badge,
  Button,
  TableWrap,
  useToast,
  useConfirm,
  type BadgeTone,
} from "@/shared/components/ui";

export interface InvoiceDetail {
  id: string;
  number: string | null;
  financialYear: string | null;
  kind: "SALES" | "PURCHASE";
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  issueDate: string;
  dueDate: string | null;
  placeOfSupply: string | null;
  gstTreatment: "INTRA_STATE" | "INTER_STATE" | "EXEMPT";
  subtotalMinor: string;
  discountMinor: string;
  cgstMinor: string;
  sgstMinor: string;
  igstMinor: string;
  roundingMinor: string;
  totalMinor: string;
  paidMinor: string;
  notes: string | null;
  terms: string | null;
  journalEntryId: string | null;
  party: {
    id: string;
    name: string;
    gstin: string | null;
    email: string | null;
    address: string | null;
  };
  createdBy: { id: string; name: string | null };
  lines: Array<{
    id: string;
    position: number;
    description: string;
    hsnSacCode: string | null;
    quantityMilli: string;
    unitOfMeasure: string | null;
    unitPriceMinor: string;
    discountMinor: string;
    taxRateBps: number;
    lineSubtotalMinor: string;
    cgstMinor: string;
    sgstMinor: string;
    igstMinor: string;
    lineTotalMinor: string;
  }>;
  allocations: Array<{ id: string; paymentId: string; amountMinor: string }>;
}

const STATUS_TONE: Record<InvoiceDetail["status"], BadgeTone> = {
  DRAFT: "neutral",
  ISSUED: "info",
  PARTIALLY_PAID: "payable",
  PAID: "receivable",
  CANCELLED: "danger",
};

const STATUS_LABEL: Record<InvoiceDetail["status"], string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIALLY_PAID: "Part paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

const TREATMENT_LABEL: Record<InvoiceDetail["gstTreatment"], string> = {
  INTRA_STATE: "Intra-state — CGST + SGST",
  INTER_STATE: "Inter-state — IGST",
  EXEMPT: "Exempt — no GST",
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** Thousandths back to a readable quantity: 2500 reads as "2.5", 1000 as "1". */
function formatQuantity(quantityMilli: string): string {
  const milli = BigInt(quantityMilli);
  const whole = milli / 1000n;
  const fraction = (milli % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export default function InvoiceDetailClient({
  invoice: initialInvoice,
  currency,
  canIssue,
  canCancel,
}: {
  invoice: InvoiceDetail;
  currency: string;
  canIssue: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();

  const [invoice, setInvoice] = useState(initialInvoice);
  const [isBusy, setIsBusy] = useState(false);

  const outstanding = BigInt(invoice.totalMinor) - BigInt(invoice.paidMinor);
  const isSales = invoice.kind === "SALES";
  const hasTax =
    BigInt(invoice.cgstMinor) > 0n ||
    BigInt(invoice.sgstMinor) > 0n ||
    BigInt(invoice.igstMinor) > 0n;

  const refresh = async () => {
    const res = await fetch(`/api/invoices/${invoice.id}`);
    const data = await res.json();
    if (res.ok) setInvoice(data.invoice);
    router.refresh();
  };

  const handleIssue = async () => {
    const confirmed = await confirm({
      title: "Issue this invoice?",
      confirmLabel: "Issue invoice",
      message: (
        <>
          <p>
            This allocates the next number for the financial year and posts{" "}
            <span className="font-semibold text-fg">
              {formatCurrency(invoice.totalMinor, currency)}
            </span>{" "}
            to the books against{" "}
            <span className="font-semibold text-fg">{invoice.party.name}</span>.
          </p>
          <p className="mt-2 text-fg-subtle">
            An issued invoice cannot be edited. To undo it you cancel it, which keeps
            the number and reverses the posting.
          </p>
        </>
      ),
    });
    if (!confirmed) return;

    setIsBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/issue`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not issue this invoice.");

      toast.success(`Issued ${data.invoice.number}.`);
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not issue this invoice.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancel = async () => {
    const confirmed = await confirm({
      title: "Cancel this invoice?",
      isDestructive: true,
      confirmLabel: "Cancel invoice",
      cancelLabel: "Keep it",
      message: (
        <>
          <p>
            The posting for{" "}
            <span className="font-semibold text-fg">{invoice.number}</span> is reversed
            out of the books.
          </p>
          <p className="mt-2 text-fg-subtle">
            The document and its number are kept, because removing either would leave a
            gap in the sequence.
          </p>
        </>
      ),
    });
    if (!confirmed) return;

    setIsBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not cancel this invoice.");

      toast.success("Invoice cancelled.");
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not cancel this invoice.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteDraft = async () => {
    const confirmed = await confirm({
      title: "Delete this draft?",
      isDestructive: true,
      confirmLabel: "Delete draft",
      cancelLabel: "Keep it",
      message: (
        <p>
          It was never numbered and never reached the books, so nothing is reversed.
          This cannot be undone.
        </p>
      ),
    });
    if (!confirmed) return;

    setIsBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete this draft.");

      toast.success("Draft deleted.");
      router.push("/invoices");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not delete this draft.");
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {confirmDialog}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-fg font-mono truncate">
              {invoice.number ?? "Unnumbered draft"}
            </h1>
            <Badge tone={STATUS_TONE[invoice.status]}>
              {STATUS_LABEL[invoice.status]}
            </Badge>
          </div>
          <p className="text-sm text-fg-subtle mt-1">
            {isSales ? "Sales invoice to" : "Supplier bill from"}{" "}
            <Link
              href={`/parties/${invoice.party.id}`}
              className="text-accent-subtle hover:text-fg transition-colors"
            >
              {invoice.party.name}
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => router.push("/invoices")}>
            Back
          </Button>
          {canIssue && invoice.status === "DRAFT" && (
            <Button isLoading={isBusy} onClick={() => void handleIssue()}>
              Issue
            </Button>
          )}
          {canCancel && invoice.status === "DRAFT" && (
            <Button
              variant="danger"
              isLoading={isBusy}
              onClick={() => void handleDeleteDraft()}
            >
              Delete draft
            </Button>
          )}
          {canCancel &&
            (invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") && (
              <Button
                variant="danger"
                isLoading={isBusy}
                onClick={() => void handleCancel()}
              >
                Cancel
              </Button>
            )}
        </div>
      </div>

      {invoice.status === "CANCELLED" && (
        <p
          role="status"
          className="text-[11px] text-danger font-medium bg-danger/10 border border-danger/20 p-3 rounded-xl"
        >
          This invoice has been cancelled and its posting reversed. The number is kept so
          the sequence stays gapless.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 space-y-1">
          <p className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider">
            Total
          </p>
          <p className="text-2xl font-bold text-fg">
            {formatCurrency(invoice.totalMinor, currency)}
          </p>
        </Card>
        <Card className="p-5 space-y-1">
          <p className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider">
            Settled
          </p>
          <p className="text-2xl font-bold text-receivable">
            {formatCurrency(invoice.paidMinor, currency)}
          </p>
        </Card>
        <Card className="p-5 space-y-1">
          <p className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider">
            Outstanding
          </p>
          <p
            className={`text-2xl font-bold ${
              outstanding > 0n ? "text-payable" : "text-fg-subtle"
            }`}
          >
            {formatCurrency(outstanding, currency)}
          </p>
        </Card>
        <Card className="p-5 space-y-1">
          <p className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider">
            Due
          </p>
          <p className="text-sm font-bold text-fg pt-2">
            {invoice.dueDate ? formatDate(invoice.dueDate) : "No due date"}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 sm:p-6 space-y-3">
          <h2 className="text-sm font-bold text-fg">Document</h2>
          <dl className="space-y-2 text-[11px]">
            <div className="flex justify-between gap-4">
              <dt className="text-fg-subtle">Issued</dt>
              <dd className="text-fg-muted">{formatDate(invoice.issueDate)}</dd>
            </div>
            {invoice.financialYear && (
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">Financial year</dt>
                <dd className="text-fg-muted">{invoice.financialYear}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-fg-subtle">GST treatment</dt>
              <dd className="text-fg-muted text-right">
                {TREATMENT_LABEL[invoice.gstTreatment]}
              </dd>
            </div>
            {invoice.placeOfSupply && (
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">Place of supply</dt>
                <dd className="text-fg-muted">State {invoice.placeOfSupply}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-fg-subtle">Posted to books</dt>
              <dd className="text-fg-muted">{invoice.journalEntryId ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-subtle">Created by</dt>
              <dd className="text-fg-muted">{invoice.createdBy.name ?? "Unknown"}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-4 sm:p-6 space-y-3">
          <h2 className="text-sm font-bold text-fg">
            {isSales ? "Customer" : "Supplier"}
          </h2>
          <dl className="space-y-2 text-[11px]">
            <div>
              <dt className="text-fg-subtle">Name</dt>
              <dd className="text-fg-muted font-medium">{invoice.party.name}</dd>
            </div>
            {invoice.party.gstin && (
              <div>
                <dt className="text-fg-subtle">GSTIN</dt>
                <dd className="text-fg-muted font-mono">{invoice.party.gstin}</dd>
              </div>
            )}
            {invoice.party.email && (
              <div>
                <dt className="text-fg-subtle">Email</dt>
                <dd className="text-fg-muted break-all">{invoice.party.email}</dd>
              </div>
            )}
            {invoice.party.address && (
              <div>
                <dt className="text-fg-subtle">Address</dt>
                <dd className="text-fg-muted whitespace-pre-line">
                  {invoice.party.address}
                </dd>
              </div>
            )}
          </dl>
        </Card>

        <Card className="p-4 sm:p-6 space-y-3">
          <h2 className="text-sm font-bold text-fg">Totals</h2>
          <dl className="space-y-2 text-[11px]">
            <div className="flex justify-between gap-4">
              <dt className="text-fg-subtle">Subtotal</dt>
              <dd className="text-fg-muted font-medium">
                {formatCurrency(invoice.subtotalMinor, currency)}
              </dd>
            </div>
            {BigInt(invoice.discountMinor) > 0n && (
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">Discount applied</dt>
                <dd className="text-fg-muted">
                  {formatCurrency(invoice.discountMinor, currency)}
                </dd>
              </div>
            )}
            {BigInt(invoice.cgstMinor) > 0n && (
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">CGST</dt>
                <dd className="text-fg-muted">
                  {formatCurrency(invoice.cgstMinor, currency)}
                </dd>
              </div>
            )}
            {BigInt(invoice.sgstMinor) > 0n && (
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">SGST</dt>
                <dd className="text-fg-muted">
                  {formatCurrency(invoice.sgstMinor, currency)}
                </dd>
              </div>
            )}
            {BigInt(invoice.igstMinor) > 0n && (
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">IGST</dt>
                <dd className="text-fg-muted">
                  {formatCurrency(invoice.igstMinor, currency)}
                </dd>
              </div>
            )}
            {BigInt(invoice.roundingMinor) !== 0n && (
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">Rounding</dt>
                <dd className="text-fg-muted">
                  {formatCurrency(invoice.roundingMinor, currency)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4 pt-2 border-t border-line">
              <dt className="font-bold text-fg">Total</dt>
              <dd className="font-bold text-fg text-sm">
                {formatCurrency(invoice.totalMinor, currency)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Lines" />
        <TableWrap className="mt-4">
          <table className="w-full text-left text-xs">
            <thead className="bg-raised text-fg-subtle border-y border-line">
              <tr>
                <th scope="col" className="py-3 px-4 font-semibold">Description</th>
                <th scope="col" className="py-3 px-4 font-semibold">HSN / SAC</th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">Qty</th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">Rate</th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">Discount</th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">Taxable</th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">Tax</th>
                <th scope="col" className="py-3 px-4 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invoice.lines.map((line) => {
                const tax =
                  BigInt(line.cgstMinor) + BigInt(line.sgstMinor) + BigInt(line.igstMinor);

                return (
                  <tr key={line.id} className="hover:bg-raised/50 transition-colors">
                    <td className="py-3 px-4 text-fg-muted">{line.description}</td>
                    <td className="py-3 px-4 text-fg-subtle font-mono">
                      {line.hsnSacCode || <span aria-hidden="true">&mdash;</span>}
                    </td>
                    <td className="py-3 px-4 text-right text-fg-subtle whitespace-nowrap">
                      {formatQuantity(line.quantityMilli)}
                      {line.unitOfMeasure ? ` ${line.unitOfMeasure}` : ""}
                    </td>
                    <td className="py-3 px-4 text-right text-fg-subtle whitespace-nowrap">
                      {formatCurrency(line.unitPriceMinor, currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-fg-subtle whitespace-nowrap">
                      {BigInt(line.discountMinor) > 0n ? (
                        formatCurrency(line.discountMinor, currency)
                      ) : (
                        <span aria-hidden="true">&mdash;</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-fg-muted whitespace-nowrap">
                      {formatCurrency(line.lineSubtotalMinor, currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-fg-subtle whitespace-nowrap">
                      {tax > 0n ? (
                        <>
                          {formatCurrency(tax, currency)}
                          <span className="block text-[10px]">
                            {line.taxRateBps / 100}%
                          </span>
                        </>
                      ) : (
                        <span aria-hidden="true">&mdash;</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-fg whitespace-nowrap">
                      {formatCurrency(line.lineTotalMinor, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        {!hasTax && invoice.gstTreatment !== "EXEMPT" && (
          <p className="text-[11px] text-fg-subtle p-4">
            No tax was charged on this document.
          </p>
        )}
      </Card>

      {(invoice.notes || invoice.terms) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {invoice.notes && (
            <Card className="p-4 sm:p-6 space-y-2">
              <h2 className="text-sm font-bold text-fg">Notes</h2>
              <p className="text-[11px] text-fg-muted whitespace-pre-line">
                {invoice.notes}
              </p>
            </Card>
          )}
          {invoice.terms && (
            <Card className="p-4 sm:p-6 space-y-2">
              <h2 className="text-sm font-bold text-fg">Terms</h2>
              <p className="text-[11px] text-fg-muted whitespace-pre-line">
                {invoice.terms}
              </p>
            </Card>
          )}
        </div>
      )}

      {outstanding > 0n && invoice.status !== "CANCELLED" && invoice.status !== "DRAFT" && (
        <Card className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[11px] text-fg-subtle">
            {formatCurrency(outstanding, currency)} is still outstanding on this
            document.
          </p>
          <Button variant="secondary" onClick={() => router.push("/payments")}>
            Record a payment
          </Button>
        </Card>
      )}
    </div>
  );
}
