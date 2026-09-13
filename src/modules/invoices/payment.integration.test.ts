/**
 * Payments against a real database. The property that matters: an invoice's
 * paid figure, its status, the counterparty balance and the journal must all
 * agree after every operation.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/db";
import { invoiceRepository } from "./repositories/invoice.repository";
import { paymentRepository } from "./repositories/payment.repository";
import { accountRepository } from "@/modules/accounting/repositories/account.repository";
import { journalRepository } from "@/modules/accounting/repositories/journal.repository";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const PREFIX = "__payment_integration__";

describe.skipIf(!hasDatabase)("payments (database)", () => {
  let businessId: string;
  let userId: string;
  let partyId: string;

  beforeAll(async () => {
    const business = await prisma.business.create({
      data: { name: `${PREFIX} business`, currency: "INR", gstin: "27AAAAA0000A1Z5" },
    });
    businessId = business.id;

    const user = await prisma.user.create({
      data: {
        id: `${PREFIX}${Date.now()}`,
        name: "Payment User",
        email: `${PREFIX}${Date.now()}@example.test`,
        emailVerified: true,
      },
    });
    userId = user.id;
    await prisma.businessUser.create({ data: { businessId, userId, role: "OWNER" } });
    await accountRepository.ensureSystemAccounts(businessId);

    const party = await prisma.party.create({
      data: { businessId, name: `${PREFIX} customer`, gstin: "27BBBBB1111B1Z5" },
    });
    partyId = party.id;
  });

  afterAll(async () => {
    if (!businessId) return;
    await prisma.paymentAllocation.deleteMany({ where: { invoice: { businessId } } });
    await prisma.invoiceLine.deleteMany({ where: { invoice: { businessId } } });
    await prisma.invoice.deleteMany({ where: { businessId } });
    await prisma.payment.deleteMany({ where: { businessId } });
    await prisma.numberSequence.deleteMany({ where: { businessId } });
    await prisma.journalLine.deleteMany({ where: { journalEntry: { businessId } } });
    await prisma.journalEntry.updateMany({
      where: { businessId },
      data: { reversedEntryId: null },
    });
    await prisma.journalEntry.deleteMany({ where: { businessId } });
    await prisma.ledgerAccount.deleteMany({ where: { businessId } });
    await prisma.partyBalance.deleteMany({ where: { businessId } });
    await prisma.party.deleteMany({ where: { businessId } });
    await prisma.auditLog.deleteMany({ where: { businessId } });
    await prisma.businessUser.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  /** An issued invoice for a round amount, tax-free to keep the maths obvious. */
  const issuedInvoice = async (totalMinor: bigint, issueDate = new Date(2026, 5, 1)) => {
    const draft = await invoiceRepository.createDraft({
      businessId,
      createdById: userId,
      partyId,
      kind: "SALES",
      issueDate,
      lines: [
        {
          description: "Service",
          quantityMilli: 1000n,
          unitPriceMinor: totalMinor,
          taxRateBps: 0,
        },
      ],
    });
    return invoiceRepository.issue(draft.id, businessId, userId);
  };

  describe("recording a payment", () => {
    it("settles the oldest invoice first", async () => {
      const older = await issuedInvoice(1_000_00n, new Date(2026, 0, 1));
      const newer = await issuedInvoice(1_000_00n, new Date(2026, 3, 1));

      await paymentRepository.record({
        businessId,
        createdById: userId,
        partyId,
        kind: "SALES",
        amountMinor: 1_000_00n,
        paymentDate: new Date(2026, 4, 1),
      });

      const [a, b] = await Promise.all([
        prisma.invoice.findUniqueOrThrow({ where: { id: older.id } }),
        prisma.invoice.findUniqueOrThrow({ where: { id: newer.id } }),
      ]);

      expect(a.status).toBe("PAID");
      expect(b.status).toBe("ISSUED");
    });

    it("marks an invoice partly paid", async () => {
      const invoice = await issuedInvoice(1_000_00n, new Date(2027, 0, 1));

      await paymentRepository.record({
        businessId, createdById: userId, partyId, kind: "SALES",
        amountMinor: 400_00n,
        paymentDate: new Date(2027, 0, 5),
        allocations: [{ invoiceId: invoice.id, amountMinor: 400_00n }],
      });

      const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(updated.status).toBe("PARTIALLY_PAID");
      expect(updated.paidMinor).toBe(400_00n);
    });

    it("reduces the counterparty balance by the amount received", async () => {
      const invoice = await issuedInvoice(500_00n, new Date(2027, 1, 1));
      const before = await prisma.partyBalance.findUniqueOrThrow({ where: { partyId } });

      await paymentRepository.record({
        businessId, createdById: userId, partyId, kind: "SALES",
        amountMinor: 500_00n,
        paymentDate: new Date(2027, 1, 5),
        allocations: [{ invoiceId: invoice.id, amountMinor: 500_00n }],
      });

      const after = await prisma.partyBalance.findUniqueOrThrow({ where: { partyId } });
      expect(before.receivableMinor - after.receivableMinor).toBe(500_00n);
    });

    it("holds an unallocated amount on account", async () => {
      // The remainder is an advance, not an overpayment of some invoice.
      const payment = await paymentRepository.record({
        businessId, createdById: userId, partyId, kind: "SALES",
        amountMinor: 250_00n,
        paymentDate: new Date(2027, 2, 1),
        allocations: [],
      });

      expect(payment.allocations).toHaveLength(0);
      expect(payment.amountMinor).toBe(250_00n);
    });

    it("posts a balanced entry linked back to the payment", async () => {
      const payment = await paymentRepository.record({
        businessId, createdById: userId, partyId, kind: "SALES",
        amountMinor: 100_00n,
        paymentDate: new Date(2027, 3, 1),
        allocations: [],
      });

      const entry = await prisma.journalEntry.findUniqueOrThrow({
        where: { id: payment.journalEntryId! },
        include: { lines: true },
      });

      expect(entry.lines.reduce((t, l) => t + l.amountMinor, 0n)).toBe(0n);
      expect(entry.sourceType).toBe("PAYMENT");
      expect(entry.sourceId).toBe(payment.id);
    });

    it("refuses a payment of nothing", async () => {
      await expect(
        paymentRepository.record({
          businessId, createdById: userId, partyId, kind: "SALES",
          amountMinor: 0n, paymentDate: new Date(),
        })
      ).rejects.toThrow(/more than zero/);
    });

    it("refuses to allocate more than an invoice is owed", async () => {
      const invoice = await issuedInvoice(100_00n, new Date(2027, 4, 1));

      await expect(
        paymentRepository.record({
          businessId, createdById: userId, partyId, kind: "SALES",
          amountMinor: 500_00n,
          paymentDate: new Date(2027, 4, 2),
          allocations: [{ invoiceId: invoice.id, amountMinor: 500_00n }],
        })
      ).rejects.toThrow(/still outstanding/);
    });

    it("refuses to allocate to a cancelled invoice", async () => {
      const invoice = await issuedInvoice(100_00n, new Date(2027, 5, 1));
      await invoiceRepository.cancel(invoice.id, businessId, userId);

      await expect(
        paymentRepository.record({
          businessId, createdById: userId, partyId, kind: "SALES",
          amountMinor: 100_00n,
          paymentDate: new Date(2027, 5, 2),
          allocations: [{ invoiceId: invoice.id, amountMinor: 100_00n }],
        })
      ).rejects.toThrow();
    });
  });

  describe("reallocating", () => {
    it("moves a payment between invoices without touching the books", async () => {
      const first = await issuedInvoice(300_00n, new Date(2028, 0, 1));
      const second = await issuedInvoice(300_00n, new Date(2028, 0, 2));

      const payment = await paymentRepository.record({
        businessId, createdById: userId, partyId, kind: "SALES",
        amountMinor: 300_00n,
        paymentDate: new Date(2028, 0, 3),
        allocations: [{ invoiceId: first.id, amountMinor: 300_00n }],
      });

      const balanceBefore = await prisma.partyBalance.findUniqueOrThrow({ where: { partyId } });

      await paymentRepository.reallocate(payment.id, businessId, [
        { invoiceId: second.id, amountMinor: 300_00n },
      ]);

      const [a, b, balanceAfter] = await Promise.all([
        prisma.invoice.findUniqueOrThrow({ where: { id: first.id } }),
        prisma.invoice.findUniqueOrThrow({ where: { id: second.id } }),
        prisma.partyBalance.findUniqueOrThrow({ where: { partyId } }),
      ]);

      expect(a.status).toBe("ISSUED");
      expect(a.paidMinor).toBe(0n);
      expect(b.status).toBe("PAID");
      // Only which document it settles changed, not the money.
      expect(balanceAfter.receivableMinor).toBe(balanceBefore.receivableMinor);
    });

    it("can split one payment across two invoices", async () => {
      const first = await issuedInvoice(200_00n, new Date(2028, 1, 1));
      const second = await issuedInvoice(200_00n, new Date(2028, 1, 2));

      const payment = await paymentRepository.record({
        businessId, createdById: userId, partyId, kind: "SALES",
        amountMinor: 300_00n,
        paymentDate: new Date(2028, 1, 3),
        allocations: [],
      });

      await paymentRepository.reallocate(payment.id, businessId, [
        { invoiceId: first.id, amountMinor: 200_00n },
        { invoiceId: second.id, amountMinor: 100_00n },
      ]);

      const [a, b] = await Promise.all([
        prisma.invoice.findUniqueOrThrow({ where: { id: first.id } }),
        prisma.invoice.findUniqueOrThrow({ where: { id: second.id } }),
      ]);

      expect(a.status).toBe("PAID");
      expect(b.status).toBe("PARTIALLY_PAID");
      expect(b.paidMinor).toBe(100_00n);
    });
  });

  describe("reversing", () => {
    it("undoes the posting and frees the invoice", async () => {
      const invoice = await issuedInvoice(600_00n, new Date(2028, 2, 1));

      const payment = await paymentRepository.record({
        businessId, createdById: userId, partyId, kind: "SALES",
        amountMinor: 600_00n,
        paymentDate: new Date(2028, 2, 2),
        allocations: [{ invoiceId: invoice.id, amountMinor: 600_00n }],
      });

      const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(paid.status).toBe("PAID");

      await paymentRepository.reverse(payment.id, businessId, userId, "bounced");

      const freed = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(freed.status).toBe("ISSUED");
      expect(freed.paidMinor).toBe(0n);

      // The record of what was received and then undone survives.
      const stillThere = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(stillThere).not.toBeNull();
    });

    it("restores the counterparty balance", async () => {
      const invoice = await issuedInvoice(400_00n, new Date(2028, 3, 1));
      const before = await prisma.partyBalance.findUniqueOrThrow({ where: { partyId } });

      const payment = await paymentRepository.record({
        businessId, createdById: userId, partyId, kind: "SALES",
        amountMinor: 400_00n,
        paymentDate: new Date(2028, 3, 2),
        allocations: [{ invoiceId: invoice.id, amountMinor: 400_00n }],
      });
      await paymentRepository.reverse(payment.id, businessId, userId);

      const after = await prisma.partyBalance.findUniqueOrThrow({ where: { partyId } });
      expect(after.receivableMinor).toBe(before.receivableMinor);
    });
  });

  describe("the books, after everything above", () => {
    it("stay balanced", async () => {
      const totals = await journalRepository.accountTotals(businessId);
      expect(totals.reduce((t, r) => t + (r._sum.amountMinor ?? 0n), 0n)).toBe(0n);
    });

    it("agree with the cached counterparty balance", async () => {
      const cached = await prisma.partyBalance.findUniqueOrThrow({ where: { partyId } });
      const rebuilt = await journalRepository.recomputePartyBalance(partyId, businessId);

      expect(rebuilt.receivableMinor).toBe(cached.receivableMinor);
      expect(rebuilt.payableMinor).toBe(cached.payableMinor);
    });

    it("never let an invoice be paid more than it asks for", async () => {
      const invoices = await prisma.invoice.findMany({
        where: { businessId },
        select: { id: true, number: true, totalMinor: true, paidMinor: true },
      });

      for (const invoice of invoices) {
        expect(invoice.paidMinor, `invoice ${invoice.number}`).toBeLessThanOrEqual(
          invoice.totalMinor
        );
      }
    });

    it("keep every allocation within its payment", async () => {
      const payments = await prisma.payment.findMany({
        where: { businessId },
        include: { allocations: true },
      });

      for (const payment of payments) {
        const allocated = payment.allocations.reduce((t, a) => t + a.amountMinor, 0n);
        expect(allocated, `payment ${payment.id}`).toBeLessThanOrEqual(payment.amountMinor);
      }
    });
  });
});
