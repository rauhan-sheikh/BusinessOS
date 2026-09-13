/**
 * The risk in moving to a journal is that the migrated books disagree with the
 * balances the old ledger produced. These build a workspace with the old model,
 * run the backfill, and assert the journal reproduces exactly the same figures -
 * and that the books balance, which the old model could not even express.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/db";
import { transactionRepository } from "@/modules/transactions/repositories/transaction.repository";
import { backfillJournal } from "./backfill";
import { journalRepository } from "./repositories/journal.repository";
import { accountRepository } from "./repositories/account.repository";
import { SYSTEM_ACCOUNTS, toNaturalBalance } from "./chart-of-accounts";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const PREFIX = "__backfill_integration__";

describe.skipIf(!hasDatabase)("journal backfill (database)", () => {
  let businessId: string;
  let userId: string;
  let customerId: string;
  let supplierId: string;
  let bothId: string;
  /** Balances the old ledger produced, captured before the backfill. */
  let legacyBalances: Record<string, { receivable: bigint; payable: bigint }> = {};

  beforeAll(async () => {
    const business = await prisma.business.create({
      data: { name: `${PREFIX} business`, currency: "INR" },
    });
    businessId = business.id;

    const user = await prisma.user.create({
      data: {
        id: `${PREFIX}${Date.now()}`,
        name: "Backfill User",
        email: `${PREFIX}${Date.now()}@example.test`,
        emailVerified: true,
      },
    });
    userId = user.id;
    await prisma.businessUser.create({
      data: { businessId, userId, role: "OWNER" },
    });

    const [customer, supplier, both] = await Promise.all([
      prisma.party.create({ data: { businessId, name: `${PREFIX} customer` } }),
      prisma.party.create({ data: { businessId, name: `${PREFIX} supplier` } }),
      prisma.party.create({ data: { businessId, name: `${PREFIX} both` } }),
    ]);
    customerId = customer.id;
    supplierId = supplier.id;
    bothId = both.id;

    // Build history through the old ledger, covering every transaction type.
    const post = (params: Parameters<typeof transactionRepository.createWithBalanceUpdate>[0]) =>
      transactionRepository.createWithBalanceUpdate(params);

    await post({
      businessId, partyId: customerId, createdById: userId,
      transactionType: "OPENING_BALANCE", amountMinor: 20_000_00n, direction: "RECEIVABLE",
    });
    await post({
      businessId, partyId: customerId, createdById: userId,
      transactionType: "SALE", amountMinor: 5_000_00n,
    });
    await post({
      businessId, partyId: customerId, createdById: userId,
      transactionType: "PAYMENT_RECEIVED", amountMinor: 8_000_00n,
    });

    await post({
      businessId, partyId: supplierId, createdById: userId,
      transactionType: "OPENING_BALANCE", amountMinor: 12_500_00n, direction: "PAYABLE",
    });
    await post({
      businessId, partyId: supplierId, createdById: userId,
      transactionType: "PURCHASE", amountMinor: 2_000_00n,
    });
    await post({
      businessId, partyId: supplierId, createdById: userId,
      transactionType: "PAYMENT_MADE", amountMinor: 1_500_00n,
    });

    // A counterparty on both sides at once - the case the netted model could
    // not represent, and the reason gross balances exist.
    await post({
      businessId, partyId: bothId, createdById: userId,
      transactionType: "SALE", amountMinor: 10_000_00n,
    });
    await post({
      businessId, partyId: bothId, createdById: userId,
      transactionType: "PURCHASE", amountMinor: 8_000_00n,
    });
    await post({
      businessId, partyId: bothId, createdById: userId,
      transactionType: "ADJUSTMENT", amountMinor: 250_00n, direction: "RECEIVABLE",
    });

    // A reversal, so the backfill has to invert an original.
    const { transaction: toReverse } = await post({
      businessId, partyId: customerId, createdById: userId,
      transactionType: "SALE", amountMinor: 777_00n,
    });
    await transactionRepository.reverseTransaction(toReverse.id, businessId, userId, "test");

    const balances = await prisma.partyBalance.findMany({ where: { businessId } });
    legacyBalances = Object.fromEntries(
      balances.map((b) => [
        b.partyId,
        { receivable: b.receivableMinor, payable: b.payableMinor },
      ])
    );
  });

  afterAll(async () => {
    if (!businessId) return;
    await prisma.journalLine.deleteMany({ where: { journalEntry: { businessId } } });
    // reversedEntryId is a self-reference with onDelete: Restrict, so clear it
    // before removing the rows it points at.
    await prisma.journalEntry.updateMany({
      where: { businessId },
      data: { reversedEntryId: null },
    });
    await prisma.journalEntry.deleteMany({ where: { businessId } });
    await prisma.ledgerAccount.deleteMany({ where: { businessId } });
    await prisma.transaction.updateMany({
      where: { businessId },
      data: { reversedTransactionId: null },
    });
    await prisma.transaction.deleteMany({ where: { businessId } });
    await prisma.partyBalance.deleteMany({ where: { businessId } });
    await prisma.party.deleteMany({ where: { businessId } });
    await prisma.auditLog.deleteMany({ where: { businessId } });
    await prisma.businessUser.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("seeds the full chart of accounts", async () => {
    await backfillJournal(userId, { businessId });

    const accounts = await accountRepository.requireSystemAccounts(businessId);
    expect(accounts.size).toBe(SYSTEM_ACCOUNTS.length);
    expect(accounts.get("ACCOUNTS_RECEIVABLE")?.isControl).toBe(true);
    expect(accounts.get("ACCOUNTS_PAYABLE")?.isControl).toBe(true);
  });

  it("posts one journal entry per legacy transaction", async () => {
    const [transactions, entries] = await Promise.all([
      prisma.transaction.count({ where: { businessId } }),
      prisma.journalEntry.count({
        where: { businessId, sourceType: "LEGACY_TRANSACTION" },
      }),
    ]);

    expect(entries).toBe(transactions);
  });

  it("produces balances identical to the old ledger", async () => {
    // The migration must not change a single figure a user already sees.
    const rebuilt = await prisma.partyBalance.findMany({ where: { businessId } });

    for (const balance of rebuilt) {
      const legacy = legacyBalances[balance.partyId];
      expect(balance.receivableMinor, `receivable for ${balance.partyId}`).toBe(
        legacy.receivable
      );
      expect(balance.payableMinor, `payable for ${balance.partyId}`).toBe(legacy.payable);
    }
  });

  it("keeps gross receivable and payable for a party that is both", async () => {
    const balance = await prisma.partyBalance.findUniqueOrThrow({
      where: { partyId: bothId },
    });

    expect(balance.receivableMinor).toBe(10_250_00n);
    expect(balance.payableMinor).toBe(8_000_00n);
  });

  it("balances: every entry sums to zero", async () => {
    const entries = await prisma.journalEntry.findMany({
      where: { businessId },
      include: { lines: true },
    });

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const sum = entry.lines.reduce((t, l) => t + l.amountMinor, 0n);
      expect(sum, `entry ${entry.id} does not balance`).toBe(0n);
    }
  });

  it("balances: the whole trial balance sums to zero", async () => {
    // The check the old subsidiary ledger could not even express.
    const totals = await journalRepository.accountTotals(businessId);
    const sum = totals.reduce((t, row) => t + (row._sum.amountMinor ?? 0n), 0n);

    expect(sum).toBe(0n);
  });

  it("recognises revenue net of nothing, since the old model had no tax", async () => {
    const accounts = await accountRepository.requireSystemAccounts(businessId);
    const totals = await journalRepository.accountTotals(businessId);

    const salesId = accounts.get("SALES")!.id;
    const sales = totals.find((t) => t.accountId === salesId)?._sum.amountMinor ?? 0n;

    // 5,000 + 10,000 + 777 sold, less the 777 reversed.
    expect(toNaturalBalance("INCOME", sales)).toBe(15_000_00n);
  });

  it("balances opening amounts against equity rather than income", async () => {
    const accounts = await accountRepository.requireSystemAccounts(businessId);
    const totals = await journalRepository.accountTotals(businessId);

    const equityId = accounts.get("OPENING_BALANCE_EQUITY")!.id;
    const equity = totals.find((t) => t.accountId === equityId)?._sum.amountMinor ?? 0n;

    // 20,000 receivable brought in, less 12,500 payable brought in.
    expect(toNaturalBalance("EQUITY", equity)).toBe(7_500_00n);
  });

  it("is idempotent, so an interrupted run can simply be repeated", async () => {
    const before = await prisma.journalEntry.count({ where: { businessId } });

    const report = await backfillJournal(userId, { businessId });

    const after = await prisma.journalEntry.count({ where: { businessId } });
    expect(after).toBe(before);
    expect(report.entriesCreated).toBe(0);
    expect(report.transactionsSkipped).toBeGreaterThan(0);
  });

  it("recomputing a balance from the journal is stable", async () => {
    const before = await prisma.partyBalance.findUniqueOrThrow({
      where: { partyId: customerId },
    });

    const after = await journalRepository.recomputePartyBalance(customerId, businessId);

    expect(after.receivableMinor).toBe(before.receivableMinor);
    expect(after.payableMinor).toBe(before.payableMinor);
  });
});
