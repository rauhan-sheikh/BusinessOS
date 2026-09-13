import { describe, it, expect } from "vitest";
import {
  financialYearOf,
  financialYearRange,
  formatDocumentNumber,
  parseDocumentNumber,
  DEFAULT_PREFIXES,
} from "./numbering";
import { AppError } from "@/shared/errors/app-error";

describe("the Indian financial year", () => {
  it("starts in April", () => {
    expect(financialYearOf(new Date(2026, 3, 1))).toBe("2026-27");
    expect(financialYearOf(new Date(2026, 11, 31))).toBe("2026-27");
  });

  it("puts January to March in the previous year", () => {
    // The case a calendar year gets wrong: January 2027 is still 2026-27.
    expect(financialYearOf(new Date(2027, 0, 15))).toBe("2026-27");
    expect(financialYearOf(new Date(2027, 2, 31))).toBe("2026-27");
  });

  it("rolls over on 1 April", () => {
    expect(financialYearOf(new Date(2027, 2, 31, 23, 59, 59))).toBe("2026-27");
    expect(financialYearOf(new Date(2027, 3, 1, 0, 0, 0))).toBe("2027-28");
  });

  it("pads the short end year across a century", () => {
    expect(financialYearOf(new Date(2099, 5, 1))).toBe("2099-00");
    expect(financialYearOf(new Date(2009, 5, 1))).toBe("2009-10");
  });
});

describe("financial year range", () => {
  it("spans April to the last moment of March", () => {
    const { start, end } = financialYearRange("2026-27");

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(3);
    expect(start.getDate()).toBe(1);

    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(2);
    expect(end.getDate()).toBe(31);
  });

  it("round-trips with financialYearOf at both edges", () => {
    const { start, end } = financialYearRange("2026-27");
    expect(financialYearOf(start)).toBe("2026-27");
    expect(financialYearOf(end)).toBe("2026-27");
  });

  it("rejects a malformed year", () => {
    expect(() => financialYearRange("2026")).toThrow(AppError);
    expect(() => financialYearRange("26-27")).toThrow(AppError);
  });
});

describe("document numbers", () => {
  it("formats prefix, year and a padded sequence", () => {
    expect(formatDocumentNumber("INV", "2026-27", 1)).toBe("INV/2026-27/0001");
    expect(formatDocumentNumber("INV", "2026-27", 42)).toBe("INV/2026-27/0042");
  });

  it("keeps growing past the pad width rather than truncating", () => {
    expect(formatDocumentNumber("INV", "2026-27", 12345)).toBe("INV/2026-27/12345");
  });

  it("pads so numbers sort correctly as text", () => {
    const numbers = [1, 2, 10, 20].map((n) => formatDocumentNumber("INV", "2026-27", n));
    expect([...numbers].sort()).toEqual(numbers);
  });

  it("refuses a sequence below one", () => {
    // Numbering starts at 1; a zero would mean the counter was never allocated.
    expect(() => formatDocumentNumber("INV", "2026-27", 0)).toThrow(AppError);
  });

  it("round-trips through the parser", () => {
    const formatted = formatDocumentNumber("BILL", "2027-28", 7);
    expect(parseDocumentNumber(formatted)).toEqual({
      prefix: "BILL",
      financialYear: "2027-28",
      sequence: 7,
    });
  });

  it("returns null for anything that is not one of ours", () => {
    expect(parseDocumentNumber("not-a-number")).toBeNull();
    expect(parseDocumentNumber("INV-2026-27-0001")).toBeNull();
  });

  it("has a prefix for every document type", () => {
    for (const [type, prefix] of Object.entries(DEFAULT_PREFIXES)) {
      expect(prefix, `${type} has no prefix`).toMatch(/^[A-Z]+$/);
    }
  });
});
