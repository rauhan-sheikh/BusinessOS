/**
 * Amounts written out in words, for the line Indian invoices carry beneath the
 * total.
 *
 * It is there to make tampering obvious: altering a figure is easy, altering a
 * figure and its written form consistently is less so. That only works if the
 * words are derived from the same integer the total is, which is why this takes
 * minor units and never a formatted string.
 *
 * The Indian numbering system groups as crore / lakh / thousand rather than in
 * threes, so "1,00,000" is one lakh and not one hundred thousand. Nothing here
 * passes through a Number: a BigInt is divided down, so a crore-scale invoice
 * reads correctly.
 */

const UNITS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
] as const;

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
] as const;

/** 0-99. The teens are irregular, so they are spelled out rather than composed. */
function underHundred(value: number): string {
  if (value < 20) return UNITS[value];

  const tens = TENS[Math.floor(value / 10)];
  const unit = value % 10;
  return unit === 0 ? tens : `${tens} ${UNITS[unit]}`;
}

/** 0-999. */
function underThousand(value: number): string {
  if (value < 100) return underHundred(value);

  const hundreds = `${UNITS[Math.floor(value / 100)]} Hundred`;
  const rest = value % 100;
  return rest === 0 ? hundreds : `${hundreds} ${underHundred(rest)}`;
}

const CRORE = 10_000_000n;
const LAKH = 100_000n;
const THOUSAND = 1_000n;

/**
 * A whole number in words, grouped the Indian way.
 *
 * Above ninety-nine crore the leading group is read as a plain number of
 * crore ("One Thousand Two Hundred Crore"), which is the usual convention.
 */
export function wholeNumberInWords(value: bigint): string {
  if (value < 0n) return `Minus ${wholeNumberInWords(-value)}`;
  if (value === 0n) return "Zero";

  const parts: string[] = [];
  let remaining = value;

  const crore = remaining / CRORE;
  if (crore > 0n) {
    // Recursing keeps arbitrarily large amounts readable rather than
    // overflowing into a group with no name.
    parts.push(`${wholeNumberInWords(crore)} Crore`);
    remaining %= CRORE;
  }

  const lakh = remaining / LAKH;
  if (lakh > 0n) {
    parts.push(`${underHundred(Number(lakh))} Lakh`);
    remaining %= LAKH;
  }

  const thousand = remaining / THOUSAND;
  if (thousand > 0n) {
    parts.push(`${underHundred(Number(thousand))} Thousand`);
    remaining %= THOUSAND;
  }

  if (remaining > 0n) {
    parts.push(underThousand(Number(remaining)));
  }

  return parts.join(" ");
}

export interface CurrencyWords {
  /** Plural name of the major unit, e.g. "Rupees". */
  major: string;
  /** Plural name of the minor unit, e.g. "Paise". */
  minor: string;
}

/**
 * Names per currency. Only currencies with a two-decimal minor unit can be
 * represented at all - see the note in shared/utils/currency.ts - so this list
 * covers what the app supports rather than every ISO code.
 */
const CURRENCY_WORDS: Record<string, CurrencyWords> = {
  INR: { major: "Rupees", minor: "Paise" },
  USD: { major: "Dollars", minor: "Cents" },
  EUR: { major: "Euros", minor: "Cents" },
  GBP: { major: "Pounds", minor: "Pence" },
  AED: { major: "Dirhams", minor: "Fils" },
  SGD: { major: "Dollars", minor: "Cents" },
};

const MINOR_PER_MAJOR = 100n;

/**
 * Writes minor units out in full, as an invoice states them.
 *
 * 123456789n in INR becomes
 * "Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Eighty
 * Nine Paise Only".
 *
 * An unknown currency falls back to its code, so the line stays truthful rather
 * than silently calling euros rupees.
 */
export function amountInWords(minorUnits: bigint, currency = "INR"): string {
  const negative = minorUnits < 0n;
  const absolute = negative ? -minorUnits : minorUnits;

  const major = absolute / MINOR_PER_MAJOR;
  const minor = absolute % MINOR_PER_MAJOR;

  const names = CURRENCY_WORDS[currency.toUpperCase()] ?? {
    major: currency.toUpperCase(),
    minor: "Cents",
  };

  const parts = [names.major, wholeNumberInWords(major)];

  if (minor > 0n) {
    parts.push("and", underHundred(Number(minor)), names.minor);
  }

  parts.push("Only");

  // "Minus" leads, because a credit stated as a positive amount with the sign
  // buried at the end would be read wrong at a glance.
  return `${negative ? "Minus " : ""}${parts.join(" ")}`;
}
