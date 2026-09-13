"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/shared/utils/currency";
import {
  Card,
  Badge,
  Button,
  EmptyState,
  TableWrap,
  SelectField,
  InputField,
  Pagination,
  useToast,
  useConfirm,
  type BadgeTone,
} from "@/shared/components/ui";

export interface InvoiceRow {
  id: string;
  number: string | null;
  kind: "SALES" | "PURCHASE";
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  issueDate: string;
  dueDate: string | null;
  totalMinor: string;
  paidMinor: string;
  party: { id: string; name: string };
}

const STATUS_TONE: Record<InvoiceRow["status"], BadgeTone> = {
  DRAFT: "neutral",
  ISSUED: "info",
  PARTIALLY_PAID: "payable",
  PAID: "receivable",
  CANCELLED: "danger",
};

const STATUS_LABEL: Record<InvoiceRow["status"], string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIALLY_PAID: "Part paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

interface Props {
  initialInvoices: InvoiceRow[];
  initialTotalCount: number;
  pageSize: number;
  currency: string;
  canCreate: boolean;
  canIssue: boolean;
  canCancel: boolean;
}

export default function InvoicesClient({
  initialInvoices,
  initialTotalCount,
  pageSize,
  currency,
  canCreate,
  canIssue,
  canCancel,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();

  const [invoices, setInvoices] = useState(initialInvoices);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<"SALES" | "PURCHASE">("SALES");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (nextPage = page, overrides: Record<string, string> = {}) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(pageSize),
        kind,
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
        ...overrides,
      });

      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load invoices.");

      setInvoices(data.invoices ?? []);
      setTotalCount(data.totalCount ?? 0);
      setPage(nextPage);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load invoices.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleIssue = async (invoice: InvoiceRow) => {
    const confirmed = await confirm({
      title: "Issue this invoice?",
      confirmLabel: "Issue invoice",
      message: (
        <>
          <p>
            This allocates the next invoice number and posts{" "}
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

    setBusyId(invoice.id);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/issue`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not issue this invoice.");

      toast.success(`Issued ${data.invoice.number}.`);
      await load();
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not issue this invoice.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (invoice: InvoiceRow) => {
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

    setBusyId(invoice.id);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not cancel this invoice.");

      toast.success("Invoice cancelled.");
      await load();
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not cancel this invoice.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {confirmDialog}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">Invoices</h1>
          <p className="text-sm text-fg-subtle mt-1">
            Sales invoices and supplier bills, and what is still owed on them
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push("/invoices/new")} className="self-start sm:self-auto">
            + New invoice
          </Button>
        )}
      </div>

      <Card className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SelectField
            label="Type"
            value={kind}
            onChange={(e) => {
              const next = e.target.value as "SALES" | "PURCHASE";
              setKind(next);
              void load(1, { kind: next });
            }}
          >
            <option value="SALES">Sales invoices</option>
            <option value="PURCHASE">Supplier bills</option>
          </SelectField>

          <SelectField
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              void load(1, e.target.value ? { status: e.target.value } : {});
            }}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="PARTIALLY_PAID">Part paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </SelectField>

          <div className="lg:col-span-2">
            <InputField
              label="Search number, party or notes"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(1);
              }}
              placeholder="e.g. INV/2026-27/0001"
            />
          </div>
        </div>
      </Card>

      {invoices.length === 0 ? (
        <Card>
          <EmptyState
            title="No invoices yet"
            description={
              search || status
                ? "Try a different search or status filter."
                : "Create your first invoice to start tracking what customers owe you."
            }
            action={
              canCreate && !search && !status ? (
                <Button onClick={() => router.push("/invoices/new")}>
                  Create the first invoice
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <TableWrap>
            <table className="w-full text-left text-xs">
              <thead className="bg-raised text-fg-subtle border-b border-line">
                <tr>
                  <th scope="col" className="py-3 px-4 font-semibold">Number</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Counterparty</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Issued</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Due</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-right">Total</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-right">Outstanding</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Status</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoices.map((invoice) => {
                  const outstanding = BigInt(invoice.totalMinor) - BigInt(invoice.paidMinor);
                  const overdue =
                    invoice.dueDate !== null &&
                    outstanding > 0n &&
                    new Date(invoice.dueDate) < new Date() &&
                    invoice.status !== "CANCELLED";

                  return (
                    <tr key={invoice.id} className="hover:bg-raised/50 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="font-mono text-accent-subtle hover:text-fg transition-colors"
                        >
                          {invoice.number ?? "Draft"}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-fg-muted">{invoice.party.name}</td>
                      <td className="py-3 px-4 text-fg-subtle whitespace-nowrap">
                        {new Date(invoice.issueDate).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {invoice.dueDate ? (
                          <span className={overdue ? "text-danger font-medium" : "text-fg-subtle"}>
                            {new Date(invoice.dueDate).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </span>
                        ) : (
                          <span className="text-fg-subtle">&mdash;</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-fg">
                        {formatCurrency(invoice.totalMinor, currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {outstanding > 0n ? (
                          <span className="text-payable">
                            {formatCurrency(outstanding.toString(), currency)}
                          </span>
                        ) : (
                          <span className="text-fg-subtle">&mdash;</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone={STATUS_TONE[invoice.status]}>
                          {STATUS_LABEL[invoice.status]}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                        {canIssue && invoice.status === "DRAFT" && (
                          <Button
                            size="sm"
                            isLoading={busyId === invoice.id}
                            onClick={() => handleIssue(invoice)}
                          >
                            Issue
                          </Button>
                        )}
                        {canCancel &&
                          (invoice.status === "ISSUED" ||
                            invoice.status === "PARTIALLY_PAID") && (
                            <Button
                              size="sm"
                              variant="secondary"
                              isLoading={busyId === invoice.id}
                              onClick={() => handleCancel(invoice)}
                            >
                              Cancel
                            </Button>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        isLoading={isLoading}
        onPageChange={(next) => void load(next)}
      />
    </div>
  );
}
