/**
 * Database-backed tests for the ledger.
 *
 * These assert the two properties that unit tests cannot: that concurrent
 * writers do not lose each other's updates, and that every stored snapshot
 * still agrees with the ledger it summarises.
 *
 * They skip themselves when DATABASE_URL is unset, so `npm test` stays runnable
 * without Postgres. CI provides a service container so they actually run.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/db";
import { transactionRepository } from "./repositories/transaction.repository";
import { recomputeBalance, type LedgerEntry } from "./ledger";

const hasDatabase = Boolean(process.env.DATABASE_URL);

const FIXTURE_PREFIX = "__ledger_integration__";

describe.skipIf(!hasDatabase)("ledger (database)", () => {
  let businessId: string;
  let userId: string;
  let partyId: string;

  beforeAll(async () => {
    const business = await prisma.business.create({
      data: { name: `${FIXTURE_PREFIX} business`, currency: "INR" },
    });
    businessId = business.id;

    const user = await prisma.user.create({
      data: {
        id: `${FIXTURE_PREFIX}${Date.now()}`,
        name: "Ledger Integration",
        email: `${FIXTURE_PREFIX}${Date.now()}@example.test`,
        emailVerified: true,
      },
    });
    userId = user.id;

    const party = await prisma.party.create({
      data: { businessId, name: `${FIXTURE_PREFIX} party` },
    });
    partyId = party.id;
  });

  afterAll(async () => {
    if (!businessId) return;
    // RESTRICT everywhere, so unwind in dependency order.
    await prisma.transaction.deleteMany({
      where: { businessId, transactionType: "REVERSAL" },
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

  it("does not lose concurrent balance updates", async () => {
    // On the previous read-modify-write implementation this fails: each writer
    // read the same snapshot and wrote an absolute value over the others.
    const concurrency = 25;
    const amountMinor = 1000n; // Rs.10.00 each

    await Promise.all(
      Array.from({ length: concurrency }, () =>
        transactionRepository.createWithBalanceUpdate({
          businessId,
          partyId,
          createdById: userId,
          transactionType: "SALE",
          amountMinor,
        })
      )
    );

    const balance = await prisma.partyBalance.findUniqueOrThrow({ where: { partyId } });

    expect(balance.receivableMinor).toBe(BigInt(concurrency) * amountMinor);
    expect(balance.payableMinor).toBe(0n);
  });

  it("keeps the snapshot equal to a full replay of the ledger", async () => {
    await transactionRepository.createWithBalanceUpdate({
      businessId,
      partyId,
      createdById: userId,
      transactionType: "PURCHASE",
      amountMinor: 500_00n,
    });
    await transactionRepository.createWithBalanceUpdate({
      businessId,
      partyId,
      createdById: userId,
      transactionType: "PAYMENT_RECEIVED",
      amountMinor: 100_00n,
    });

    const entries: LedgerEntry[] = await prisma.transaction.findMany({
      where: { partyId },
      select: {
        id: true,
        transactionType: true,
        direction: true,
        amountMinor: true,
        reversedTransactionId: true,
      },
    });

    const balance = await prisma.partyBalance.findUniqueOrThrow({ where: { partyId } });
    const replayed = recomputeBalance(entries);

    expect(balance.receivableMinor).toBe(replayed.receivableMinor);
    expect(balance.payableMinor).toBe(replayed.payableMinor);
  });

  it("tracks receivable and payable gross, never netting one into the other", async () => {
    const balance = await prisma.partyBalance.findUniqueOrThrow({ where: { partyId } });

    // Both sides carry a real figure at once - the case the old netted model
    // could not represent.
    expect(balance.receivableMinor).toBeGreaterThan(0n);
    expect(balance.payableMinor).toBeGreaterThan(0n);
  });

  it("reverses an entry back out and refuses to reverse it twice", async () => {
    const { transaction } = await transactionRepository.createWithBalanceUpdate({
      businessId,
      partyId,
      createdById: userId,
      transactionType: "SALE",
      amountMinor: 777_00n,
    });

    const before = await prisma.partyBalance.findUniqueOrThrow({ where: { partyId } });
    await transactionRepository.reverseTransaction(transaction.id, businessId, userId, "test");
    const after = await prisma.partyBalance.findUniqueOrThrow({ where: { partyId } });

    expect(after.receivableMinor).toBe(before.receivableMinor - 777_00n);

    await expect(
      transactionRepository.reverseTransaction(transaction.id, businessId, userId)
    ).rejects.toThrow(/already been reversed/i);
  });

  it("refuses to record a REVERSAL through the normal create path", async () => {
    await expect(
      transactionRepository.createWithBalanceUpdate({
        businessId,
        partyId,
        createdById: userId,
        transactionType: "REVERSAL",
        amountMinor: 999_00n,
        direction: "RECEIVABLE",
      })
    ).rejects.toThrow(/cannot be recorded directly/i);
  });

  it("rejects a non-positive amount at the database level", async () => {
    // The CHECK constraint backstops the Zod schema, so no code path or manual
    // console session can post a zero or negative entry.
    await expect(
      prisma.transaction.create({
        data: {
          businessId,
          partyId,
          transactionType: "SALE",
          amountMinor: -1n,
          createdById: userId,
        },
      })
    ).rejects.toThrow();
  });

  it("agrees with the SQL backfill for every party already in the database", async () => {
    // Guards the duplicated scoring logic in the recompute_gross_balances
    // migration against the TypeScript engine.
    const balances = await prisma.partyBalance.findMany({
      select: { partyId: true, receivableMinor: true, payableMinor: true },
    });

    for (const balance of balances) {
      const entries: LedgerEntry[] = await prisma.transaction.findMany({
        where: { partyId: balance.partyId },
        select: {
          id: true,
          transactionType: true,
          direction: true,
          amountMinor: true,
          reversedTransactionId: true,
        },
      });

      const replayed = recomputeBalance(entries);

      expect(
        { partyId: balance.partyId, ...replayed },
        `snapshot drifted from ledger for party ${balance.partyId}`
      ).toEqual({
        partyId: balance.partyId,
        receivableMinor: balance.receivableMinor,
        payableMinor: balance.payableMinor,
      });
    }
  });
});
