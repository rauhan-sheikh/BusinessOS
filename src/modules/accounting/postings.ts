/**
 * How each business event becomes journal lines.
 *
 * These are the accounting rules of the product, stated once. A service decides
 * that an invoice was issued; this decides what that means to the books.
 */
import type { LedgerAccountKey } from "@/generated/prisma/client";
import {
  debit,
  credit,
  withRoundingAdjustment,
  assertPostable,
  type DraftLine,
} from "./journal";

/**
 * How GST splits on a supply.
 *
 * Within a state a supply attracts CGST and SGST in equal halves; across states
 * it attracts IGST at the full rate. Which applies is decided by comparing the
 * place of supply with the supplier's own state, never by the rate itself.
 */
export type GstTreatment = "INTRA_STATE" | "INTER_STATE" | "EXEMPT";

export interface TaxAmounts {
  cgstMinor: bigint;
  sgstMinor: bigint;
  igstMinor: bigint;
}

export const NO_TAX: TaxAmounts = { cgstMinor: 0n, sgstMinor: 0n, igstMinor: 0n };

export function totalTax(tax: TaxAmounts): bigint {
  return tax.cgstMinor + tax.sgstMinor + tax.igstMinor;
}

/**
 * Splits a tax amount according to the treatment.
 *
 * The halves of an odd CGST/SGST amount cannot both be exact, so the remainder
 * goes to CGST by convention and the two still sum to the total - which matters
 * more than which half carries the extra paisa.
 */
export function splitGst(treatment: GstTreatment, taxMinor: bigint): TaxAmounts {
  if (treatment === "EXEMPT" || taxMinor === 0n) return NO_TAX;

  if (treatment === "INTER_STATE") {
    return { cgstMinor: 0n, sgstMinor: 0n, igstMinor: taxMinor };
  }

  const half = taxMinor / 2n;
  const remainder = taxMinor - half * 2n;
  return { cgstMinor: half + remainder, sgstMinor: half, igstMinor: 0n };
}

const OUTPUT_TAX_ACCOUNTS: Record<keyof TaxAmounts, LedgerAccountKey> = {
  cgstMinor: "GST_OUTPUT_CGST",
  sgstMinor: "GST_OUTPUT_SGST",
  igstMinor: "GST_OUTPUT_IGST",
};

const INPUT_TAX_ACCOUNTS: Record<keyof TaxAmounts, LedgerAccountKey> = {
  cgstMinor: "GST_INPUT_CGST",
  sgstMinor: "GST_INPUT_SGST",
  igstMinor: "GST_INPUT_IGST",
};

function taxLines(
  tax: TaxAmounts,
  accounts: Record<keyof TaxAmounts, LedgerAccountKey>,
  side: "debit" | "credit"
): DraftLine[] {
  const make = side === "debit" ? debit : credit;
  return (Object.keys(accounts) as Array<keyof TaxAmounts>)
    .filter((component) => tax[component] > 0n)
    .map((component) => make(accounts[component], tax[component]));
}

export interface InvoicePosting {
  partyId: string;
  /** Net of tax. */
  subtotalMinor: bigint;
  tax: TaxAmounts;
  /** The rounded figure actually shown on the document. */
  totalMinor: bigint;
}

/**
 * Issuing a sales invoice.
 *
 *   Dr  Accounts Receivable   the total the customer owes
 *     Cr  Sales               the net revenue earned
 *     Cr  Output GST          the tax collected on the government's behalf
 *
 * The tax is a liability, not income: it is collected, not earned.
 */
export function postInvoice({
  partyId,
  subtotalMinor,
  tax,
  totalMinor,
}: InvoicePosting): DraftLine[] {
  const lines = [
    debit("ACCOUNTS_RECEIVABLE", totalMinor, { partyId }),
    credit("SALES", subtotalMinor),
    ...taxLines(tax, OUTPUT_TAX_ACCOUNTS, "credit"),
  ];

  // The document total is rounded, so net plus tax may differ by a sub-unit.
  const balanced = withRoundingAdjustment(lines);
  assertPostable(balanced);
  return balanced;
}

/**
 * Recording a supplier bill. The mirror of an invoice: input tax is an asset,
 * because it is recoverable against output tax rather than being a cost.
 */
export function postBill({
  partyId,
  subtotalMinor,
  tax,
  totalMinor,
}: InvoicePosting): DraftLine[] {
  const lines = [
    credit("ACCOUNTS_PAYABLE", totalMinor, { partyId }),
    debit("PURCHASES", subtotalMinor),
    ...taxLines(tax, INPUT_TAX_ACCOUNTS, "debit"),
  ];

  const balanced = withRoundingAdjustment(lines);
  assertPostable(balanced);
  return balanced;
}

/**
 * Money received from a customer.
 *
 *   Dr  Cash and Bank
 *     Cr  Accounts Receivable
 *
 * No income is recognised here; that happened when the invoice was issued.
 */
export function postPaymentReceived(partyId: string, amountMinor: bigint): DraftLine[] {
  const lines = [
    debit("CASH", amountMinor),
    credit("ACCOUNTS_RECEIVABLE", amountMinor, { partyId }),
  ];
  assertPostable(lines);
  return lines;
}

/** Money paid to a supplier. */
export function postPaymentMade(partyId: string, amountMinor: bigint): DraftLine[] {
  const lines = [
    debit("ACCOUNTS_PAYABLE", amountMinor, { partyId }),
    credit("CASH", amountMinor),
  ];
  assertPostable(lines);
  return lines;
}

/**
 * A balance carried in when a party is first recorded.
 *
 * The other side is equity rather than income: the sale that created the
 * receivable happened before this system was keeping the books, so recognising
 * it as revenue now would overstate the period.
 */
export function postOpeningBalance(
  partyId: string,
  amountMinor: bigint,
  side: "RECEIVABLE" | "PAYABLE"
): DraftLine[] {
  const lines =
    side === "RECEIVABLE"
      ? [
          debit("ACCOUNTS_RECEIVABLE", amountMinor, { partyId }),
          credit("OPENING_BALANCE_EQUITY", amountMinor),
        ]
      : [
          credit("ACCOUNTS_PAYABLE", amountMinor, { partyId }),
          debit("OPENING_BALANCE_EQUITY", amountMinor),
        ];

  assertPostable(lines);
  return lines;
}

/**
 * A manual correction to what a counterparty owes, with no document behind it.
 *
 * Balanced against an expense account rather than silently against equity, so
 * corrections stay visible in the period they were made.
 */
export function postAdjustment(
  partyId: string,
  amountMinor: bigint,
  side: "RECEIVABLE" | "PAYABLE"
): DraftLine[] {
  const lines =
    side === "RECEIVABLE"
      ? [
          debit("ACCOUNTS_RECEIVABLE", amountMinor, { partyId }),
          credit("ADJUSTMENTS", amountMinor),
        ]
      : [
          credit("ACCOUNTS_PAYABLE", amountMinor, { partyId }),
          debit("ADJUSTMENTS", amountMinor),
        ];

  assertPostable(lines);
  return lines;
}
