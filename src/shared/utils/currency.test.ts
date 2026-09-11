import { describe, it, expect } from "vitest";
import {
  toMinorUnits,
  toMajorUnits,
  toDecimalString,
  formatCurrency,
} from "./currency";
import { AppError } from "@/shared/errors/app-error";

describe("toMinorUnits", () => {
  it("converts whole-number strings", () => {
    expect(toMinorUnits("10")).toBe(1000n);
    expect(toMinorUnits("0")).toBe(0n);
    expect(toMinorUnits("1250")).toBe(125000n);
  });

  it("converts decimal strings", () => {
    expect(toMinorUnits("10.5")).toBe(1050n);
    expect(toMinorUnits("10.50")).toBe(1050n);
    expect(toMinorUnits("1250.50")).toBe(125050n);
    expect(toMinorUnits("0.05")).toBe(5n);
    expect(toMinorUnits("0.01")).toBe(1n);
  });

  it("accepts a leading decimal point", () => {
    expect(toMinorUnits(".5")).toBe(50n);
    expect(toMinorUnits(".05")).toBe(5n);
  });

  it("accepts numbers as well as strings", () => {
    expect(toMinorUnits(10)).toBe(1000n);
    expect(toMinorUnits(10.5)).toBe(1050n);
    expect(toMinorUnits(0.05)).toBe(5n);
  });

  it("trims surrounding whitespace", () => {
    expect(toMinorUnits("  10.50  ")).toBe(1050n);
  });

  it("preserves precision far beyond Number.MAX_SAFE_INTEGER", () => {
    expect(toMinorUnits("99999999999999999.99")).toBe(9999999999999999999n);
  });

  // --- the bugs this replaces -------------------------------------------

  it("throws on non-numeric input instead of silently returning 0", () => {
    expect(() => toMinorUnits("abc")).toThrow(AppError);
    expect(() => toMinorUnits("")).toThrow(AppError);
    expect(() => toMinorUnits("   ")).toThrow(AppError);
    expect(() => toMinorUnits("1,000")).toThrow(AppError);
  });

  it("throws on negative amounts", () => {
    expect(() => toMinorUnits("-500")).toThrow(AppError);
    expect(() => toMinorUnits(-500)).toThrow(AppError);
    expect(() => toMinorUnits("-0.01")).toThrow(AppError);
  });

  it("throws on scientific notation instead of crashing with SyntaxError", () => {
    expect(() => toMinorUnits("1e3")).toThrow(AppError);
    expect(() => toMinorUnits(1e21)).toThrow(AppError);
    expect(() => toMinorUnits("1e-7")).toThrow(AppError);
  });

  it("throws on more than two decimal places rather than truncating", () => {
    expect(() => toMinorUnits("10.999")).toThrow(AppError);
    expect(() => toMinorUnits("10.505")).toThrow(AppError);
  });

  it("throws on non-finite numbers", () => {
    expect(() => toMinorUnits(NaN)).toThrow(AppError);
    expect(() => toMinorUnits(Infinity)).toThrow(AppError);
  });

  it("raises AppError with a 400 status", () => {
    try {
      toMinorUnits("abc");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    }
  });
});

describe("toDecimalString", () => {
  it("renders minor units as an exact decimal string", () => {
    expect(toDecimalString(125050n)).toBe("1250.50");
    expect(toDecimalString(5n)).toBe("0.05");
    expect(toDecimalString(0n)).toBe("0.00");
    expect(toDecimalString(1000n)).toBe("10.00");
  });

  it("handles negative balances (customer advances / credits)", () => {
    expect(toDecimalString(-125050n)).toBe("-1250.50");
    expect(toDecimalString(-5n)).toBe("-0.05");
  });

  it("stays exact past Number.MAX_SAFE_INTEGER", () => {
    expect(toDecimalString(9999999999999999999n)).toBe("99999999999999999.99");
  });
});

describe("formatCurrency", () => {
  it("formats INR in the Indian numbering system", () => {
    expect(formatCurrency(125050n)).toBe("₹1,250.50");
    expect(formatCurrency(0n)).toBe("₹0.00");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-125050n)).toBe("-₹1,250.50");
  });

  it("does not lose precision on very large amounts", () => {
    // Number-based conversion would round this; BigInt-based must not.
    const formatted = formatCurrency(9999999999999999999n);
    expect(formatted).toContain("99");
    expect(formatted.endsWith(".99")).toBe(true);
  });

  it("falls back gracefully on an unknown currency code", () => {
    expect(formatCurrency(125050n, "XYZ")).toContain("1,250.50");
  });
});

describe("toMajorUnits", () => {
  it("converts for display/interop use", () => {
    expect(toMajorUnits(125050n)).toBe(1250.5);
    expect(toMajorUnits(0n)).toBe(0);
    expect(toMajorUnits(-5n)).toBe(-0.05);
  });
});
