"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, toDecimalString } from "@/shared/utils/currency";
import {
  calculateInvoice,
  resolveGstTreatment,
  stateCodeFromGstin,
  type CalculatedInvoice,
  type CalculatedLine,
  type LineInput,
} from "@/modules/invoices/calculate";
import {
  Card,
  CardHeader,
  Button,
  InputField,
  SelectField,
  TextareaField,
  Badge,
  useToast,
} from "@/shared/components/ui";

export interface PartyOption {
  id: string;
  name: string;
  gstin: string | null;
}

export interface ItemOption {
  id: string;
  name: string;
  description: string | null;
  hsnSacCode: string | null;
  unitOfMeasure: string | null;
  /** Minor units as a string, because it crossed the RSC boundary as one. */
  unitPriceMinor: string;
  taxRateBps: number;
}

/** A line as the user is editing it: strings, and possibly incomplete. */
interface DraftLine {
  key: number;
  itemId: string;
  description: string;
  hsnSacCode: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRatePercent: string;
}

let nextKey = 0;
const blankLine = (): DraftLine => ({
  key: nextKey++,
  itemId: "",
  description: "",
  hsnSacCode: "",
  quantity: "1",
  unitPrice: "",
  discount: "",
  taxRatePercent: "18",
});

/**
 * Parses a decimal string to a scaled integer, or null if it is not yet a
 * complete number. Half-typed input is normal while editing, so this reports
 * "not ready" rather than throwing.
 */
function toScaled(value: string, places: number): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!new RegExp(`^\\d+(\\.\\d{1,${places}})?$`).test(trimmed)) return null;

  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt(`${whole}${fraction.padEnd(places, "0")}`);
}

/** Percent as typed to basis points, which is what the server stores. */
function toBasisPoints(percent: string): number | null {
  const trimmed = percent.trim();
  if (!trimmed) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;

  const bps = Math.round(Number(trimmed) * 100);
  return bps > 10_000 ? null : bps;
}

const today = () => new Date().toISOString().slice(0, 10);

interface Preview {
  totals: CalculatedInvoice;
  /** Per-line results, addressed by draft key rather than by position. */
  byKey: Map<number, CalculatedLine>;
}

export default function NewInvoiceClient({
  parties,
  items,
  currency,
  businessGstin,
}: {
  parties: PartyOption[];
  items: ItemOption[];
  currency: string;
  businessGstin: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [kind, setKind] = useState<"SALES" | "PURCHASE">("SALES");
  const [partyId, setPartyId] = useState(parties[0]?.id ?? "");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [isExempt, setIsExempt] = useState(false);
  const [roundTotal, setRoundTotal] = useState(true);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => [blankLine()]);
  const [submitting, setSubmitting] = useState<"draft" | "issue" | null>(null);
  const [error, setError] = useState("");

  const party = parties.find((p) => p.id === partyId) ?? null;

  /**
   * Mirrors the server exactly: the place of supply falls back to the party's
   * own GSTIN state, and the treatment comes from comparing that with ours.
   */
  const treatment = useMemo(
    () =>
      resolveGstTreatment(
        stateCodeFromGstin(businessGstin),
        stateCodeFromGstin(party?.gstin),
        isExempt
      ),
    [businessGstin, party?.gstin, isExempt]
  );

  /**
   * The preview runs the same calculation the server will, so what is shown
   * here cannot drift from what gets posted. Lines that are not yet complete
   * are skipped rather than guessed at.
   */
  const preview = useMemo<Preview | null>(() => {
    const usable: LineInput[] = [];
    const keys: number[] = [];

    for (const line of lines) {
      const quantityMilli = toScaled(line.quantity, 3);
      const unitPriceMinor = toScaled(line.unitPrice, 2);
      const taxRateBps = toBasisPoints(line.taxRatePercent);

      if (!quantityMilli || quantityMilli <= 0n) continue;
      if (unitPriceMinor === null || taxRateBps === null) continue;

      usable.push({
        description: line.description || "Item",
        quantityMilli,
        unitPriceMinor,
        discountMinor: toScaled(line.discount, 2) ?? 0n,
        taxRateBps,
      });
      keys.push(line.key);
    }

    if (usable.length === 0) return null;

    try {
      const totals = calculateInvoice(usable, treatment, {
        roundTotalToUnit: roundTotal,
      });
      return {
        totals,
        byKey: new Map(keys.map((key, index) => [key, totals.lines[index]])),
      };
    } catch {
      // A discount larger than its line is still invalid; the preview waits
      // rather than showing a figure the server would reject.
      return null;
    }
  }, [lines, treatment, roundTotal]);

  const updateLine = (key: number, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  /**
   * An item supplies defaults only - its values are copied onto the line, not
   * referenced, so editing the item later never rewrites this invoice.
   */
  const applyItem = (key: number, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      updateLine(key, { itemId: "" });
      return;
    }

    updateLine(key, {
      itemId,
      description: item.description || item.name,
      hsnSacCode: item.hsnSacCode ?? "",
      unitPrice: toDecimalString(item.unitPriceMinor),
      taxRatePercent: String(item.taxRateBps / 100),
    });
  };

  const submit = async (mode: "draft" | "issue") => {
    setError("");

    if (!partyId) {
      setError("Choose a counterparty.");
      return;
    }
    if (!preview) {
      setError("Add at least one line with a quantity, a price and a valid tax rate.");
      return;
    }
    if (lines.some((l) => preview.byKey.has(l.key) && !l.description.trim())) {
      setError("Every line needs a description.");
      return;
    }

    setSubmitting(mode);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId,
          kind,
          issueDate,
          dueDate: dueDate || null,
          isExempt,
          roundTotalToUnit: roundTotal,
          notes: notes || undefined,
          terms: terms || undefined,
          // Only the lines the preview accepted, so what was totalled on screen
          // is exactly what is sent.
          lines: lines
            .filter((l) => preview.byKey.has(l.key))
            .map((l) => ({
              description: l.description.trim(),
              quantityMilli: l.quantity.trim(),
              unitPriceMinor: l.unitPrice.trim(),
              ...(l.discount.trim() ? { discountMinor: l.discount.trim() } : {}),
              taxRateBps: toBasisPoints(l.taxRatePercent) ?? 0,
              ...(l.hsnSacCode.trim() ? { hsnSacCode: l.hsnSacCode.trim() } : {}),
              ...(l.itemId ? { itemId: l.itemId } : {}),
            })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not save this invoice."
        );
      }

      const invoiceId: string = data.invoice.id;

      if (mode === "draft") {
        toast.success("Draft saved.");
        router.push(`/invoices/${invoiceId}`);
        router.refresh();
        return;
      }

      const issued = await fetch(`/api/invoices/${invoiceId}/issue`, { method: "POST" });
      const issuedData = await issued.json();

      if (!issued.ok) {
        // The draft was saved; only numbering and posting failed. Saying so
        // stops the user re-entering an invoice that already exists.
        setError(
          `Saved as a draft, but it could not be issued: ${
            typeof issuedData.error === "string" ? issuedData.error : "unknown error"
          } You can issue it from the invoice list.`
        );
        router.refresh();
        return;
      }

      toast.success(`Issued ${issuedData.invoice.number}.`);
      router.push(`/invoices/${invoiceId}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save this invoice.");
    } finally {
      setSubmitting(null);
    }
  };

  const treatmentLabel =
    treatment === "EXEMPT"
      ? "Exempt — no GST"
      : treatment === "INTER_STATE"
        ? "Inter-state — IGST"
        : "Intra-state — CGST + SGST";

  if (parties.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-fg">New invoice</h1>
        <Card className="p-6 text-center space-y-3">
          <p className="text-sm font-medium text-fg-muted">You need a counterparty first</p>
          <p className="text-xs text-fg-subtle max-w-sm mx-auto">
            An invoice is always addressed to someone, so add a customer or supplier
            before creating one.
          </p>
          <div className="pt-2">
            <Button onClick={() => router.push("/parties")}>Go to parties</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">New invoice</h1>
          <p className="text-sm text-fg-subtle mt-1">
            Save a draft to finish later, or issue it to number it and post it to the
            books
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => router.push("/invoices")}
          className="self-start sm:self-auto"
        >
          Back to invoices
        </Button>
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SelectField
            label="Type"
            value={kind}
            onChange={(e) => setKind(e.target.value as "SALES" | "PURCHASE")}
          >
            <option value="SALES">Sales invoice</option>
            <option value="PURCHASE">Supplier bill</option>
          </SelectField>

          <SelectField
            label={kind === "SALES" ? "Customer" : "Supplier"}
            required
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
          >
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>

          <InputField
            label="Issue date"
            type="date"
            required
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            hint="Sets the financial year the number comes from"
          />

          <InputField
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            hint="Used by the aging report"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
          <Badge tone={treatment === "EXEMPT" ? "neutral" : "info"}>{treatmentLabel}</Badge>
          <p className="text-[11px] text-fg-subtle">
            Decided by comparing your GSTIN state with the counterparty&apos;s, never by
            the rate.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
          <label className="flex items-center gap-2 text-[11px] text-fg-muted">
            <input
              type="checkbox"
              checked={isExempt}
              onChange={(e) => setIsExempt(e.target.checked)}
              className="rounded border-line bg-canvas accent-accent"
            />
            This supply is exempt from GST
          </label>
          <label className="flex items-center gap-2 text-[11px] text-fg-muted">
            <input
              type="checkbox"
              checked={roundTotal}
              onChange={(e) => setRoundTotal(e.target.checked)}
              className="rounded border-line bg-canvas accent-accent"
            />
            Round the payable total to whole units
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Lines"
          description="Tax is worked out per line, so lines may carry different rates."
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setLines((c) => [...c, blankLine()])}
            >
              + Add line
            </Button>
          }
        />
        <div className="p-4 sm:p-6 space-y-4">
          {lines.map((line, index) => {
            const calculated = preview?.byKey.get(line.key);

            return (
              <fieldset
                key={line.key}
                className="rounded-xl border border-line bg-canvas p-4 space-y-3"
              >
                <legend className="px-1 text-[11px] font-semibold text-fg-subtle">
                  Line {index + 1}
                </legend>

                {items.length > 0 && (
                  <SelectField
                    label="From the catalogue"
                    value={line.itemId}
                    onChange={(e) => applyItem(line.key, e.target.value)}
                    hint="Fills the fields below; you can still change them."
                  >
                    <option value="">Enter manually</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </SelectField>
                )}

                <InputField
                  label="Description"
                  required
                  value={line.description}
                  onChange={(e) => updateLine(line.key, { description: e.target.value })}
                  placeholder="e.g. Consulting services, March"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <InputField
                    label="HSN / SAC"
                    value={line.hsnSacCode}
                    onChange={(e) => updateLine(line.key, { hsnSacCode: e.target.value })}
                    placeholder="998311"
                  />
                  <InputField
                    label="Quantity"
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    placeholder="1"
                  />
                  <InputField
                    label={`Unit price (${currency})`}
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                    placeholder="0.00"
                  />
                  <InputField
                    label={`Discount (${currency})`}
                    inputMode="decimal"
                    value={line.discount}
                    onChange={(e) => updateLine(line.key, { discount: e.target.value })}
                    placeholder="0.00"
                  />
                  <InputField
                    label="Tax rate (%)"
                    inputMode="decimal"
                    disabled={isExempt}
                    value={line.taxRatePercent}
                    onChange={(e) =>
                      updateLine(line.key, { taxRatePercent: e.target.value })
                    }
                    placeholder="18"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-[11px] text-fg-subtle">
                    {calculated
                      ? `Line total ${formatCurrency(calculated.lineTotalMinor, currency)}`
                      : "Enter a quantity and price to see this line's total"}
                  </p>
                  {lines.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setLines((c) => c.filter((l) => l.key !== line.key))}
                      aria-label={`Remove line ${index + 1}`}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </fieldset>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 sm:p-6 space-y-4">
          <TextareaField
            label="Notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Shown on the invoice"
            className="resize-none"
          />
          <TextareaField
            label="Terms"
            rows={2}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="e.g. Payment due within 30 days"
            className="resize-none"
          />
        </Card>

        <Card className="p-4 sm:p-6 space-y-3">
          <h2 className="text-sm font-bold text-fg">Totals</h2>
          {!preview ? (
            <p className="text-[11px] text-fg-subtle">
              Totals appear once a line has a quantity and a price.
            </p>
          ) : (
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">Subtotal</dt>
                <dd className="text-fg-muted font-medium">
                  {formatCurrency(preview.totals.subtotalMinor, currency)}
                </dd>
              </div>
              {preview.totals.discountMinor > 0n && (
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">Discount applied</dt>
                  <dd className="text-fg-muted">
                    {formatCurrency(preview.totals.discountMinor, currency)}
                  </dd>
                </div>
              )}
              {preview.totals.cgstMinor > 0n && (
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">CGST</dt>
                  <dd className="text-fg-muted">
                    {formatCurrency(preview.totals.cgstMinor, currency)}
                  </dd>
                </div>
              )}
              {preview.totals.sgstMinor > 0n && (
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">SGST</dt>
                  <dd className="text-fg-muted">
                    {formatCurrency(preview.totals.sgstMinor, currency)}
                  </dd>
                </div>
              )}
              {preview.totals.igstMinor > 0n && (
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">IGST</dt>
                  <dd className="text-fg-muted">
                    {formatCurrency(preview.totals.igstMinor, currency)}
                  </dd>
                </div>
              )}
              {preview.totals.roundingMinor !== 0n && (
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">Rounding</dt>
                  <dd className="text-fg-muted">
                    {formatCurrency(preview.totals.roundingMinor, currency)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 pt-2 border-t border-line">
                <dt className="font-bold text-fg">Total</dt>
                <dd className="font-bold text-fg text-base">
                  {formatCurrency(preview.totals.totalMinor, currency)}
                </dd>
              </div>
            </dl>
          )}
        </Card>
      </div>

      {error && (
        <p
          role="alert"
          className="text-[11px] text-danger font-medium bg-danger/10 border border-danger/20 p-3 rounded-xl"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
        <Button
          variant="secondary"
          isLoading={submitting === "draft"}
          loadingLabel="Saving..."
          disabled={submitting !== null}
          onClick={() => void submit("draft")}
          fullWidth
          className="sm:w-auto"
        >
          Save as draft
        </Button>
        <Button
          isLoading={submitting === "issue"}
          loadingLabel="Issuing..."
          disabled={submitting !== null}
          onClick={() => void submit("issue")}
          fullWidth
          className="sm:w-auto"
        >
          Save and issue
        </Button>
      </div>
    </div>
  );
}
