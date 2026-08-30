/**
 * Currency and Minor Unit conversion helpers for financial calculations.
 * Always prevents floating-point inaccuracies by using integers/BigInt.
 */

/**
 * Converts a numeric or decimal string amount in major units (e.g. 10.50, "10.50")
 * to minor units integer (e.g. 1050).
 */
export function toMinorUnits(amount: number | string): bigint {
  const parsed = typeof amount === "number" ? amount.toString() : amount.trim();
  if (!parsed || isNaN(Number(parsed))) {
    return BigInt(0);
  }

  const [whole, fraction = ""] = parsed.split(".");
  const paddedFraction = fraction.padEnd(2, "0").slice(0, 2);
  const minorString = `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, "") || "0";

  return BigInt(minorString);
}

/**
 * Converts minor units integer (e.g. 1050n) to standard major decimal number (e.g. 10.5).
 */
export function toMajorUnits(minorUnits: bigint | number | string): number {
  const minor = typeof minorUnits === "bigint" ? Number(minorUnits) : Number(minorUnits || 0);
  return minor / 100;
}

/**
 * Formats minor units (e.g. 125050n) to standard formatted currency string (e.g. "₹1,250.50").
 */
export function formatCurrency(
  minorUnits: bigint | number | string,
  currency: string = "INR",
  locale: string = "en-IN"
): string {
  const major = toMajorUnits(minorUnits);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}
