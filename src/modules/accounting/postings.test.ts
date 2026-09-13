import { describe, it, expect } from "vitest";
import {
  postInvoice,
  postBill,
  postPaymentReceived,
  postPaymentMade,
  postOpeningBalance,
  postAdjustment,
  splitGst,
  totalTax,
  NO_TAX,
} from "./postings";
import {
  imbalanceOf,
  totalDebits,
  totalCredits,
  assertPostable,
  invertLines,
  withRoundingAdjustment,
  debit,
  credit,
  type DraftLine,
} from "./journal";
import { AppError } from "@/shared/errors/app-error";

/** Signed total posted to one account across a set of lines. */
const amountOn = (lines: DraftLine[], key: string) =>
  lines.filter((l) => l.accountKey === key).reduce((t, l) => t + l.amountMinor, 0n);

describe("the balance invariant", () => {
  it("rejects an entry that does not balance", () => {
    expect(() => assertPostable([debit("CASH", 100n), credit("SALES", 90n)])).toThrow(
      /does not balance/
    );
  });

  it("rejects a single-sided entry", () => {
    expect(() => assertPostable([debit("CASH", 100n)])).toThrow(/at least two lines/);
  });

  it("rejects a zero line", () => {
    expect(() =>
      assertPostable([debit("CASH", 0n), credit("SALES", 0n)])
    ).toThrow(/cannot be for zero/);
  });

  it("requires a counterparty on a control account", () => {
    expect(() =>
      assertPostable([debit("ACCOUNTS_RECEIVABLE", 100n), credit("SALES", 100n)])
    ).toThrow(/must name a counterparty/);
  });

  it("refuses a counterparty on a non-control account", () => {
    // Otherwise a party balance could be derived from lines that were never
    // meant to contribute to it.
    expect(() =>
      assertPostable([
        debit("CASH", 100n, { partyId: "p1" }),
        credit("SALES", 100n),
      ])
    ).toThrow(/not a control account/);
  });
});

describe("GST split", () => {
  it("splits an intra-state supply into equal CGST and SGST", () => {
    const tax = splitGst("INTRA_STATE", 1800n);
    expect(tax).toEqual({ cgstMinor: 900n, sgstMinor: 900n, igstMinor: 0n });
  });

  it("puts the whole amount on IGST for an inter-state supply", () => {
    const tax = splitGst("INTER_STATE", 1800n);
    expect(tax).toEqual({ cgstMinor: 0n, sgstMinor: 0n, igstMinor: 1800n });
  });

  it("keeps an odd amount summing to the total", () => {
    // Half of an odd number is not exact, so one side carries the extra paisa.
    const tax = splitGst("INTRA_STATE", 901n);
    expect(tax.cgstMinor + tax.sgstMinor).toBe(901n);
    expect(tax.cgstMinor).toBe(451n);
    expect(tax.sgstMinor).toBe(450n);
  });

  it("charges nothing on an exempt supply", () => {
    expect(splitGst("EXEMPT", 1800n)).toEqual(NO_TAX);
  });
});

describe("issuing a sales invoice", () => {
  const posting = {
    partyId: "party-1",
    subtotalMinor: 10_000_00n,
    tax: splitGst("INTRA_STATE", 1_800_00n),
    totalMinor: 11_800_00n,
  };

  it("balances", () => {
    expect(imbalanceOf(postInvoice(posting))).toBe(0n);
  });

  it("debits receivable with the gross the customer owes", () => {
    const lines = postInvoice(posting);
    expect(amountOn(lines, "ACCOUNTS_RECEIVABLE")).toBe(11_800_00n);
  });

  it("recognises only the net as income", () => {
    // Tax is collected on the government's behalf, so it is a liability rather
    // than revenue. Crediting it to Sales would overstate income by the tax.
    const lines = postInvoice(posting);
    expect(amountOn(lines, "SALES")).toBe(-10_000_00n);
  });

  it("credits the collected tax to output GST", () => {
    const lines = postInvoice(posting);
    expect(amountOn(lines, "GST_OUTPUT_CGST")).toBe(-900_00n);
    expect(amountOn(lines, "GST_OUTPUT_SGST")).toBe(-900_00n);
    expect(amountOn(lines, "GST_OUTPUT_IGST")).toBe(0n);
  });

  it("uses IGST for an inter-state supply", () => {
    const lines = postInvoice({ ...posting, tax: splitGst("INTER_STATE", 1_800_00n) });
    expect(amountOn(lines, "GST_OUTPUT_IGST")).toBe(-1_800_00n);
    expect(amountOn(lines, "GST_OUTPUT_CGST")).toBe(0n);
  });

  it("tags the receivable line with the counterparty", () => {
    const lines = postInvoice(posting);
    const ar = lines.find((l) => l.accountKey === "ACCOUNTS_RECEIVABLE");
    expect(ar?.partyId).toBe("party-1");
  });

  it("absorbs a rounded total into the rounding account", () => {
    // Percentage tax on several lines rarely lands on the rounded total, and
    // nudging a real account by a paisa would be a lie.
    const lines = postInvoice({
      partyId: "party-1",
      subtotalMinor: 10_000_00n,
      tax: splitGst("INTRA_STATE", 1_800_01n),
      totalMinor: 11_800_00n,
    });

    expect(imbalanceOf(lines)).toBe(0n);
    expect(amountOn(lines, "ROUNDING")).toBe(1n);
  });

  it("handles an exempt supply with no tax lines at all", () => {
    const lines = postInvoice({
      partyId: "party-1",
      subtotalMinor: 10_000_00n,
      tax: NO_TAX,
      totalMinor: 10_000_00n,
    });

    expect(lines).toHaveLength(2);
    expect(imbalanceOf(lines)).toBe(0n);
  });
});

describe("recording a supplier bill", () => {
  const posting = {
    partyId: "party-2",
    subtotalMinor: 5_000_00n,
    tax: splitGst("INTRA_STATE", 900_00n),
    totalMinor: 5_900_00n,
  };

  it("balances and credits payable with the gross", () => {
    const lines = postBill(posting);
    expect(imbalanceOf(lines)).toBe(0n);
    expect(amountOn(lines, "ACCOUNTS_PAYABLE")).toBe(-5_900_00n);
  });

  it("treats input tax as a recoverable asset, not a cost", () => {
    // Debiting it to Purchases would overstate expenses by tax the business
    // gets back.
    const lines = postBill(posting);
    expect(amountOn(lines, "PURCHASES")).toBe(5_000_00n);
    expect(amountOn(lines, "GST_INPUT_CGST")).toBe(450_00n);
    expect(amountOn(lines, "GST_INPUT_SGST")).toBe(450_00n);
  });
});

describe("payments", () => {
  it("moves money from receivable to cash without recognising income", () => {
    const lines = postPaymentReceived("party-1", 5_000_00n);

    expect(imbalanceOf(lines)).toBe(0n);
    expect(amountOn(lines, "CASH")).toBe(5_000_00n);
    expect(amountOn(lines, "ACCOUNTS_RECEIVABLE")).toBe(-5_000_00n);
    // The sale was recognised when the invoice was issued.
    expect(amountOn(lines, "SALES")).toBe(0n);
  });

  it("settles a payable with cash", () => {
    const lines = postPaymentMade("party-2", 2_000_00n);

    expect(imbalanceOf(lines)).toBe(0n);
    expect(amountOn(lines, "ACCOUNTS_PAYABLE")).toBe(2_000_00n);
    expect(amountOn(lines, "CASH")).toBe(-2_000_00n);
  });
});

describe("opening balances", () => {
  it("balances a receivable against equity rather than income", () => {
    // The sale happened before these books existed; booking it as revenue now
    // would overstate the current period.
    const lines = postOpeningBalance("party-1", 20_000_00n, "RECEIVABLE");

    expect(imbalanceOf(lines)).toBe(0n);
    expect(amountOn(lines, "ACCOUNTS_RECEIVABLE")).toBe(20_000_00n);
    expect(amountOn(lines, "OPENING_BALANCE_EQUITY")).toBe(-20_000_00n);
    expect(amountOn(lines, "SALES")).toBe(0n);
  });

  it("balances a payable against equity", () => {
    const lines = postOpeningBalance("party-2", 12_500_00n, "PAYABLE");

    expect(amountOn(lines, "ACCOUNTS_PAYABLE")).toBe(-12_500_00n);
    expect(amountOn(lines, "OPENING_BALANCE_EQUITY")).toBe(12_500_00n);
  });
});

describe("adjustments", () => {
  it("keeps a correction visible in the period rather than hiding it in equity", () => {
    const lines = postAdjustment("party-1", 500_00n, "RECEIVABLE");

    expect(imbalanceOf(lines)).toBe(0n);
    expect(amountOn(lines, "ADJUSTMENTS")).toBe(-500_00n);
    expect(amountOn(lines, "OPENING_BALANCE_EQUITY")).toBe(0n);
  });
});

describe("reversal", () => {
  it("produces the exact opposite of the original", () => {
    const original = postPaymentReceived("party-1", 5_000_00n);
    const reversal = invertLines(original);

    expect(imbalanceOf(reversal)).toBe(0n);
    expect(amountOn(reversal, "CASH")).toBe(-5_000_00n);
    expect(amountOn(reversal, "ACCOUNTS_RECEIVABLE")).toBe(5_000_00n);
  });

  it("nets to nothing when applied to the original", () => {
    const original = postInvoice({
      partyId: "party-1",
      subtotalMinor: 10_000_00n,
      tax: splitGst("INTER_STATE", 1_800_00n),
      totalMinor: 11_800_00n,
    });
    const both = [...original, ...invertLines(original)];

    for (const key of ["ACCOUNTS_RECEIVABLE", "SALES", "GST_OUTPUT_IGST"]) {
      expect(amountOn(both, key), `${key} should net to zero`).toBe(0n);
    }
  });

  it("keeps the counterparty on the reversing line", () => {
    const reversal = invertLines(postPaymentReceived("party-1", 100n));
    const ar = reversal.find((l) => l.accountKey === "ACCOUNTS_RECEIVABLE");
    expect(ar?.partyId).toBe("party-1");
  });
});

describe("debit and credit totals", () => {
  it("are equal for any balanced entry", () => {
    const lines = postInvoice({
      partyId: "party-1",
      subtotalMinor: 7_777_77n,
      tax: splitGst("INTRA_STATE", 1_399_99n),
      totalMinor: 9_177_76n,
    });

    expect(totalDebits(lines)).toBe(totalCredits(lines));
  });

  it("reports the tax total across components", () => {
    expect(totalTax(splitGst("INTRA_STATE", 1_800_00n))).toBe(1_800_00n);
    expect(totalTax(splitGst("INTER_STATE", 1_800_00n))).toBe(1_800_00n);
  });
});

describe("withRoundingAdjustment", () => {
  it("leaves a balanced entry untouched", () => {
    const lines = [debit("CASH", 100n), credit("SALES", 100n)];
    expect(withRoundingAdjustment(lines)).toHaveLength(2);
  });

  it("closes an entry that is out by a sub-unit", () => {
    const lines = [debit("CASH", 101n), credit("SALES", 100n)];
    const balanced = withRoundingAdjustment(lines);

    expect(imbalanceOf(balanced)).toBe(0n);
    expect(amountOn(balanced, "ROUNDING")).toBe(-1n);
  });
});

describe("precision", () => {
  it("stays exact on amounts far beyond Number.MAX_SAFE_INTEGER", () => {
    const huge = 9_007_199_254_740_993n; // 2^53 + 1
    const lines = postPaymentReceived("party-1", huge);

    expect(imbalanceOf(lines)).toBe(0n);
    expect(amountOn(lines, "CASH")).toBe(huge);
  });

  it("raises AppError rather than a bare Error, so it maps to a status", () => {
    try {
      assertPostable([debit("CASH", 100n), credit("SALES", 90n)]);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(500);
    }
  });
});
