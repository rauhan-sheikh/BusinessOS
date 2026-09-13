"use client";

import { Fragment, useState } from "react";
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
  Pagination,
  useToast,
  useConfirm,
} from "@/shared/components/ui";
import RecordPaymentModal, { type PartyOption } from "./RecordPaymentModal";

export interface PaymentRow {
  id: string;
  kind: "SALES" | "PURCHASE";
  amountMinor: string;
  paymentDate: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  party: { id: string; name: string };
  createdBy: { id: string; name: string | null };
  reversedBy: { id: string; name: string | null } | null;
  allocations: Array<{
    id: string;
    amountMinor: string;
    invoice: { id: string; number: string | null; totalMinor: string };
  }>;
}

interface Props {
  initialPayments: PaymentRow[];
  initialTotalCount: number;
  pageSize: number;
  currency: string;
  parties: PartyOption[];
  canRecord: boolean;
  canReverse: boolean;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function PaymentsClient({
  initialPayments,
  initialTotalCount,
  pageSize,
  currency,
  parties,
  canRecord,
  canReverse,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();

  const [payments, setPayments] = useState(initialPayments);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<"" | "SALES" | "PURCHASE">("");
  const [partyId, setPartyId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (nextPage = page, overrides: Record<string, string> = {}) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((nextPage - 1) * pageSize),
        ...(kind ? { kind } : {}),
        ...(partyId ? { partyId } : {}),
        ...overrides,
      });

      const res = await fetch(`/api/payments?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load payments.");

      setPayments(data.payments ?? []);
      setTotalCount(data.totalCount ?? 0);
      setPage(nextPage);
      setExpanded(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load payments.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReverse = async (payment: PaymentRow) => {
    const settled = payment.allocations.length;

    const confirmed = await confirm({
      title: "Reverse this payment?",
      isDestructive: true,
      confirmLabel: "Reverse payment",
      cancelLabel: "Keep it",
      message: (
        <>
          <p>
            An opposing entry is posted for{" "}
            <span className="font-semibold text-fg">
              {formatCurrency(payment.amountMinor, currency)}
            </span>
            , taking it back out of the books.
          </p>
          {settled > 0 && (
            <p className="mt-2">
              {settled === 1 ? "The invoice" : `All ${settled} invoices`} it settled will
              go back to outstanding.
            </p>
          )}
          <p className="mt-2 text-fg-subtle">
            The payment itself is kept and marked as reversed, so the record of what was
            entered and then undone survives. This cannot be undone.
          </p>
        </>
      ),
    });
    if (!confirmed) return;

    setBusyId(payment.id);
    try {
      const res = await fetch(`/api/payments/${payment.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not reverse this payment.");

      toast.success(
        data.invoicesUpdated > 0
          ? `Payment reversed. ${data.invoicesUpdated} ${
              data.invoicesUpdated === 1 ? "invoice is" : "invoices are"
            } outstanding again.`
          : "Payment reversed."
      );
      await load();
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not reverse this payment.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {confirmDialog}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">Payments</h1>
          <p className="text-sm text-fg-subtle mt-1">
            Money received from customers and paid to suppliers, and the invoices it
            settled
          </p>
        </div>
        {canRecord && (
          <Button
            onClick={() => setIsModalOpen(true)}
            className="self-start sm:self-auto"
          >
            + Record payment
          </Button>
        )}
      </div>

      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelectField
            label="Direction"
            value={kind}
            onChange={(e) => {
              const next = e.target.value as "" | "SALES" | "PURCHASE";
              setKind(next);
              void load(1, next ? { kind: next } : {});
            }}
          >
            <option value="">Everything</option>
            <option value="SALES">Received from customers</option>
            <option value="PURCHASE">Paid to suppliers</option>
          </SelectField>

          <SelectField
            label="Counterparty"
            value={partyId}
            onChange={(e) => {
              setPartyId(e.target.value);
              void load(1, e.target.value ? { partyId: e.target.value } : {});
            }}
          >
            <option value="">Everyone</option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>

      {payments.length === 0 ? (
        <Card>
          <EmptyState
            title="No payments yet"
            description={
              kind || partyId
                ? "Nothing matches these filters."
                : "Record a receipt or a payment to settle what is outstanding."
            }
            action={
              canRecord && !kind && !partyId ? (
                <Button onClick={() => setIsModalOpen(true)}>
                  Record the first payment
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <TableWrap>
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                Payments recorded, newest first. Select a row to see what it settled.
              </caption>
              <thead className="bg-raised text-fg-subtle border-b border-line">
                <tr>
                  <th scope="col" className="py-3 px-4 font-semibold">Date</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Counterparty</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Direction</th>
                  <th scope="col" className="py-3 px-4 font-semibold">Reference</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th scope="col" className="py-3 px-4 font-semibold text-right">Applied</th>
                  {canReverse && (
                    <th scope="col" className="py-3 px-4 font-semibold text-right">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((payment) => {
                  const applied = payment.allocations.reduce(
                    (sum, a) => sum + BigInt(a.amountMinor),
                    0n
                  );
                  const onAccount = BigInt(payment.amountMinor) - applied;
                  const isOpen = expanded === payment.id;
                  // Held in a const so TypeScript narrows it inside the JSX
                  // below, rather than needing a non-null assertion there.
                  const reversedAt = payment.reversedAt;
                  const isReversed = reversedAt !== null;

                  return (
                    <Fragment key={payment.id}>
                      <tr
                        className="hover:bg-raised/50 transition-colors cursor-pointer"
                        onClick={() => setExpanded(isOpen ? null : payment.id)}
                      >
                        <td className="py-3 px-4 text-fg-subtle whitespace-nowrap">
                          {formatDate(payment.paymentDate)}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            className="font-medium text-fg hover:text-accent-subtle transition-colors text-left"
                          >
                            {payment.party.name}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          {isReversed ? (
                            <Badge tone="danger">Reversed</Badge>
                          ) : (
                            <Badge
                              tone={payment.kind === "SALES" ? "receivable" : "payable"}
                            >
                              {payment.kind === "SALES" ? "Received" : "Paid"}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-fg-subtle">
                          {payment.reference || payment.method || (
                            <span aria-hidden="true">&mdash;</span>
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                            isReversed ? "text-fg-subtle line-through" : "text-fg"
                          }`}
                        >
                          {formatCurrency(payment.amountMinor, currency)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {/* A reversed payment has no allocations either, so
                              without this it would read as "On account". */}
                          {isReversed ? (
                            <span className="text-danger">Reversed</span>
                          ) : applied > 0n ? (
                            <span className="text-fg-muted">
                              {formatCurrency(applied, currency)}
                            </span>
                          ) : (
                            <span className="text-fg-subtle">On account</span>
                          )}
                        </td>
                        {canReverse && (
                          <td
                            className="py-3 px-4 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {!isReversed && (
                              <Button
                                size="sm"
                                variant="secondary"
                                isLoading={busyId === payment.id}
                                onClick={() => void handleReverse(payment)}
                              >
                                Reverse
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>

                      {isOpen && (
                        <tr className="bg-canvas/60">
                          <td colSpan={canReverse ? 7 : 6} className="py-3 px-4">
                            {isReversed ? (
                              <p className="text-[11px] text-danger">
                                Reversed on {formatDate(reversedAt)}
                                {payment.reversedBy?.name
                                  ? ` by ${payment.reversedBy.name}`
                                  : ""}
                                {payment.reversalReason
                                  ? `: ${payment.reversalReason}`
                                  : "."}{" "}
                                <span className="text-fg-subtle">
                                  An opposing entry was posted, and anything it had
                                  settled is outstanding again.
                                </span>
                              </p>
                            ) : payment.allocations.length === 0 ? (
                              <p className="text-[11px] text-fg-subtle">
                                Held on account as an advance against{" "}
                                {payment.party.name}. It can be applied to a later
                                invoice.
                              </p>
                            ) : (
                              <ul className="space-y-1">
                                {payment.allocations.map((allocation) => (
                                  <li
                                    key={allocation.id}
                                    className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
                                  >
                                    <Link
                                      href={`/invoices/${allocation.invoice.id}`}
                                      className="font-mono text-accent-subtle hover:text-fg transition-colors"
                                    >
                                      {allocation.invoice.number ?? "Draft"}
                                    </Link>
                                    <span className="text-fg-muted">
                                      {formatCurrency(allocation.amountMinor, currency)}{" "}
                                      <span className="text-fg-subtle">
                                        of{" "}
                                        {formatCurrency(
                                          allocation.invoice.totalMinor,
                                          currency
                                        )}
                                      </span>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}

                            {!isReversed && onAccount > 0n && payment.allocations.length > 0 && (
                              <p className="text-[11px] text-fg-subtle mt-2">
                                {formatCurrency(onAccount, currency)} of this payment is
                                still unapplied.
                              </p>
                            )}

                            {payment.notes && (
                              <p className="text-[11px] text-fg-subtle mt-2">
                                {payment.notes}
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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

      {canRecord && (
        <RecordPaymentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onRecorded={() => {
            void load(1);
            // The dashboard and party balances move with a payment, so the
            // server-rendered figures elsewhere need re-fetching too.
            router.refresh();
          }}
          parties={parties}
          currency={currency}
        />
      )}
    </div>
  );
}
