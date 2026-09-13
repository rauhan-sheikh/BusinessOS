/**
 * Aging against a real database.
 *
 * A report fails quietly rather than loudly - it does not crash, it just shows
 * a number that is wrong - so these check the counting rules directly: what
 * belongs on the report, which bucket it lands in, and that the parts sum to
 * the whole.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/db";
import { invoiceRepository } from "../repositories/invoice.repository";
import { paymentRepository } from "../repositories/payment.repository";
import { accountRepository } from "@/modules/accounting/repositories/account.repository";
import { buildAgingReport } from "./aging";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const PREFIX = "__aging_integration__";

/** Fixed, so bucket boundaries are not at the mercy of the clock. */
const AS_AT = new Date(2026, 5, 30);
const daysBefore = (days: number) =>
  new Date(AS_AT.getTime() - days * 24 * 60 * 60 * 1000);

describe.skipIf(!hasDatabase)("aging report (database)", () => {
  let businessId: string;
  let userId: string;
  let acmeId: string;
  let globexId: string;

  beforeAll(async () => {
    const business = await prisma.business.create({
      data: { name: `${PREFIX} business`, currency: "INR", gstin: "27AAAAA0000A1Z5" },
    });
    businessId = business.id;

    const user = await prisma.user.create({
      data: {
        id: `${PREFIX}${Date.now()}`,
        name: "Aging User",
        email: `${PREFIX}${Date.now()}@example.test`,
        emailVerified: true,
      },
    });
    userId = user.id;
    await prisma.businessUser.create({ data: { businessId, userId, role: "OWNER" } });
    await accountRepository.ensureSystemAccounts(businessId);

    const [acme, globex] = await Promise.all([
      prisma.party.create({ data: { businessId, name: `${PREFIX} Acme` } }),
      prisma.party.create({ data: { businessId, name: `${PREFIX} Globex` } }),
    ]);
    acmeId = acme.id;
    globexId = globex.id;
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

  const invoice = async (
    partyId: string,
    totalMinor: bigint,
    dueDaysAgo: number | null,
    issueDaysAgo = 120
  ) => {
    const draft = await invoiceRepository.createDraft({
      businessId,
      createdById: userId,
      partyId,
      kind: "SALES",
      issueDate: daysBefore(issueDaysAgo),
      dueDate: dueDaysAgo === null ? null : daysBefore(dueDaysAgo),
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

  it("buckets by how far past due each invoice is", async () => {
    await invoice(acmeId, 100_00n, -10); // due in 10 days
    await invoice(acmeId, 200_00n, 15);
    await invoice(acmeId, 300_00n, 45);
    await invoice(acmeId, 400_00n, 75);
    await invoice(acmeId, 500_00n, 200);

    const report = await buildAgingReport(businessId, { asAt: AS_AT });
    const acme = report.parties.find((p) => p.partyId === acmeId)!;

    expect(acme.buckets["Not due"]).toBe(100_00n);
    expect(acme.buckets["1-30 days"]).toBe(200_00n);
    expect(acme.buckets["31-60 days"]).toBe(300_00n);
    expect(acme.buckets["61-90 days"]).toBe(400_00n);
    expect(acme.buckets["Over 90 days"]).toBe(500_00n);
  });

  it("counts only what is still outstanding, not the invoice total", async () => {
    const partly = await invoice(globexId, 1_000_00n, 40);
    await paymentRepository.record({
      businessId,
      createdById: userId,
      partyId: globexId,
      kind: "SALES",
      amountMinor: 600_00n,
      paymentDate: AS_AT,
      allocations: [{ invoiceId: partly.id, amountMinor: 600_00n }],
    });

    const report = await buildAgingReport(businessId, { asAt: AS_AT });
    const globex = report.parties.find((p) => p.partyId === globexId)!;

    expect(globex.totalOutstandingMinor).toBe(400_00n);
    expect(globex.buckets["31-60 days"]).toBe(400_00n);
  });

  it("drops an invoice once it is settled", async () => {
    const settled = await invoice(globexId, 250_00n, 10);
    await paymentRepository.record({
      businessId,
      createdById: userId,
      partyId: globexId,
      kind: "SALES",
      amountMinor: 250_00n,
      paymentDate: AS_AT,
      allocations: [{ invoiceId: settled.id, amountMinor: 250_00n }],
    });

    const report = await buildAgingReport(businessId, { asAt: AS_AT });
    const listed = report.parties
      .flatMap((p) => p.invoices)
      .find((i) => i.id === settled.id);

    expect(listed).toBeUndefined();
  });

  it("excludes drafts, which were never issued", async () => {
    const draft = await invoiceRepository.createDraft({
      businessId,
      createdById: userId,
      partyId: acmeId,
      kind: "SALES",
      issueDate: daysBefore(200),
      dueDate: daysBefore(150),
      lines: [
        { description: "Draft", quantityMilli: 1000n, unitPriceMinor: 9_999_00n },
      ],
    });

    const report = await buildAgingReport(businessId, { asAt: AS_AT });
    expect(report.parties.flatMap((p) => p.invoices).map((i) => i.id)).not.toContain(
      draft.id
    );
  });

  it("excludes a cancelled invoice, which was reversed out of the books", async () => {
    const cancelled = await invoice(acmeId, 777_00n, 30);
    await invoiceRepository.cancel(cancelled.id, businessId, userId);

    const report = await buildAgingReport(businessId, { asAt: AS_AT });
    expect(report.parties.flatMap((p) => p.invoices).map((i) => i.id)).not.toContain(
      cancelled.id
    );
  });

  it("treats an invoice with no due date as not due", async () => {
    await invoice(globexId, 50_00n, null);

    const report = await buildAgingReport(businessId, { asAt: AS_AT });
    const globex = report.parties.find((p) => p.partyId === globexId)!;
    const noDue = globex.invoices.find((i) => i.dueDate === null)!;

    expect(noDue.daysOverdue).toBe(0);
    expect(noDue.bucket).toBe("Not due");
  });

  it("adds up: buckets, parties and the grand total agree", async () => {
    const report = await buildAgingReport(businessId, { asAt: AS_AT });

    const fromBuckets = Object.values(report.bucketTotals).reduce((t, v) => t + v, 0n);
    const fromParties = report.parties.reduce((t, p) => t + p.totalOutstandingMinor, 0n);
    const fromInvoices = report.parties
      .flatMap((p) => p.invoices)
      .reduce((t, i) => t + i.outstandingMinor, 0n);

    expect(fromBuckets).toBe(report.totalOutstandingMinor);
    expect(fromParties).toBe(report.totalOutstandingMinor);
    expect(fromInvoices).toBe(report.totalOutstandingMinor);
  });

  it("reports overdue as everything except the not-due bucket", async () => {
    const report = await buildAgingReport(businessId, { asAt: AS_AT });

    expect(report.overdueMinor).toBe(
      report.totalOutstandingMinor - report.bucketTotals["Not due"]
    );
  });

  it("lists the largest exposure first", async () => {
    const report = await buildAgingReport(businessId, { asAt: AS_AT });
    const totals = report.parties.map((p) => p.totalOutstandingMinor);

    for (let i = 1; i < totals.length; i++) {
      expect(totals[i - 1] >= totals[i]).toBe(true);
    }
  });

  it("ages further as time passes", async () => {
    const later = new Date(AS_AT.getTime() + 60 * 24 * 60 * 60 * 1000);

    const now = await buildAgingReport(businessId, { asAt: AS_AT });
    const then = await buildAgingReport(businessId, { asAt: later });

    // Same money owed, but more of it past due.
    expect(then.totalOutstandingMinor).toBe(now.totalOutstandingMinor);
    expect(then.overdueMinor).toBeGreaterThan(now.overdueMinor);
  });

  it("is empty for a kind with no documents", async () => {
    const report = await buildAgingReport(businessId, { kind: "PURCHASE", asAt: AS_AT });

    expect(report.parties).toEqual([]);
    expect(report.totalOutstandingMinor).toBe(0n);
  });
});
