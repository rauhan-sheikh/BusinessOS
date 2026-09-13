/**
 * The written amount exists to make a tampered figure obvious, so it has to
 * agree with the integer it came from at every scale - including the ones a
 * float would have quietly rounded.
 */
import { describe, it, expect } from "vitest";
import { amountInWords, wholeNumberInWords } from "./amount-in-words";

describe("wholeNumberInWords", () => {
  it("writes the irregular teens out rather than composing them", () => {
    expect(wholeNumberInWords(11n)).toBe("Eleven");
    expect(wholeNumberInWords(15n)).toBe("Fifteen");
    expect(wholeNumberInWords(19n)).toBe("Nineteen");
  });

  it("composes the regular tens", () => {
    expect(wholeNumberInWords(20n)).toBe("Twenty");
    expect(wholeNumberInWords(47n)).toBe("Forty Seven");
    expect(wholeNumberInWords(90n)).toBe("Ninety");
  });

  it("groups the Indian way, not in threes", () => {
    // 100000 is one lakh, never "one hundred thousand".
    expect(wholeNumberInWords(100_000n)).toBe("One Lakh");
    expect(wholeNumberInWords(1_00_000n)).toBe("One Lakh");
    expect(wholeNumberInWords(10_000_000n)).toBe("One Crore");
    expect(wholeNumberInWords(1_23_456n)).toBe(
      "One Lakh Twenty Three Thousand Four Hundred Fifty Six"
    );
  });

  it("skips empty groups instead of naming them", () => {
    expect(wholeNumberInWords(1_00_007n)).toBe("One Lakh Seven");
    expect(wholeNumberInWords(1_00_00_000n)).toBe("One Crore");
    expect(wholeNumberInWords(2_00_00_500n)).toBe("Two Crore Five Hundred");
  });

  it("reads beyond ninety-nine crore as a number of crore", () => {
    // 1,200 crore = 1200 * 10^7. The alternative is a group with no name.
    expect(wholeNumberInWords(12_000_000_000n)).toBe("One Thousand Two Hundred Crore");
    expect(wholeNumberInWords(120_000_000_000n)).toBe("Twelve Thousand Crore");
  });

  it("stays exact past what a double could hold", () => {
    // Number.MAX_SAFE_INTEGER is ~9.007e15; this is larger, and the BigInt
    // path must not lose the trailing digits.
    expect(wholeNumberInWords(90_07_19_92_54_74_09_93n)).toContain("Crore");
    expect(wholeNumberInWords(9_007_199_254_740_993n)).toMatch(/Ninety Three$/);
  });

  it("handles zero and negatives", () => {
    expect(wholeNumberInWords(0n)).toBe("Zero");
    expect(wholeNumberInWords(-45n)).toBe("Minus Forty Five");
  });
});

describe("amountInWords", () => {
  it("states rupees and paise the way an invoice does", () => {
    expect(amountInWords(123_456_789n)).toBe(
      "Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Eighty Nine Paise Only"
    );
  });

  it("omits the paise clause when the amount is whole", () => {
    expect(amountInWords(1_000_00n)).toBe("Rupees One Thousand Only");
  });

  it("keeps a single paisa", () => {
    // A rounding difference of one paisa still has to be stated.
    expect(amountInWords(1n)).toBe("Rupees Zero and One Paise Only");
  });

  it("names the minor unit per currency", () => {
    expect(amountInWords(150n, "USD")).toBe("Dollars One and Fifty Cents Only");
    expect(amountInWords(150n, "GBP")).toBe("Pounds One and Fifty Pence Only");
  });

  it("falls back to the code rather than calling euros rupees", () => {
    expect(amountInWords(100n, "JPY")).toBe("JPY One Only");
  });

  it("is case-insensitive about the currency", () => {
    expect(amountInWords(100n, "inr")).toBe("Rupees One Only");
  });

  it("leads with the sign for a credit", () => {
    expect(amountInWords(-50_00n)).toBe("Minus Rupees Fifty Only");
  });

  it("agrees with the digits it was given, at every scale", () => {
    // Spot-checks the property the line exists for: the words and the figure
    // describe the same number.
    const cases: Array<[bigint, string]> = [
      [0n, "Rupees Zero Only"],
      [99n, "Rupees Zero and Ninety Nine Paise Only"],
      [100n, "Rupees One Only"],
      [1_00_00_00_000n, "Rupees One Crore Only"],
    ];

    for (const [minor, expected] of cases) {
      expect(amountInWords(minor), `for ${minor}`).toBe(expected);
    }
  });
});
