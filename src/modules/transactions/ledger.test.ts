import { describe, it, expect } from "vitest";
import {
  effectOf,
  invert,
  resolveEffect,
  recomputeBalance,
  type LedgerEntry,
} from "./ledger";
import { AppError } from "@/shared/errors/app-error";

const entry = (
  over: Partial<LedgerEntry> & Pick<LedgerEntry, "id" | "transactionType">
): LedgerEntry => ({
  direction: null,
  amountMinor: 1000n,
  reversedTransactionId: null,
  ...over,
});

describe("effectOf", () => {
  it("maps sales and customer payments to the receivable column", () => {
    expect(effectOf("SALE", null)).toEqual({ column: "receivableMinor", sign: 1 });
    expect(effectOf("PAYMENT_RECEIVED", null)).toEqual({ column: "receivableMinor", sign: -1 });
  });

  it("maps purchases and supplier payments to the payable column", () => {
    expect(effectOf("PURCHASE", null)).toEqual({ column: "payableMinor", sign: 1 });
    expect(effectOf("PAYMENT_MADE", null)).toEqual({ column: "payableMinor", sign: -1 });
  });

  it("takes the column from the direction for openings and adjustments", () => {
    expect(effectOf("OPENING_BALANCE", "RECEIVABLE")).toEqual({ column: "receivableMinor", sign: 1 });
    expect(effectOf("OPENING_BALANCE", "PAYABLE")).toEqual({ column: "payableMinor", sign: 1 });
    expect(effectOf("ADJUSTMENT", "RECEIVABLE")).toEqual({ column: "receivableMinor", sign: 1 });
    expect(effectOf("ADJUSTMENT", "PAYABLE")).toEqual({ column: "payableMinor", sign: 1 });
  });

  it("requires a direction where the type does not imply one", () => {
    expect(() => effectOf("OPENING_BALANCE", null)).toThrow(AppError);
    expect(() => effectOf("ADJUSTMENT", null)).toThrow(AppError);
  });

  it("refuses to score a REVERSAL without the entry it reverses", () => {
    // A reversal is defined by its original, so its effect is not derivable
    // from (type, direction) alone - resolveEffect must be used instead.
    expect(() => effectOf("REVERSAL", "RECEIVABLE")).toThrow(AppError);
  });
});

describe("invert", () => {
  it("flips the sign and keeps the column", () => {
    expect(invert({ column: "receivableMinor", sign: 1 })).toEqual({
      column: "receivableMinor",
      sign: -1,
    });
    expect(invert({ column: "payableMinor", sign: -1 })).toEqual({
      column: "payableMinor",
      sign: 1,
    });
  });

  it("round-trips", () => {
    const e = { column: "receivableMinor", sign: 1 } as const;
    expect(invert(invert(e))).toEqual(e);
  });
});

describe("resolveEffect", () => {
  it("resolves a reversal to the inverse of its original", () => {
    const sale = entry({ id: "t1", transactionType: "SALE" });
    const rev = entry({
      id: "t2",
      transactionType: "REVERSAL",
      direction: "RECEIVABLE",
      reversedTransactionId: "t1",
    });
    expect(resolveEffect(rev, new Map([[sale.id, sale]]))).toEqual({
      column: "receivableMinor",
      sign: -1,
    });
  });

  it("reversing a payment increases the receivable again", () => {
    const pay = entry({ id: "t1", transactionType: "PAYMENT_RECEIVED" });
    const rev = entry({ id: "t2", transactionType: "REVERSAL", reversedTransactionId: "t1" });
    expect(resolveEffect(rev, new Map([[pay.id, pay]]))).toEqual({
      column: "receivableMinor",
      sign: 1,
    });
  });

  it("throws when a reversal has no link or a dangling link", () => {
    const orphan = entry({ id: "t2", transactionType: "REVERSAL", reversedTransactionId: null });
    expect(() => resolveEffect(orphan, new Map())).toThrow(AppError);

    const dangling = entry({
      id: "t2",
      transactionType: "REVERSAL",
      reversedTransactionId: "missing",
    });
    expect(() => resolveEffect(dangling, new Map())).toThrow(AppError);
  });
});

describe("recomputeBalance", () => {
  it("returns zeroes for an empty ledger", () => {
    expect(recomputeBalance([])).toEqual({ receivableMinor: 0n, payableMinor: 0n });
  });

  it("tracks receivable and payable GROSS, without netting them", () => {
    // The regression the old netting model hid: a counterparty that is both a
    // customer and a supplier must show both sides, not one net figure.
    const entries = [
      entry({ id: "a", transactionType: "SALE", amountMinor: 1_000_000n }),
      entry({ id: "b", transactionType: "PURCHASE", amountMinor: 800_000n }),
    ];
    expect(recomputeBalance(entries)).toEqual({
      receivableMinor: 1_000_000n,
      payableMinor: 800_000n,
    });
  });

  it("applies payments against the correct side", () => {
    const entries = [
      entry({ id: "a", transactionType: "SALE", amountMinor: 1_000_000n }),
      entry({ id: "b", transactionType: "PAYMENT_RECEIVED", amountMinor: 400_000n }),
      entry({ id: "c", transactionType: "PURCHASE", amountMinor: 800_000n }),
      entry({ id: "d", transactionType: "PAYMENT_MADE", amountMinor: 300_000n }),
    ];
    expect(recomputeBalance(entries)).toEqual({
      receivableMinor: 600_000n,
      payableMinor: 500_000n,
    });
  });

  it("lets an overpayment go negative (a customer advance) rather than clamping", () => {
    const entries = [
      entry({ id: "a", transactionType: "SALE", amountMinor: 100_000n }),
      entry({ id: "b", transactionType: "PAYMENT_RECEIVED", amountMinor: 150_000n }),
    ];
    expect(recomputeBalance(entries)).toEqual({
      receivableMinor: -50_000n,
      payableMinor: 0n,
    });
  });

  it("nets a reversal back out to zero", () => {
    const sale = entry({ id: "a", transactionType: "SALE", amountMinor: 1_000_000n });
    const rev = entry({
      id: "b",
      transactionType: "REVERSAL",
      amountMinor: 1_000_000n,
      reversedTransactionId: "a",
    });
    expect(recomputeBalance([sale, rev])).toEqual({ receivableMinor: 0n, payableMinor: 0n });
  });

  it("handles opening balances on both sides", () => {
    const entries = [
      entry({
        id: "a",
        transactionType: "OPENING_BALANCE",
        direction: "RECEIVABLE",
        amountMinor: 2_000_000n,
      }),
      entry({
        id: "b",
        transactionType: "OPENING_BALANCE",
        direction: "PAYABLE",
        amountMinor: 1_250_000n,
      }),
    ];
    expect(recomputeBalance(entries)).toEqual({
      receivableMinor: 2_000_000n,
      payableMinor: 1_250_000n,
    });
  });

  it("is order-independent", () => {
    const entries = [
      entry({ id: "a", transactionType: "SALE", amountMinor: 50_000n }),
      entry({ id: "b", transactionType: "PAYMENT_RECEIVED", amountMinor: 20_000n }),
      entry({ id: "c", transactionType: "PURCHASE", amountMinor: 70_000n }),
    ];
    expect(recomputeBalance([...entries].reverse())).toEqual(recomputeBalance(entries));
  });

  it("stays exact well beyond Number.MAX_SAFE_INTEGER", () => {
    const big = 9_007_199_254_740_993n; // 2^53 + 1
    const entries = [
      entry({ id: "a", transactionType: "SALE", amountMinor: big }),
      entry({ id: "b", transactionType: "SALE", amountMinor: big }),
    ];
    expect(recomputeBalance(entries).receivableMinor).toBe(big * 2n);
  });

  it("matches an incrementally-applied snapshot for randomised ledgers", () => {
    // The invariant the module rests on: replaying the whole ledger must equal
    // applying each entry as a delta, which is what the repository does.
    const types = ["SALE", "PURCHASE", "PAYMENT_RECEIVED", "PAYMENT_MADE"] as const;

    for (let run = 0; run < 200; run++) {
      const entries: LedgerEntry[] = [];
      const n = 1 + Math.floor(Math.random() * 25);
      for (let i = 0; i < n; i++) {
        entries.push(
          entry({
            id: `t${i}`,
            transactionType: types[Math.floor(Math.random() * types.length)],
            amountMinor: BigInt(1 + Math.floor(Math.random() * 1_000_000)),
          })
        );
      }

      let receivableMinor = 0n;
      let payableMinor = 0n;
      for (const e of entries) {
        const { column, sign } = resolveEffect(e, new Map());
        const delta = BigInt(sign) * e.amountMinor;
        if (column === "receivableMinor") receivableMinor += delta;
        else payableMinor += delta;
      }

      expect(recomputeBalance(entries)).toEqual({ receivableMinor, payableMinor });
    }
  });
});
