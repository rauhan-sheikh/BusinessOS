/**
 * Invoice arithmetic.
 *
 * Every figure is an integer in minor units, and quantity is an integer in
 * thousandths, so nothing here passes through a float. The two places rounding
 * is unavoidable - multiplying a fractional quantity by a price, and applying a
 * percentage rate - round half-up explicitly rather than inheriting whatever a
 * float would have done.
 */
import { AppError } from "@/shared/errors/app-error";
import { splitGst, type GstTreatment, type TaxAmounts } from "@/modules/accounting/postings";

/** Quantity is stored in thousandths; GST permits three decimal places. */
export const QUANTITY_SCALE = 1000n;

/** Tax rates are basis points, so 18% is 1800 and no rate is fractional. */
export const RATE_SCALE = 10_000n;

/**
 * Integer division rounding half away from zero.
 *
 * Plain BigInt division truncates, which would quietly shave a paisa off most
 * lines and leave the document total short of the sum of its parts.
 */
export function divideRounded(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new AppError("Division by zero in invoice arithmetic.", 500);
  }

  const negative = numerator < 0n !== denominator < 0n;
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const absDenominator = denominator < 0n ? -denominator : denominator;

  const quotient = absNumerator / absDenominator;
  const remainder = absNumerator % absDenominator;
  // Round up when the remainder is at least half the divisor.
  const rounded = remainder * 2n >= absDenominator ? quotient + 1n : quotient;

  return negative ? -rounded : rounded;
}

export interface LineInput {
  description: string;
  /** Thousandths, so 2.5 units is 2500. */
  quantityMilli: bigint;
  unitPriceMinor: bigint;
  /** Absolute amount off this line, not a percentage. */
  discountMinor?: bigint;
  /** Basis points. */
  taxRateBps?: number;
  hsnSacCode?: string | null;
  unitOfMeasure?: string | null;
  itemId?: string | null;
}

export interface CalculatedLine {
  /** Quantity times price, before discount. */
  grossMinor: bigint;
  discountMinor: bigint;
  /** What tax is charged on. */
  lineSubtotalMinor: bigint;
  taxRateBps: number;
  cgstMinor: bigint;
  sgstMinor: bigint;
  igstMinor: bigint;
  lineTotalMinor: bigint;
}

export interface CalculatedInvoice {
  lines: CalculatedLine[];
  subtotalMinor: bigint;
  discountMinor: bigint;
  cgstMinor: bigint;
  sgstMinor: bigint;
  igstMinor: bigint;
  taxMinor: bigint;
  /** Difference between the computed total and the presented one. */
  roundingMinor: bigint;
  /** What the customer is asked to pay. */
  totalMinor: bigint;
}

function assertSane(line: LineInput, index: number): void {
  const where = `Line ${index + 1}`;

  if (line.quantityMilli <= 0n) {
    throw new AppError(`${where}: quantity must be greater than zero.`, 400);
  }
  if (line.unitPriceMinor < 0n) {
    throw new AppError(`${where}: unit price cannot be negative.`, 400);
  }
  if ((line.discountMinor ?? 0n) < 0n) {
    throw new AppError(`${where}: discount cannot be negative.`, 400);
  }
  if ((line.taxRateBps ?? 0) < 0 || (line.taxRateBps ?? 0) > 10_000) {
    throw new AppError(`${where}: tax rate must be between 0% and 100%.`, 400);
  }
}

/**
 * Tax is computed per line rather than on the invoice subtotal.
 *
 * Lines can carry different rates, so a single calculation on the total would
 * be wrong the moment an invoice mixes 5% and 18% items.
 */
export function calculateLine(
  line: LineInput,
  treatment: GstTreatment,
  index = 0
): CalculatedLine {
  assertSane(line, index);

  const grossMinor = divideRounded(line.quantityMilli * line.unitPriceMinor, QUANTITY_SCALE);
  const discountMinor = line.discountMinor ?? 0n;

  if (discountMinor > grossMinor) {
    throw new AppError(
      `Line ${index + 1}: discount is larger than the line amount.`,
      400
    );
  }

  const lineSubtotalMinor = grossMinor - discountMinor;
  const taxRateBps = line.taxRateBps ?? 0;

  const taxMinor =
    treatment === "EXEMPT"
      ? 0n
      : divideRounded(lineSubtotalMinor * BigInt(taxRateBps), RATE_SCALE);

  const tax: TaxAmounts = splitGst(treatment, taxMinor);

  return {
    grossMinor,
    discountMinor,
    lineSubtotalMinor,
    taxRateBps,
    cgstMinor: tax.cgstMinor,
    sgstMinor: tax.sgstMinor,
    igstMinor: tax.igstMinor,
    lineTotalMinor: lineSubtotalMinor + tax.cgstMinor + tax.sgstMinor + tax.igstMinor,
  };
}

export interface CalculateOptions {
  /**
   * Round the payable total to whole currency units, as Indian invoices
   * commonly do. The difference is carried on the invoice and posted to the
   * rounding account rather than distorting a line.
   */
  roundTotalToUnit?: boolean;
}

const MINOR_UNITS_PER_MAJOR = 100n;

export function calculateInvoice(
  lines: readonly LineInput[],
  treatment: GstTreatment,
  options: CalculateOptions = {}
): CalculatedInvoice {
  if (lines.length === 0) {
    throw new AppError("An invoice needs at least one line.", 400);
  }

  const calculated = lines.map((line, index) => calculateLine(line, treatment, index));

  const sum = (pick: (l: CalculatedLine) => bigint) =>
    calculated.reduce((total, line) => total + pick(line), 0n);

  const subtotalMinor = sum((l) => l.lineSubtotalMinor);
  const discountMinor = sum((l) => l.discountMinor);
  const cgstMinor = sum((l) => l.cgstMinor);
  const sgstMinor = sum((l) => l.sgstMinor);
  const igstMinor = sum((l) => l.igstMinor);
  const taxMinor = cgstMinor + sgstMinor + igstMinor;

  const computedTotal = subtotalMinor + taxMinor;

  let totalMinor = computedTotal;
  let roundingMinor = 0n;

  if (options.roundTotalToUnit) {
    totalMinor = divideRounded(computedTotal, MINOR_UNITS_PER_MAJOR) * MINOR_UNITS_PER_MAJOR;
    roundingMinor = totalMinor - computedTotal;
  }

  return {
    lines: calculated,
    subtotalMinor,
    discountMinor,
    cgstMinor,
    sgstMinor,
    igstMinor,
    taxMinor,
    roundingMinor,
    totalMinor,
  };
}

/**
 * Which GST applies, from the place of supply against the supplier's state.
 *
 * Decided by comparing states, never by the rate: the same 18% is CGST+SGST
 * within a state and IGST across one.
 */
export function resolveGstTreatment(
  supplierStateCode: string | null | undefined,
  placeOfSupplyStateCode: string | null | undefined,
  isExempt = false
): GstTreatment {
  if (isExempt) return "EXEMPT";

  // Without both states the split cannot be decided. Intra-state is the safer
  // default: it is the common case, and being wrong is visible on the invoice
  // rather than silently under-collecting a single combined tax.
  if (!supplierStateCode || !placeOfSupplyStateCode) return "INTRA_STATE";

  return supplierStateCode.trim() === placeOfSupplyStateCode.trim()
    ? "INTRA_STATE"
    : "INTER_STATE";
}

/** The first two digits of a GSTIN are the state code. */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  const trimmed = gstin.trim();
  if (trimmed.length < 2) return null;

  const code = trimmed.slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}
