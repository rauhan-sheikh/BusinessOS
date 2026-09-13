/**
 * Invoicing against a real database: numbering must be gapless, issuing must
 * post balanced entries, and the books must agree with the document.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/db";
import { invoiceRepository } from "./repositories/invoice.repository";
import { accountRepository } from "@/modules/accounting/repositories/account.repository";
import { journalRepository } from "@/modules/accounting/repositories/journal.repository";
import { toNaturalBalance } from "@/modules/accounting/chart-of-accounts";
import { financialYearOf } from "./numbering";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const PREFIX = "__invoice_integration__";

describe.skipIf(!hasDatabase)("invoicing (database)", () => {
  let businessId: string;
  let userId: string;
  let customerId: string;
  let outOfStateId: string;

  const issueDate = new Date(2026, 5, 15); // June 2026 -> FY 2026-27

  beforeAll(async () => {
    const business = await prisma.business.create({
      // 27 is Maharashtra; the leading digits of a GSTIN are the state code.
      data: { name: `${PREFIX} business`, currency: "INR", gstin: "27AAAAA0000A1Z5" },
    });
    businessId = business.id;

    const user = await prisma.user.create({
      data: {
        id: `${PREFIX}${Date.now()}`,
        name: "Invoice User",
        email: `${PREFIX}${Date.now()}@example.test`,
        emailVerified: true,
      },
    });
    userId = user.id;
    await prisma.businessUser.create({ data: { businessId, userId, role: "OWNER" } });
    await accountRepository.ensureSystemAccounts(businessId);

    const [inState, otherState] = await Promise.all([
      prisma.party.create({
        data: { businessId, name: `${PREFIX} in-state`, gstin: "27BBBBB1111B1Z5" },
      }),
      prisma.party.create({
        data: { businessId, name: `${PREFIX} out-of-state`, gstin: "29CCCCC2222C1Z5" },
      }),
    ]);
    customerId = inState.id;
    outOfStateId = otherState.id;
  });

  afterAll(async () => {
    if (!businessId) return;
    await prisma.paymentAllocation.deleteMany({ where: { invoice: { businessId } } });
    await prisma.invoiceLine.deleteMany({ where: { invoice: { businessId } } });
    await prisma.invoice.deleteMany({ where: { businessId } });
    await prisma.payment.deleteMany({ where: { businessId } });
    await prisma.item.deleteMany({ where: { businessId } });
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

  const draft = (over: Partial<Parameters<typeof invoiceRepository.createDraft>[0]> = {}) =>
    invoiceRepository.createDraft({
      businessId,
      createdById: userId,
      partyId: customerId,
      kind: "SALES",
      issueDate,
      lines: [
        {
          description: "Consulting",
          quantityMilli: 1000n,
          unitPriceMinor: 10_000_00n,
          taxRateBps: 1800,
        },
      ],
      ...over,
    });

  describe("drafts", () => {
    it("are created unnumbered and out of the books", async () => {
      const invoice = await draft();

      expect(invoice.status).toBe("DRAFT");
      // An abandoned draft must not consume a number.
      expect(invoice.number).toBeNull();
      expect(invoice.journalEntryId).toBeNull();
    });

    it("compute and store their totals", async () => {
      const invoice = await draft();

      expect(invoice.subtotalMinor).toBe(10_000_00n);
      expect(invoice.cgstMinor).toBe(900_00n);
      expect(invoice.sgstMinor).toBe(900_00n);
      expect(invoice.totalMinor).toBe(11_800_00n);
    });

    it("charge IGST when the counterparty is in another state", async () => {
      const invoice = await draft({ partyId: outOfStateId });

      expect(invoice.gstTreatment).toBe("INTER_STATE");
      expect(invoice.igstMinor).toBe(1_800_00n);
      expect(invoice.cgstMinor).toBe(0n);
    });

    it("can be deleted", async () => {
      const invoice = await draft();
      await invoiceRepository.deleteDraft(invoice.id, businessId);

      expect(await invoiceRepository.findById(invoice.id, businessId)).toBeNull();
    });
  });

  describe("issuing", () => {
    it("numbers by financial year, starting at one", async () => {
      const invoice = await invoiceRepository.issue(
        (await draft()).id,
        businessId,
        userId
      );

      expect(invoice.financialYear).toBe(financialYearOf(issueDate));
      expect(invoice.number).toBe("INV/2026-27/0001");
      expect(invoice.status).toBe("ISSUED");
    });

    it("allocates consecutive numbers with no gaps", async () => {
      const a = await invoiceRepository.issue((await draft()).id, businessId, userId);
      const b = await invoiceRepository.issue((await draft()).id, businessId, userId);

      expect(b.sequence).toBe((a.sequence ?? 0) + 1);
    });

    it("does not burn a number when issuing fails", async () => {
      // GST requires the sequence to be consecutive, so a failed attempt must
      // release its number rather than leave a hole.
      const before = await prisma.numberSequence.findFirstOrThrow({
        where: { businessId, documentType: "SALES_INVOICE" },
      });

      const alreadyIssued = await invoiceRepository.issue(
        (await draft()).id,
        businessId,
        userId
      );
      await expect(
        invoiceRepository.issue(alreadyIssued.id, businessId, userId)
      ).rejects.toThrow(/cannot be issued again/);

      const after = await prisma.numberSequence.findFirstOrThrow({
        where: { businessId, documentType: "SALES_INVOICE" },
      });

      // Exactly one number consumed, by the one that succeeded.
      expect(after.nextValue).toBe(before.nextValue + 1);
    });

    it("numbers bills on their own sequence", async () => {
      const bill = await invoiceRepository.issue(
        (await draft({ kind: "PURCHASE" })).id,
        businessId,
        userId
      );

      expect(bill.number).toMatch(/^BILL\/2026-27\/0001$/);
    });

    it("posts a balanced entry", async () => {
      const invoice = await invoiceRepository.issue(
        (await draft()).id,
        businessId,
        userId
      );

      const entry = await prisma.journalEntry.findUniqueOrThrow({
        where: { id: invoice.journalEntryId! },
        include: { lines: true },
      });

      expect(entry.lines.reduce((t, l) => t + l.amountMinor, 0n)).toBe(0n);
      expect(entry.sourceType).toBe("INVOICE");
      expect(entry.sourceId).toBe(invoice.id);
    });

    it("moves the counterparty balance by the gross", async () => {
      const before = await prisma.partyBalance.findUnique({ where: { partyId: customerId } });
      const invoice = await invoiceRepository.issue(
        (await draft()).id,
        businessId,
        userId
      );

      const after = await prisma.partyBalance.findUniqueOrThrow({
        where: { partyId: customerId },
      });

      expect(after.receivableMinor - (before?.receivableMinor ?? 0n)).toBe(
        invoice.totalMinor
      );
    });

    it("refuses a draft with no lines", async () => {
      const empty = await prisma.invoice.create({
        data: {
          businessId,
          partyId: customerId,
          kind: "SALES",
          issueDate,
          createdById: userId,
        },
      });

      await expect(
        invoiceRepository.issue(empty.id, businessId, userId)
      ).rejects.toThrow(/at least one line/);
    });
  });

  describe("cancelling", () => {
    it("reverses the posting but keeps the document and its number", async () => {
      const invoice = await invoiceRepository.issue(
        (await draft()).id,
        businessId,
        userId
      );
      const number = invoice.number;

      const cancelled = await invoiceRepository.cancel(
        invoice.id,
        businessId,
        userId,
        "duplicate"
      );

      expect(cancelled.status).toBe("CANCELLED");
      // Removing the number would leave a gap in the sequence.
      expect(cancelled.number).toBe(number);

      const entries = await prisma.journalEntry.findMany({
        where: { businessId, sourceId: invoice.id },
        include: { lines: true },
      });

      expect(entries).toHaveLength(2);
      const net = entries.flatMap((e) => e.lines).reduce((t, l) => t + l.amountMinor, 0n);
      expect(net).toBe(0n);
    });

    it("leaves the counterparty balance where it started", async () => {
      const before = await prisma.partyBalance.findUniqueOrThrow({
        where: { partyId: customerId },
      });

      const invoice = await invoiceRepository.issue(
        (await draft()).id,
        businessId,
        userId
      );
      await invoiceRepository.cancel(invoice.id, businessId, userId);

      const after = await prisma.partyBalance.findUniqueOrThrow({
        where: { partyId: customerId },
      });

      expect(after.receivableMinor).toBe(before.receivableMinor);
    });

    it("links the reversing entry to the original", async () => {
      const invoice = await invoiceRepository.issue(
        (await draft()).id,
        businessId,
        userId
      );
      await invoiceRepository.cancel(invoice.id, businessId, userId);

      // The link is not decoration: reversedEntryId is unique, and it is the
      // only thing standing between this and a second cancellation posting a
      // second opposing entry.
      const reversal = await prisma.journalEntry.findFirstOrThrow({
        where: { businessId, reversedEntryId: invoice.journalEntryId },
      });
      expect(reversal.sourceId).toBe(invoice.id);
    });

    it("posts one opposing entry even when two cancellations race", async () => {
      const invoice = await invoiceRepository.issue(
        (await draft()).id,
        businessId,
        userId
      );

      // The status check in cancel() is check-then-act: both callers can read
      // ISSUED before either commits. Before this went through the journal's
      // reverse(), both then posted an inverse entry and the books came out
      // reversed twice.
      const results = await Promise.allSettled([
        invoiceRepository.cancel(invoice.id, businessId, userId, "first"),
        invoiceRepository.cancel(invoice.id, businessId, userId, "second"),
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

      const reversals = await prisma.journalEntry.count({
        where: { businessId, reversedEntryId: invoice.journalEntryId },
      });
      expect(reversals).toBe(1);

      // Original plus exactly one reversal, netting to nothing.
      const entries = await prisma.journalEntry.findMany({
        where: { businessId, sourceId: invoice.id },
        include: { lines: true },
      });
      expect(entries).toHaveLength(2);
      expect(
        entries.flatMap((e) => e.lines).reduce((t, l) => t + l.amountMinor, 0n)
      ).toBe(0n);

      const cancelled = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
      });
      expect(cancelled.status).toBe("CANCELLED");
    });

    it("refuses to delete an issued invoice", async () => {
      const invoice = await invoiceRepository.issue(
        (await draft()).id,
        businessId,
        userId
      );

      await expect(
        invoiceRepository.deleteDraft(invoice.id, businessId)
      ).rejects.toThrow(/Only a draft can be deleted/);
    });
  });

  describe("the books", () => {
    it("stay balanced across everything above", async () => {
      const totals = await journalRepository.accountTotals(businessId);
      const sum = totals.reduce((t, row) => t + (row._sum.amountMinor ?? 0n), 0n);

      expect(sum).toBe(0n);
    });

    it("recognise revenue net of tax", async () => {
      const accounts = await accountRepository.requireSystemAccounts(businessId);
      const totals = await journalRepository.accountTotals(businessId);

      const salesId = accounts.get("SALES")!.id;
      const outputCgstId = accounts.get("GST_OUTPUT_CGST")!.id;

      const sales = totals.find((t) => t.accountId === salesId)?._sum.amountMinor ?? 0n;
      const cgst = totals.find((t) => t.accountId === outputCgstId)?._sum.amountMinor ?? 0n;

      // Both are credit-balance; tax sits in a liability, never in income.
      expect(toNaturalBalance("INCOME", sales)).toBeGreaterThan(0n);
      expect(toNaturalBalance("LIABILITY", cgst)).toBeGreaterThan(0n);
    });

    it("agree with every invoice document", async () => {
      const invoices = await prisma.invoice.findMany({
        where: { businessId, status: "ISSUED" },
        include: { lines: true },
      });

      for (const invoice of invoices) {
        const lineSum = invoice.lines.reduce((t, l) => t + l.lineTotalMinor, 0n);
        // The stored total must equal the sum of its lines plus any rounding,
        // or a printed invoice contradicts itself.
        expect(lineSum + invoice.roundingMinor, `invoice ${invoice.number}`).toBe(
          invoice.totalMinor
        );
      }
    });
  });
});
