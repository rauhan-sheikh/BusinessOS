/**
 * Currency and minor-unit helpers for financial calculations.
 *
 * Money is represented throughout BusinessOS as an integer number of minor
 * units held in a BigInt (e.g. Rs. 1,250.50 is 125050n). Nothing in this module
 * routes a monetary value through a JS `number`, so IEEE-754 drift cannot occur.
 *
 * Limitation: the minor-unit exponent is fixed at 2. Currencies with a
 * different exponent (JPY = 0, KWD = 3) are not yet supported; per-transaction
 * currency + exponent is planned alongside the invoicing module.
 */
import { AppError } from "@/shared/errors/app-error";

/** Decimal places in a minor unit. Fixed at 2 - see the module note above. */
export const MINOR_UNIT_EXPONENT = 2;

/**
 * A positive decimal amount in major units, with at most two decimal places.
 * Deliberately rejects signs, exponent notation, thousands separators and
 * excess precision rather than coercing them.
 */
const AMOUNT_PATTERN = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;

function invalidAmount(value: unknown): never {
  throw new AppError(
    `Invalid amount: ${JSON.stringify(String(value))}. Provide a positive number with at most ${MINOR_UNIT_EXPONENT} decimal places.`,
    400
  );
}

/**
 * Converts an amount in major units ("10.50", 10.5) to minor units (1050n).
 *
 * Throws AppError(400) on anything that is not a positive, plainly-written
 * decimal with at most two fraction digits. It never returns a fallback value:
 * a rejected amount must not reach the ledger as a silent zero.
 */
export function toMinorUnits(amount: number | string): bigint {
  let raw: string;

  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) invalidAmount(amount);
    // Number#toString emits exponent notation outside ~1e-7..1e21; the pattern
    // below rejects those rather than letting BigInt() throw a raw SyntaxError.
    raw = amount.toString();
  } else {
    raw = amount.trim();
  }

  if (!AMOUNT_PATTERN.test(raw)) invalidAmount(amount);

  const [whole, fraction = ""] = raw.split(".");
  const paddedFraction = fraction.padEnd(MINOR_UNIT_EXPONENT, "0");

  return BigInt(`${whole || "0"}${paddedFraction}`);
}

/**
 * Renders minor units as an exact decimal string (125050n -> "1250.50").
 * Exact at any magnitude: the value never passes through a `number`.
 * Negative input is preserved - a negative receivable is a customer advance.
 */
export function toDecimalString(minorUnits: bigint | number | string): string {
  const minor = BigInt(minorUnits);
  const isNegative = minor < 0n;
  const digits = (isNegative ? -minor : minor)
    .toString()
    .padStart(MINOR_UNIT_EXPONENT + 1, "0");

  const whole = digits.slice(0, -MINOR_UNIT_EXPONENT);
  const fraction = digits.slice(-MINOR_UNIT_EXPONENT);

  return `${isNegative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Formats minor units as a localised currency string (125050n -> "Rs.1,250.50").
 *
 * Intl.NumberFormat is fed the exact decimal string rather than a number, so
 * large amounts format without precision loss.
 */
export function formatCurrency(
  minorUnits: bigint | number | string,
  currency: string = "INR",
  locale: string = "en-IN"
): string {
  const decimal = toDecimalString(minorUnits);
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: MINOR_UNIT_EXPONENT,
      maximumFractionDigits: MINOR_UNIT_EXPONENT,
    });

    // ECMA-402 (Intl.NumberFormat V3) accepts an arbitrary-precision decimal
    // string, which is what lets large amounts format without going through a
    // lossy `number`. TypeScript's lib type only admits the StringNumericLiteral
    // template type, which a computed string can never satisfy - so widen the
    // signature here rather than misrepresent the value's type.
    const format = formatter.format as (value: string) => string;
    return format(decimal);
  } catch {
    return `${currency} ${decimal}`;
  }
}

/**
 * Converts minor units to a major-unit `number` (125050n -> 1250.5).
 *
 * Lossy above Number.MAX_SAFE_INTEGER minor units. Use it only for interop
 * with APIs that demand a number; prefer toDecimalString/formatCurrency for
 * anything shown to a user or persisted.
 */
export function toMajorUnits(minorUnits: bigint | number | string): number {
  return Number(toDecimalString(minorUnits));
}
