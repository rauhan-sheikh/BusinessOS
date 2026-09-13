"use client";

import { useCallback, useRef, useState } from "react";
import { formatCurrency } from "@/shared/utils/currency";
import {
  Modal,
  Button,
  InputField,
  SelectField,
  TextareaField,
  Badge,
  Spinner,
  useToast,
} from "@/shared/components/ui";

export interface PartyOption {
  id: string;
  name: string;
}

/** An invoice this payment could be applied to. */
interface OpenInvoice {
  id: string;
  number: string | null;
  issueDate: string;
  dueDate: string | null;
  totalMinor: string;
  paidMinor: string;
  outstandingMinor: bigint;
}

type Mode = "auto" | "manual" | "onAccount";

/** Money as typed to minor units, or null while it is still incomplete. */
function toMinor(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;

  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt(`${whole}${fraction.padEnd(2, "0")}`);
}

function toDecimal(minor: bigint): string {
  const negative = minor < 0n;
  const digits = (negative ? -minor : minor).toString().padStart(3, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onRecorded,
  parties,
  currency,
}: {
  isOpen: boolean;
  onClose: () => void;
  onRecorded: () => void;
  parties: PartyOption[];
  currency: string;
}) {
  const toast = useToast();

  const [kind, setKind] = useState<"SALES" | "PURCHASE">("SALES");
  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [manual, setManual] = useState<Record<string, string>>({});

  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const amountMinor = toMinor(amount);

  /**
   * Which request is current, so a slow reply for a counterparty the user has
   * already moved away from cannot overwrite a newer list.
   */
  const requestId = useRef(0);

  const reset = useCallback(() => {
    // Invalidates any in-flight load, so a reply arriving after the modal has
    // been reset cannot repopulate it.
    requestId.current += 1;
    setKind("SALES");
    setPartyId("");
    setAmount("");
    setPaymentDate(today());
    setMethod("");
    setReference("");
    setNotes("");
    setMode("auto");
    setManual({});
    setOpenInvoices([]);
    setError("");
  }, []);

  /**
   * Loads the open documents for a counterparty.
   *
   * Driven by the change handlers rather than by an effect: the fetch is a
   * consequence of the user picking someone, not of this component rendering,
   * and the modal always opens with no counterparty selected.
   *
   * The list endpoint filters by a single status, and "open" spans two
   * (ISSUED and PARTIALLY_PAID), so the narrowing happens here on outstanding
   * amount - which is the real question anyway.
   */
  const loadOpenInvoices = async (
    nextPartyId: string,
    nextKind: "SALES" | "PURCHASE"
  ) => {
    setOpenInvoices([]);
    setManual({});

    if (!nextPartyId) return;

    const id = ++requestId.current;
    setLoadingInvoices(true);

    try {
      const params = new URLSearchParams({
        partyId: nextPartyId,
        kind: nextKind,
        limit: "100",
      });

      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load open invoices.");

      if (id !== requestId.current) return;

      const open = (data.invoices as Omit<OpenInvoice, "outstandingMinor">[])
        .map((invoice) => ({
          ...invoice,
          outstandingMinor: BigInt(invoice.totalMinor) - BigInt(invoice.paidMinor),
        }))
        .filter((invoice) => invoice.outstandingMinor > 0n)
        .sort((a, b) => a.issueDate.localeCompare(b.issueDate));

      setOpenInvoices(open);
    } catch (err: unknown) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : "Could not load open invoices.");
    } finally {
      if (id === requestId.current) setLoadingInvoices(false);
    }
  };

  const totalOutstanding = openInvoices.reduce(
    (sum, invoice) => sum + invoice.outstandingMinor,
    0n
  );

  /**
   * What the chosen mode would apply to each invoice, as minor units.
   *
   * Computed during render rather than wrapped in useMemo: these are cheap
   * reductions over a capped list, and the compiler memoizes them anyway.
   */
  function allocatedFor(): bigint {
    if (mode === "onAccount" || amountMinor === null) return 0n;

    if (mode === "manual") {
      return Object.values(manual).reduce<bigint>(
        (sum, value) => sum + (toMinor(value) ?? 0n),
        0n
      );
    }

    // Automatic settles oldest first and stops when the money runs out, which
    // is what the server will do with the same figures.
    let remaining = amountMinor;
    let applied = 0n;
    for (const invoice of openInvoices) {
      if (remaining <= 0n) break;
      const take =
        remaining < invoice.outstandingMinor ? remaining : invoice.outstandingMinor;
      applied += take;
      remaining -= take;
    }
    return applied;
  }

  const allocated = allocatedFor();

  const unallocated = amountMinor === null ? 0n : amountMinor - allocated;

  /** A manual line that exceeds what the invoice still owes. */
  const overAllocatedIds =
    mode === "manual"
      ? new Set(
          openInvoices
            .filter(
              (invoice) =>
                (toMinor(manual[invoice.id] ?? "") ?? 0n) > invoice.outstandingMinor
            )
            .map((invoice) => invoice.id)
        )
      : new Set<string>();

  const fillManual = () => {
    if (amountMinor === null) return;

    // Pre-fills with the automatic split so a manual allocation starts from
    // something sensible rather than from nothing.
    let remaining = amountMinor;
    const next: Record<string, string> = {};

    for (const invoice of openInvoices) {
      if (remaining <= 0n) break;
      const take = remaining < invoice.outstandingMinor ? remaining : invoice.outstandingMinor;
      next[invoice.id] = toDecimal(take);
      remaining -= take;
    }

    setManual(next);
  };

  const submit = async () => {
    setError("");

    if (!partyId) {
      setError("Choose a counterparty.");
      return;
    }
    if (amountMinor === null || amountMinor <= 0n) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (mode === "manual") {
      if (overAllocatedIds.size > 0) {
        setError("One of the allocations is more than that invoice still owes.");
        return;
      }
      if (allocated > amountMinor) {
        setError("The allocations add up to more than the payment.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        partyId,
        kind,
        amountMinor: amount.trim(),
        paymentDate,
        ...(method ? { method } : {}),
        ...(reference ? { reference } : {}),
        ...(notes ? { notes } : {}),
      };

      // Omitting allocations means "settle oldest first"; an empty array means
      // "hold all of it on account". The two are deliberately different, so the
      // field is only set for the modes that mean them.
      if (mode === "onAccount") {
        body.allocations = [];
      } else if (mode === "manual") {
        body.allocations = openInvoices
          .map((invoice) => ({
            invoiceId: invoice.id,
            amountMinor: (manual[invoice.id] ?? "").trim(),
          }))
          .filter((a) => (toMinor(a.amountMinor) ?? 0n) > 0n);
      }

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not record this payment."
        );
      }

      const settled = data.payment.allocations?.length ?? 0;
      toast.success(
        settled > 0
          ? `Payment recorded and applied to ${settled} ${
              settled === 1 ? "invoice" : "invoices"
            }.`
          : "Payment recorded and held on account."
      );

      reset();
      onRecorded();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not record this payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const isReceipt = kind === "SALES";

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!submitting) {
          reset();
          onClose();
        }
      }}
      title={isReceipt ? "Record a receipt" : "Record a payment"}
      description={
        isReceipt
          ? "Money received from a customer, applied to what they owe."
          : "Money paid to a supplier, applied to what you owe them."
      }
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <Button
            variant="secondary"
            disabled={submitting}
            onClick={() => {
              reset();
              onClose();
            }}
            fullWidth
            className="sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            isLoading={submitting}
            loadingLabel="Recording..."
            onClick={() => void submit()}
            fullWidth
            className="sm:w-auto"
          >
            Record {isReceipt ? "receipt" : "payment"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="Direction"
            value={kind}
            onChange={(e) => {
              const next = e.target.value as "SALES" | "PURCHASE";
              setKind(next);
              void loadOpenInvoices(partyId, next);
            }}
          >
            <option value="SALES">Received from a customer</option>
            <option value="PURCHASE">Paid to a supplier</option>
          </SelectField>

          <SelectField
            label={isReceipt ? "Customer" : "Supplier"}
            required
            value={partyId}
            onChange={(e) => {
              setPartyId(e.target.value);
              void loadOpenInvoices(e.target.value, kind);
            }}
          >
            <option value="">Choose one</option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </SelectField>

          <InputField
            label={`Amount (${currency})`}
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            error={
              amount.trim() && amountMinor === null
                ? "Use digits and at most two decimal places."
                : undefined
            }
          />

          <InputField
            label="Date"
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />

          <InputField
            label="Method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="e.g. Bank transfer, UPI, cash"
          />

          <InputField
            label="Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. UTR or cheque number"
          />
        </div>

        <fieldset className="rounded-xl border border-line bg-canvas p-4 space-y-3">
          <legend className="px-1 text-[11px] font-semibold text-fg-subtle">
            How to apply it
          </legend>

          {!partyId ? (
            <p className="text-[11px] text-fg-subtle">
              Choose a counterparty to see what is outstanding.
            </p>
          ) : loadingInvoices ? (
            <p className="flex items-center gap-2 text-[11px] text-fg-subtle">
              <Spinner /> Loading open invoices...
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={openInvoices.length > 0 ? "payable" : "neutral"}>
                  {openInvoices.length} open
                </Badge>
                <span className="text-[11px] text-fg-subtle">
                  {formatCurrency(totalOutstanding, currency)} outstanding in total
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {(
                  [
                    ["auto", "Settle oldest first", "Applies the payment across open invoices in order."],
                    ["manual", "Choose the amounts", "Decide what goes against each invoice."],
                    ["onAccount", "Hold on account", "Records the money without settling anything yet."],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className="flex items-start gap-2 text-[11px] text-fg-muted cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="allocation-mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => {
                        setMode(value);
                        if (value === "manual") fillManual();
                      }}
                      className="mt-0.5 accent-accent"
                    />
                    <span>
                      <span className="font-medium text-fg">{label}</span>
                      <span className="block text-fg-subtle">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              {openInvoices.length === 0 ? (
                <p className="text-[11px] text-fg-subtle">
                  Nothing is outstanding for this counterparty, so the payment will be
                  held on account whichever option is chosen.
                </p>
              ) : (
                mode === "manual" && (
                  <div className="space-y-2 pt-1">
                    {openInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[11px] text-fg truncate">
                            {invoice.number ?? "Draft"}
                          </p>
                          <p className="text-[11px] text-fg-subtle">
                            issued {formatDate(invoice.issueDate)} &middot;{" "}
                            {formatCurrency(invoice.outstandingMinor, currency)} due
                          </p>
                        </div>
                        <div className="w-full sm:w-40">
                          <InputField
                            label="Apply"
                            inputMode="decimal"
                            value={manual[invoice.id] ?? ""}
                            onChange={(e) =>
                              setManual((current) => ({
                                ...current,
                                [invoice.id]: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                            error={
                              overAllocatedIds.has(invoice.id)
                                ? "More than is owed"
                                : undefined
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {amountMinor !== null && amountMinor > 0n && (
                <dl className="space-y-1 pt-2 border-t border-line text-[11px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-subtle">Applied to invoices</dt>
                    <dd className="text-fg-muted font-medium">
                      {formatCurrency(allocated, currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-fg-subtle">
                      {unallocated < 0n ? "Over-allocated" : "Held on account"}
                    </dt>
                    <dd
                      className={
                        unallocated < 0n ? "text-danger font-medium" : "text-fg-muted"
                      }
                    >
                      {formatCurrency(unallocated, currency)}
                    </dd>
                  </div>
                </dl>
              )}

              {unallocated > 0n && mode !== "onAccount" && openInvoices.length > 0 && (
                <p className="text-[11px] text-fg-subtle">
                  The remainder stays as an advance against this counterparty and can be
                  applied to a later invoice.
                </p>
              )}
            </>
          )}
        </fieldset>

        <TextareaField
          label="Notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything worth recording about this payment"
          className="resize-none"
        />

        {error && (
          <p
            role="alert"
            className="text-[11px] text-danger font-medium bg-danger/10 border border-danger/20 p-3 rounded-xl"
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
