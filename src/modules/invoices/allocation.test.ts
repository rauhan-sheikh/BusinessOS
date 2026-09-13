import { describe, it, expect } from "vitest";
import {
  outstandingOf,
  isAllocatable,
  statusForPaid,
  autoAllocate,
  assertAllocationsValid,
  daysOverdue,
  bucketFor,
  type AllocatableInvoice,
} from "./allocation";
import { AppError } from "@/shared/errors/app-error";

const invoice = (over: Partial<AllocatableInvoice> = {}): AllocatableInvoice => ({
  id: "inv-1",
  totalMinor: 1_000_00n,
  paidMinor: 0n,
  status: "ISSUED",
  issueDate: new Date(2026, 0, 1),
  ...over,
});

const byId = (invoices: AllocatableInvoice[]) =>
  new Map(invoices.map((i) => [i.id, i]));

describe("outstanding", () => {
  it("is the total less what has been paid", () => {
    expect(outstandingOf(invoice({ paidMinor: 400_00n }))).toBe(600_00n);
  });

  it("never goes negative, even if overpaid", () => {
    expect(outstandingOf(invoice({ paidMinor: 1_500_00n }))).toBe(0n);
  });
});

describe("what can be paid", () => {
  it("accepts an issued or partly paid invoice", () => {
    expect(isAllocatable(invoice({ status: "ISSUED" }))).toBe(true);
    expect(isAllocatable(invoice({ status: "PARTIALLY_PAID" }))).toBe(true);
  });

  it("refuses a draft, which was never issued", () => {
    expect(isAllocatable(invoice({ status: "DRAFT" }))).toBe(false);
  });

  it("refuses a cancelled invoice", () => {
    // It has been reversed out of the books; settling it would resurrect a
    // liability that no longer exists.
    expect(isAllocatable(invoice({ status: "CANCELLED" }))).toBe(false);
  });
});

describe("status from what is paid", () => {
  it("is issued while nothing is paid", () => {
    expect(statusForPaid(1_000_00n, 0n, "ISSUED")).toBe("ISSUED");
  });

  it("is partially paid in between", () => {
    expect(statusForPaid(1_000_00n, 400_00n, "ISSUED")).toBe("PARTIALLY_PAID");
  });

  it("is paid once the total is met", () => {
    expect(statusForPaid(1_000_00n, 1_000_00n, "PARTIALLY_PAID")).toBe("PAID");
  });

  it("stays paid if somehow overpaid", () => {
    expect(statusForPaid(1_000_00n, 1_200_00n, "PAID")).toBe("PAID");
  });

  it("falls back to issued when payments are removed", () => {
    expect(statusForPaid(1_000_00n, 0n, "PAID")).toBe("ISSUED");
  });

  it("leaves a cancelled or draft document alone", () => {
    expect(statusForPaid(1_000_00n, 500_00n, "CANCELLED")).toBe("CANCELLED");
    expect(statusForPaid(1_000_00n, 500_00n, "DRAFT")).toBe("DRAFT");
  });
});

describe("automatic allocation", () => {
  const older = invoice({ id: "older", issueDate: new Date(2026, 0, 1), totalMinor: 500_00n });
  const newer = invoice({ id: "newer", issueDate: new Date(2026, 2, 1), totalMinor: 800_00n });

  it("settles the oldest invoice first", () => {
    const { allocations } = autoAllocate(500_00n, [newer, older]);

    expect(allocations).toEqual([{ invoiceId: "older", amountMinor: 500_00n }]);
  });

  it("spills over onto the next invoice", () => {
    const { allocations, unallocatedMinor } = autoAllocate(900_00n, [older, newer]);

    expect(allocations).toEqual([
      { invoiceId: "older", amountMinor: 500_00n },
      { invoiceId: "newer", amountMinor: 400_00n },
    ]);
    expect(unallocatedMinor).toBe(0n);
  });

  it("returns the remainder rather than forcing it onto an invoice", () => {
    // What is left is an advance, not an overpayment of the newest bill.
    const { allocations, unallocatedMinor } = autoAllocate(2_000_00n, [older, newer]);

    expect(allocations).toHaveLength(2);
    expect(unallocatedMinor).toBe(700_00n);
  });

  it("skips what cannot be paid", () => {
    const { allocations, unallocatedMinor } = autoAllocate(1_000_00n, [
      invoice({ id: "draft", status: "DRAFT" }),
      invoice({ id: "cancelled", status: "CANCELLED" }),
      invoice({ id: "settled", paidMinor: 1_000_00n }),
      older,
    ]);

    expect(allocations).toEqual([{ invoiceId: "older", amountMinor: 500_00n }]);
    expect(unallocatedMinor).toBe(500_00n);
  });

  it("only covers what is still outstanding", () => {
    const partly = invoice({ id: "partly", totalMinor: 1_000_00n, paidMinor: 700_00n });
    const { allocations } = autoAllocate(1_000_00n, [partly]);

    expect(allocations).toEqual([{ invoiceId: "partly", amountMinor: 300_00n }]);
  });

  it("is deterministic when two invoices share a date", () => {
    const a = invoice({ id: "aaa", issueDate: new Date(2026, 0, 1), totalMinor: 100_00n });
    const b = invoice({ id: "bbb", issueDate: new Date(2026, 0, 1), totalMinor: 100_00n });

    expect(autoAllocate(150_00n, [b, a]).allocations).toEqual(
      autoAllocate(150_00n, [a, b]).allocations
    );
  });

  it("refuses a payment of nothing", () => {
    expect(() => autoAllocate(0n, [older])).toThrow(AppError);
    expect(() => autoAllocate(-1n, [older])).toThrow(AppError);
  });

  it("returns the whole amount when there is nothing open", () => {
    const { allocations, unallocatedMinor } = autoAllocate(500_00n, []);
    expect(allocations).toEqual([]);
    expect(unallocatedMinor).toBe(500_00n);
  });
});

describe("validating a manual allocation", () => {
  const open = invoice({ id: "open", totalMinor: 1_000_00n });

  it("accepts an allocation within both limits", () => {
    expect(() =>
      assertAllocationsValid(1_000_00n, [{ invoiceId: "open", amountMinor: 600_00n }], byId([open]))
    ).not.toThrow();
  });

  it("refuses allocating more than the payment is worth", () => {
    // Otherwise the ledger invents money that was never received.
    expect(() =>
      assertAllocationsValid(
        500_00n,
        [{ invoiceId: "open", amountMinor: 600_00n }],
        byId([open])
      )
    ).toThrow(/more than the payment is for/);
  });

  it("refuses settling more than an invoice asks for", () => {
    expect(() =>
      assertAllocationsValid(
        5_000_00n,
        [{ invoiceId: "open", amountMinor: 1_500_00n }],
        byId([open])
      )
    ).toThrow(/larger than the amount still outstanding/);
  });

  it("accounts for what is already paid", () => {
    const partly = invoice({ id: "partly", totalMinor: 1_000_00n, paidMinor: 800_00n });

    expect(() =>
      assertAllocationsValid(
        1_000_00n,
        [{ invoiceId: "partly", amountMinor: 300_00n }],
        byId([partly])
      )
    ).toThrow(/still outstanding/);
  });

  it("refuses a zero or negative allocation", () => {
    expect(() =>
      assertAllocationsValid(1_000_00n, [{ invoiceId: "open", amountMinor: 0n }], byId([open]))
    ).toThrow(/more than zero/);
  });

  it("refuses the same invoice twice", () => {
    expect(() =>
      assertAllocationsValid(
        1_000_00n,
        [
          { invoiceId: "open", amountMinor: 100_00n },
          { invoiceId: "open", amountMinor: 100_00n },
        ],
        byId([open])
      )
    ).toThrow(/appears twice/);
  });

  it("refuses a draft and explains why", () => {
    const draft = invoice({ id: "draft", status: "DRAFT" });
    expect(() =>
      assertAllocationsValid(
        1_000_00n,
        [{ invoiceId: "draft", amountMinor: 100_00n }],
        byId([draft])
      )
    ).toThrow(/has not been issued/);
  });

  it("refuses a cancelled invoice", () => {
    const cancelled = invoice({ id: "cancelled", status: "CANCELLED" });
    expect(() =>
      assertAllocationsValid(
        1_000_00n,
        [{ invoiceId: "cancelled", amountMinor: 100_00n }],
        byId([cancelled])
      )
    ).toThrow(/cancelled invoice cannot be paid/);
  });

  it("refuses an unknown invoice", () => {
    expect(() =>
      assertAllocationsValid(
        1_000_00n,
        [{ invoiceId: "missing", amountMinor: 100_00n }],
        byId([open])
      )
    ).toThrow(/could not be found/);
  });

  it("allows allocating less than the payment, leaving an advance", () => {
    expect(() =>
      assertAllocationsValid(
        1_000_00n,
        [{ invoiceId: "open", amountMinor: 200_00n }],
        byId([open])
      )
    ).not.toThrow();
  });
});

describe("aging", () => {
  const asAt = new Date(2026, 5, 30);

  it("is not overdue before the due date", () => {
    expect(daysOverdue(invoice({ dueDate: new Date(2026, 6, 15) }), asAt)).toBe(0);
  });

  it("counts whole days past the due date", () => {
    expect(daysOverdue(invoice({ dueDate: new Date(2026, 5, 20) }), asAt)).toBe(10);
  });

  it("is not overdue once settled", () => {
    const settled = invoice({ dueDate: new Date(2026, 0, 1), paidMinor: 1_000_00n });
    expect(daysOverdue(settled, asAt)).toBe(0);
  });

  it("is not overdue without a due date", () => {
    expect(daysOverdue(invoice({ dueDate: null }), asAt)).toBe(0);
  });

  it("buckets by age", () => {
    expect(bucketFor(0)).toBe("Not due");
    expect(bucketFor(1)).toBe("1-30 days");
    expect(bucketFor(30)).toBe("1-30 days");
    expect(bucketFor(31)).toBe("31-60 days");
    expect(bucketFor(90)).toBe("61-90 days");
    expect(bucketFor(91)).toBe("Over 90 days");
    expect(bucketFor(5000)).toBe("Over 90 days");
  });
});
