import { describe, it, expect } from "vitest";
import {
  divideRounded,
  calculateLine,
  calculateInvoice,
  resolveGstTreatment,
  stateCodeFromGstin,
  type LineInput,
} from "./calculate";
import { AppError } from "@/shared/errors/app-error";

const line = (over: Partial<LineInput> = {}): LineInput => ({
  description: "Widget",
  quantityMilli: 1000n,
  unitPriceMinor: 100_00n,
  ...over,
});

describe("divideRounded", () => {
  it("rounds half away from zero rather than truncating", () => {
    // Plain BigInt division truncates, which would shave a paisa off most
    // lines and leave the total short of the sum of its parts.
    expect(divideRounded(5n, 2n)).toBe(3n);
    expect(divideRounded(4n, 2n)).toBe(2n);
    expect(divideRounded(3n, 2n)).toBe(2n);
    expect(divideRounded(1n, 3n)).toBe(0n);
    expect(divideRounded(2n, 3n)).toBe(1n);
  });

  it("rounds negatives symmetrically", () => {
    expect(divideRounded(-5n, 2n)).toBe(-3n);
    expect(divideRounded(5n, -2n)).toBe(-3n);
  });

  it("refuses division by zero rather than returning nonsense", () => {
    expect(() => divideRounded(1n, 0n)).toThrow(AppError);
  });
});

describe("a single line", () => {
  it("multiplies a whole quantity by the price", () => {
    const result = calculateLine(line({ quantityMilli: 3000n }), "EXEMPT");
    expect(result.grossMinor).toBe(300_00n);
  });

  it("handles a fractional quantity", () => {
    // 2.5 units at Rs.100.00
    const result = calculateLine(
      line({ quantityMilli: 2500n, unitPriceMinor: 100_00n }),
      "EXEMPT"
    );
    expect(result.grossMinor).toBe(250_00n);
  });

  it("rounds a quantity that does not divide evenly", () => {
    // 0.333 units at Rs.10.00 is Rs.3.33
    const result = calculateLine(
      line({ quantityMilli: 333n, unitPriceMinor: 10_00n }),
      "EXEMPT"
    );
    expect(result.grossMinor).toBe(3_33n);
  });

  it("takes the discount off before tax", () => {
    const result = calculateLine(
      line({ unitPriceMinor: 100_00n, discountMinor: 10_00n, taxRateBps: 1800 }),
      "INTRA_STATE"
    );

    expect(result.lineSubtotalMinor).toBe(90_00n);
    // 18% of 90.00, not of 100.00
    expect(result.cgstMinor + result.sgstMinor).toBe(16_20n);
  });

  it("splits tax into equal halves within a state", () => {
    const result = calculateLine(line({ taxRateBps: 1800 }), "INTRA_STATE");
    expect(result.cgstMinor).toBe(9_00n);
    expect(result.sgstMinor).toBe(9_00n);
    expect(result.igstMinor).toBe(0n);
  });

  it("charges IGST across states", () => {
    const result = calculateLine(line({ taxRateBps: 1800 }), "INTER_STATE");
    expect(result.igstMinor).toBe(18_00n);
    expect(result.cgstMinor).toBe(0n);
  });

  it("charges nothing when exempt, whatever the rate says", () => {
    const result = calculateLine(line({ taxRateBps: 1800 }), "EXEMPT");
    expect(result.cgstMinor + result.sgstMinor + result.igstMinor).toBe(0n);
    expect(result.lineTotalMinor).toBe(result.lineSubtotalMinor);
  });

  it("keeps an odd tax split summing to the whole", () => {
    // 5% of 100.01 is 5.0005, rounding to 5.00, which halves exactly; use a
    // value that does not.
    const result = calculateLine(
      line({ unitPriceMinor: 100_01n, taxRateBps: 500 }),
      "INTRA_STATE"
    );
    const total = result.cgstMinor + result.sgstMinor;
    expect(result.cgstMinor - result.sgstMinor).toBeLessThanOrEqual(1n);
    expect(total).toBe(divideRounded(100_01n * 500n, 10_000n));
  });

  describe("rejects nonsense before it reaches the books", () => {
    it("a zero or negative quantity", () => {
      expect(() => calculateLine(line({ quantityMilli: 0n }), "EXEMPT")).toThrow(
        /quantity must be greater than zero/
      );
    });

    it("a negative price", () => {
      expect(() => calculateLine(line({ unitPriceMinor: -1n }), "EXEMPT")).toThrow(
        /cannot be negative/
      );
    });

    it("a discount larger than the line", () => {
      expect(() =>
        calculateLine(line({ unitPriceMinor: 10_00n, discountMinor: 20_00n }), "EXEMPT")
      ).toThrow(/larger than the line amount/);
    });

    it("a rate above 100%", () => {
      expect(() => calculateLine(line({ taxRateBps: 10_001 }), "EXEMPT")).toThrow(
        /between 0% and 100%/
      );
    });

    it("names the offending line", () => {
      expect(() => calculateLine(line({ quantityMilli: 0n }), "EXEMPT", 2)).toThrow(
        /Line 3/
      );
    });
  });
});

describe("a whole invoice", () => {
  it("needs at least one line", () => {
    expect(() => calculateInvoice([], "INTRA_STATE")).toThrow(/at least one line/);
  });

  it("sums its lines", () => {
    const result = calculateInvoice(
      [
        line({ unitPriceMinor: 100_00n, taxRateBps: 1800 }),
        line({ unitPriceMinor: 200_00n, taxRateBps: 1800 }),
      ],
      "INTRA_STATE"
    );

    expect(result.subtotalMinor).toBe(300_00n);
    expect(result.taxMinor).toBe(54_00n);
    expect(result.totalMinor).toBe(354_00n);
  });

  it("taxes each line at its own rate", () => {
    // A single calculation on the subtotal would be wrong the moment an
    // invoice mixes rates.
    const result = calculateInvoice(
      [
        line({ unitPriceMinor: 100_00n, taxRateBps: 500 }),
        line({ unitPriceMinor: 100_00n, taxRateBps: 1800 }),
      ],
      "INTER_STATE"
    );

    expect(result.igstMinor).toBe(5_00n + 18_00n);
  });

  it("keeps the total equal to subtotal plus tax when not rounding", () => {
    const result = calculateInvoice(
      [line({ unitPriceMinor: 99_99n, taxRateBps: 1800 })],
      "INTRA_STATE"
    );

    expect(result.totalMinor).toBe(result.subtotalMinor + result.taxMinor);
    expect(result.roundingMinor).toBe(0n);
  });

  it("rounds the payable total to whole rupees when asked", () => {
    // 118.99 * 1.18 lands on a sub-unit figure; Indian invoices commonly
    // present a whole-rupee total.
    const result = calculateInvoice(
      [line({ unitPriceMinor: 118_99n, taxRateBps: 1800 })],
      "INTRA_STATE",
      { roundTotalToUnit: true }
    );

    expect(result.totalMinor % 100n).toBe(0n);
    // The difference is carried, not hidden.
    expect(result.subtotalMinor + result.taxMinor + result.roundingMinor).toBe(
      result.totalMinor
    );
  });

  it("carries a rounding difference of at most half a unit", () => {
    for (const price of [1_01n, 33_33n, 99_99n, 12_345n, 7n]) {
      const result = calculateInvoice(
        [line({ unitPriceMinor: price, taxRateBps: 1800 })],
        "INTRA_STATE",
        { roundTotalToUnit: true }
      );

      const magnitude =
        result.roundingMinor < 0n ? -result.roundingMinor : result.roundingMinor;
      expect(magnitude, `rounding for ${price}`).toBeLessThanOrEqual(50n);
    }
  });

  it("stays exact on amounts beyond Number.MAX_SAFE_INTEGER", () => {
    const huge = 9_007_199_254_740_993n;
    const result = calculateInvoice([line({ unitPriceMinor: huge })], "EXEMPT");
    expect(result.subtotalMinor).toBe(huge);
  });

  it("totals match the sum of the stored line totals", () => {
    // The document and its lines must agree, or a printed invoice contradicts
    // itself.
    const result = calculateInvoice(
      [
        line({ quantityMilli: 2500n, unitPriceMinor: 33_33n, taxRateBps: 1800 }),
        line({ quantityMilli: 1n, unitPriceMinor: 99_99n, taxRateBps: 500 }),
        line({ quantityMilli: 7000n, unitPriceMinor: 1_11n, discountMinor: 1_00n }),
      ],
      "INTRA_STATE"
    );

    const lineSum = result.lines.reduce((t, l) => t + l.lineTotalMinor, 0n);
    expect(result.subtotalMinor + result.taxMinor).toBe(lineSum);
  });
});

describe("deciding which GST applies", () => {
  it("is intra-state when the states match", () => {
    expect(resolveGstTreatment("27", "27")).toBe("INTRA_STATE");
  });

  it("is inter-state when they differ", () => {
    expect(resolveGstTreatment("27", "29")).toBe("INTER_STATE");
  });

  it("is exempt when the supply is", () => {
    expect(resolveGstTreatment("27", "29", true)).toBe("EXEMPT");
  });

  it("falls back to intra-state when a state is unknown", () => {
    // Being wrong this way is visible on the invoice as CGST+SGST, rather than
    // silently charging one combined tax.
    expect(resolveGstTreatment(null, "29")).toBe("INTRA_STATE");
    expect(resolveGstTreatment("27", undefined)).toBe("INTRA_STATE");
  });

  it("ignores surrounding whitespace", () => {
    expect(resolveGstTreatment(" 27 ", "27")).toBe("INTRA_STATE");
  });
});

describe("state code from a GSTIN", () => {
  it("takes the leading two digits", () => {
    expect(stateCodeFromGstin("27AAPFU0939F1ZV")).toBe("27");
  });

  it("returns null for something that is not a GSTIN", () => {
    expect(stateCodeFromGstin(null)).toBeNull();
    expect(stateCodeFromGstin("")).toBeNull();
    expect(stateCodeFromGstin("XX1234")).toBeNull();
  });
});
