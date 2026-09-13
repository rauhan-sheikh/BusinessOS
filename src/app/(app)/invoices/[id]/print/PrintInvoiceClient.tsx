"use client";

import { useRouter } from "next/navigation";
import { formatCurrency } from "@/shared/utils/currency";
import { amountInWords } from "@/modules/invoices/amount-in-words";
import { Button } from "@/shared/components/ui";

export interface PrintParty {
  name: string;
  gstin: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface PrintInvoice {
  id: string;
  number: string | null;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  kind: "SALES" | "PURCHASE";
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
  party: PrintParty;
  lines: Array<{
    id: string;
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
}

export interface PrintBusiness {
  name: string;
  legalName: string | null;
  gstin: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/** Thousandths back to a readable quantity: 2500 reads as "2.5", 1000 as "1". */
function formatQuantity(quantityMilli: string): string {
  const milli = BigInt(quantityMilli);
  const whole = milli / 1000n;
  const fraction = (milli % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** A party's details, used for both sides of the header. */
function PartyBlock({
  heading,
  name,
  gstin,
  pan,
  address,
  email,
  phone,
}: { heading: string } & PrintParty) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
        {heading}
      </p>
      <p className="text-sm font-bold text-slate-900">{name}</p>
      {address && (
        <p className="text-[11px] text-slate-700 whitespace-pre-line leading-snug">
          {address}
        </p>
      )}
      {gstin && (
        <p className="text-[11px] text-slate-700">
          <span className="text-slate-500">GSTIN:</span>{" "}
          <span className="font-mono font-semibold">{gstin}</span>
        </p>
      )}
      {pan && (
        <p className="text-[11px] text-slate-700">
          <span className="text-slate-500">PAN:</span>{" "}
          <span className="font-mono">{pan}</span>
        </p>
      )}
      {phone && <p className="text-[11px] text-slate-700">{phone}</p>}
      {email && <p className="text-[11px] text-slate-700 break-all">{email}</p>}
    </div>
  );
}

export default function PrintInvoiceClient({
  invoice,
  business,
}: {
  invoice: PrintInvoice;
  business: PrintBusiness;
}) {
  const router = useRouter();
  const currency = business.currency || "INR";

  const isSales = invoice.kind === "SALES";
  const outstanding = BigInt(invoice.totalMinor) - BigInt(invoice.paidMinor);
  const hasIgst = BigInt(invoice.igstMinor) > 0n;
  const anyDiscount = invoice.lines.some((l) => BigInt(l.discountMinor) > 0n);

  // Its own title, because a browser prints the document title into the page
  // header and "BusinessOS" on every page of an invoice is not useful.
  const documentTitle = isSales ? "Tax Invoice" : "Purchase Bill";

  return (
    <div className="print-root bg-slate-100 min-h-screen py-6 print:bg-white print:py-0">
      {/* Screen-only controls. Nothing here reaches paper. */}
      <div className="no-print mx-auto max-w-[210mm] px-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            {documentTitle} {invoice.number ?? "(draft)"}
          </h1>
          <p className="text-xs text-slate-600">
            Use your browser&apos;s print dialog to save this as a PDF.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push(`/invoices/${invoice.id}`)}>
            Back
          </Button>
          <Button onClick={() => window.print()}>Print / Save as PDF</Button>
        </div>
      </div>

      {invoice.status === "DRAFT" && (
        <div className="no-print mx-auto max-w-[210mm] px-4 mb-4">
          <p className="text-[11px] font-medium text-amber-900 bg-amber-100 border border-amber-300 rounded-lg p-3">
            This invoice is still a draft. It has no number and is not in the books, so
            it is not a valid tax invoice yet.
          </p>
        </div>
      )}

      {/* The sheet. Fixed to A4 width so what is on screen is what prints. */}
      <article className="sheet mx-auto bg-white text-slate-900 shadow-sm print:shadow-none">
        <header className="flex justify-between gap-6 pb-4 border-b-2 border-slate-800">
          <div className="space-y-1">
            <h2 className="text-xl font-black tracking-tight">
              {business.legalName || business.name}
            </h2>
            {business.legalName && business.legalName !== business.name && (
              <p className="text-[11px] text-slate-600">trading as {business.name}</p>
            )}
            {business.address && (
              <p className="text-[11px] text-slate-700 whitespace-pre-line leading-snug">
                {business.address}
              </p>
            )}
            <div className="flex flex-wrap gap-x-3 text-[11px] text-slate-700">
              {business.phone && <span>{business.phone}</span>}
              {business.email && <span>{business.email}</span>}
            </div>
            {business.gstin && (
              <p className="text-[11px]">
                <span className="text-slate-500">GSTIN:</span>{" "}
                <span className="font-mono font-semibold">{business.gstin}</span>
              </p>
            )}
            {business.pan && (
              <p className="text-[11px]">
                <span className="text-slate-500">PAN:</span>{" "}
                <span className="font-mono">{business.pan}</span>
              </p>
            )}
          </div>

          <div className="text-right shrink-0 space-y-1">
            <p className="text-base font-black uppercase tracking-[0.2em]">
              {documentTitle}
            </p>
            <table className="ml-auto text-[11px]">
              <caption className="sr-only">Document details</caption>
              <tbody>
                <tr>
                  <td className="pr-3 text-slate-500 text-left">Number</td>
                  <td className="font-mono font-bold text-right">
                    {invoice.number ?? "—"}
                  </td>
                </tr>
                <tr>
                  <td className="pr-3 text-slate-500 text-left">Date</td>
                  <td className="text-right">{formatDate(invoice.issueDate)}</td>
                </tr>
                {invoice.dueDate && (
                  <tr>
                    <td className="pr-3 text-slate-500 text-left">Due</td>
                    <td className="text-right">{formatDate(invoice.dueDate)}</td>
                  </tr>
                )}
                {invoice.placeOfSupply && (
                  <tr>
                    <td className="pr-3 text-slate-500 text-left">Place of supply</td>
                    <td className="text-right">State {invoice.placeOfSupply}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {invoice.status === "CANCELLED" && (
              <p className="inline-block mt-1 px-2 py-0.5 border-2 border-red-600 text-red-700 text-[10px] font-black uppercase tracking-widest">
                Cancelled
              </p>
            )}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-4 border-b border-slate-300">
          <PartyBlock
            heading={isSales ? "Bill to" : "Supplier"}
            name={invoice.party.name}
            gstin={invoice.party.gstin}
            pan={invoice.party.pan}
            address={invoice.party.address}
            email={invoice.party.email}
            phone={invoice.party.phone}
          />
          <PartyBlock
            heading={isSales ? "Supplied by" : "Billed to"}
            name={business.legalName || business.name}
            gstin={business.gstin}
            pan={business.pan}
            address={business.address}
            email={business.email}
            phone={business.phone}
          />
        </section>

        <table className="w-full text-[11px] mt-4 border-collapse">
          <caption className="sr-only">Invoice lines</caption>
          <thead>
            <tr className="bg-slate-100 border-y border-slate-300">
              <th scope="col" className="py-2 px-2 text-left font-bold w-6">#</th>
              <th scope="col" className="py-2 px-2 text-left font-bold">Description</th>
              <th scope="col" className="py-2 px-2 text-left font-bold whitespace-nowrap">HSN/SAC</th>
              <th scope="col" className="py-2 px-2 text-right font-bold">Qty</th>
              <th scope="col" className="py-2 px-2 text-right font-bold">Rate</th>
              {anyDiscount && (
                <th scope="col" className="py-2 px-2 text-right font-bold">Disc.</th>
              )}
              <th scope="col" className="py-2 px-2 text-right font-bold whitespace-nowrap">Taxable</th>
              {invoice.gstTreatment !== "EXEMPT" && (
                <>
                  <th scope="col" className="py-2 px-2 text-right font-bold">%</th>
                  <th scope="col" className="py-2 px-2 text-right font-bold">
                    {hasIgst ? "IGST" : "CGST"}
                  </th>
                  {!hasIgst && (
                    <th scope="col" className="py-2 px-2 text-right font-bold">SGST</th>
                  )}
                </>
              )}
              <th scope="col" className="py-2 px-2 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={line.id} className="border-b border-slate-200 align-top">
                <td className="py-1.5 px-2 text-slate-500">{index + 1}</td>
                <td className="py-1.5 px-2">{line.description}</td>
                <td className="py-1.5 px-2 font-mono text-slate-600">
                  {line.hsnSacCode ?? "—"}
                </td>
                <td className="py-1.5 px-2 text-right whitespace-nowrap">
                  {formatQuantity(line.quantityMilli)}
                  {line.unitOfMeasure ? ` ${line.unitOfMeasure}` : ""}
                </td>
                <td className="py-1.5 px-2 text-right whitespace-nowrap">
                  {formatCurrency(line.unitPriceMinor, currency)}
                </td>
                {anyDiscount && (
                  <td className="py-1.5 px-2 text-right whitespace-nowrap">
                    {BigInt(line.discountMinor) > 0n
                      ? formatCurrency(line.discountMinor, currency)
                      : "—"}
                  </td>
                )}
                <td className="py-1.5 px-2 text-right whitespace-nowrap">
                  {formatCurrency(line.lineSubtotalMinor, currency)}
                </td>
                {invoice.gstTreatment !== "EXEMPT" && (
                  <>
                    <td className="py-1.5 px-2 text-right">
                      {hasIgst ? line.taxRateBps / 100 : line.taxRateBps / 200}%
                    </td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">
                      {formatCurrency(
                        hasIgst ? line.igstMinor : line.cgstMinor,
                        currency
                      )}
                    </td>
                    {!hasIgst && (
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        {formatCurrency(line.sgstMinor, currency)}
                      </td>
                    )}
                  </>
                )}
                <td className="py-1.5 px-2 text-right font-semibold whitespace-nowrap">
                  {formatCurrency(line.lineTotalMinor, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="flex flex-col sm:flex-row justify-between gap-6 mt-4 break-inside-avoid">
          <div className="flex-1 space-y-3 text-[11px]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Amount in words
              </p>
              <p className="font-semibold text-slate-800 leading-snug">
                {amountInWords(BigInt(invoice.totalMinor), currency)}
              </p>
            </div>

            {invoice.gstTreatment === "EXEMPT" && (
              <p className="text-slate-700">
                This supply is exempt from GST. No tax has been charged.
              </p>
            )}

            {invoice.notes && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Notes
                </p>
                <p className="text-slate-700 whitespace-pre-line leading-snug">
                  {invoice.notes}
                </p>
              </div>
            )}

            {invoice.terms && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Terms
                </p>
                <p className="text-slate-700 whitespace-pre-line leading-snug">
                  {invoice.terms}
                </p>
              </div>
            )}
          </div>

          <table className="text-[11px] w-full sm:w-64 shrink-0 self-start">
            <caption className="sr-only">Invoice totals</caption>
            <tbody>
              <tr>
                <td className="py-1 text-slate-600">Taxable value</td>
                <td className="py-1 text-right font-medium whitespace-nowrap">
                  {formatCurrency(invoice.subtotalMinor, currency)}
                </td>
              </tr>
              {BigInt(invoice.discountMinor) > 0n && (
                <tr>
                  <td className="py-1 text-slate-600">Discount applied</td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {formatCurrency(invoice.discountMinor, currency)}
                  </td>
                </tr>
              )}
              {BigInt(invoice.cgstMinor) > 0n && (
                <tr>
                  <td className="py-1 text-slate-600">CGST</td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {formatCurrency(invoice.cgstMinor, currency)}
                  </td>
                </tr>
              )}
              {BigInt(invoice.sgstMinor) > 0n && (
                <tr>
                  <td className="py-1 text-slate-600">SGST</td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {formatCurrency(invoice.sgstMinor, currency)}
                  </td>
                </tr>
              )}
              {hasIgst && (
                <tr>
                  <td className="py-1 text-slate-600">IGST</td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {formatCurrency(invoice.igstMinor, currency)}
                  </td>
                </tr>
              )}
              {BigInt(invoice.roundingMinor) !== 0n && (
                <tr>
                  <td className="py-1 text-slate-600">Rounding</td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {formatCurrency(invoice.roundingMinor, currency)}
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-800">
                <td className="py-1.5 font-black text-sm">Total</td>
                <td className="py-1.5 text-right font-black text-sm whitespace-nowrap">
                  {formatCurrency(invoice.totalMinor, currency)}
                </td>
              </tr>
              {BigInt(invoice.paidMinor) > 0n && (
                <>
                  <tr>
                    <td className="py-1 text-slate-600">Paid</td>
                    <td className="py-1 text-right whitespace-nowrap">
                      {formatCurrency(invoice.paidMinor, currency)}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-300">
                    <td className="py-1 font-bold">Balance due</td>
                    <td className="py-1 text-right font-bold whitespace-nowrap">
                      {formatCurrency(outstanding, currency)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </section>

        <footer className="flex justify-between items-end gap-6 mt-10 pt-4 break-inside-avoid">
          <p className="text-[10px] text-slate-500 max-w-[60%] leading-snug">
            This is a computer-generated document. Amounts are stated in{" "}
            {currency}.
          </p>
          <div className="text-center">
            <div className="h-12" />
            <p className="border-t border-slate-400 pt-1 px-6 text-[11px] font-semibold">
              For {business.legalName || business.name}
            </p>
            <p className="text-[10px] text-slate-500">Authorised signatory</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
