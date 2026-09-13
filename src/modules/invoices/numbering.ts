/**
 * Document numbering.
 *
 * GST requires invoice numbers to be consecutive with no gaps, which rules out
 * deriving them from a count of existing rows: a deleted or cancelled document
 * would renumber everything after it. A counter is allocated instead, inside
 * the same transaction that creates the document, so a rollback releases the
 * number rather than burning it.
 */
import { AppError } from "@/shared/errors/app-error";

/** The Indian financial year runs April to March. */
const FINANCIAL_YEAR_START_MONTH = 3; // zero-based: April

/**
 * The financial year a date falls in, as "2026-27".
 *
 * A date in January 2027 belongs to 2026-27, not 2027-28, which is why this
 * cannot simply use the calendar year.
 */
export function financialYearOf(date: Date): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= FINANCIAL_YEAR_START_MONTH ? year : year - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, "0");

  return `${startYear}-${endShort}`;
}

/** Start and end of a financial year, for period filters and reports. */
export function financialYearRange(financialYear: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(financialYear);
  if (!match) {
    throw new AppError(`Invalid financial year "${financialYear}". Expected "2026-27".`, 400);
  }

  const startYear = Number(match[1]);
  return {
    start: new Date(startYear, FINANCIAL_YEAR_START_MONTH, 1, 0, 0, 0, 0),
    // Last millisecond before the next year begins.
    end: new Date(startYear + 1, FINANCIAL_YEAR_START_MONTH, 1, 0, 0, 0, -1),
  };
}

export const DOCUMENT_TYPES = {
  SALES_INVOICE: "SALES_INVOICE",
  PURCHASE_BILL: "PURCHASE_BILL",
  PAYMENT_RECEIPT: "PAYMENT_RECEIPT",
  CREDIT_NOTE: "CREDIT_NOTE",
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

export const DEFAULT_PREFIXES: Record<DocumentType, string> = {
  SALES_INVOICE: "INV",
  PURCHASE_BILL: "BILL",
  PAYMENT_RECEIPT: "RCPT",
  CREDIT_NOTE: "CN",
};

/** Width of the numeric part, so numbers sort correctly as text. */
const SEQUENCE_WIDTH = 4;

/**
 * Formats an allocated number, e.g. INV/2026-27/0001.
 *
 * Slashes rather than hyphens between the parts, since the financial year
 * already contains a hyphen and "INV-2026-27-0001" is hard to read back.
 */
export function formatDocumentNumber(
  prefix: string,
  financialYear: string,
  sequence: number
): string {
  if (sequence < 1) {
    throw new AppError(`Document sequence must start at 1; received ${sequence}.`, 500);
  }

  return `${prefix}/${financialYear}/${String(sequence).padStart(SEQUENCE_WIDTH, "0")}`;
}

/** Splits a formatted number back into its parts, for search and display. */
export function parseDocumentNumber(
  value: string
): { prefix: string; financialYear: string; sequence: number } | null {
  const match = /^([A-Z0-9]+)\/(\d{4}-\d{2})\/(\d+)$/.exec(value.trim());
  if (!match) return null;

  return {
    prefix: match[1],
    financialYear: match[2],
    sequence: Number(match[3]),
  };
}
