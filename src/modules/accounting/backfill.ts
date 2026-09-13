/**
 * Converts the pre-journal Transaction ledger into journal entries.
 *
 * Run once per environment. Idempotent: a transaction that already has a
 * corresponding entry is skipped, so an interrupted run can simply be repeated.
 *
 * Transaction is not deleted. It becomes what an Invoice or Bill will be - a
 * document the user created - while the journal holds the accounting. Balances
 * are then recomputed from the journal, which becomes the source of truth.
 */
import { prisma } from "@/db";
import type { Prisma } from "@/generated/prisma/client";
import { accountRepository } from "./repositories/account.repository";
import { journalRepository } from "./repositories/journal.repository";
import {
  postOpeningBalance,
  postAdjustment,
  postPaymentReceived,
  postPaymentMade,
  postInvoice,
  postBill,
  NO_TAX,
} from "./postings";
import { invertLines, type DraftLine } from "./journal";
import { AppError } from "@/shared/errors/app-error";

interface LegacyTransaction {
  id: string;
  partyId: string;
  transactionType: string;
  amountMinor: bigint;
  direction: string | null;
  transactionDate: Date;
  notes: string | null;
  reversedTransactionId: string | null;
}

/**
 * The journal lines equivalent to one legacy transaction.
 *
 * The old ledger recorded only a net effect on a party balance, with no second
 * account, so the counterpart is inferred from the type. A SALE becomes a
 * tax-free invoice posting: the old model had no concept of tax, so treating
 * the whole amount as net revenue is the only honest reading of it.
 */
export function linesForLegacyTransaction(
  txn: LegacyTransaction,
  originalOf?: LegacyTransaction
): DraftLine[] {
  const { partyId, amountMinor, direction } = txn;

  switch (txn.transactionType) {
    case "SALE":
      return postInvoice({
        partyId,
        subtotalMinor: amountMinor,
        tax: NO_TAX,
        totalMinor: amountMinor,
      });

    case "PURCHASE":
      return postBill({
        partyId,
        subtotalMinor: amountMinor,
        tax: NO_TAX,
        totalMinor: amountMinor,
      });

    case "PAYMENT_RECEIVED":
      return postPaymentReceived(partyId, amountMinor);

    case "PAYMENT_MADE":
      return postPaymentMade(partyId, amountMinor);

    case "OPENING_BALANCE":
      return postOpeningBalance(
        partyId,
        amountMinor,
        direction === "PAYABLE" ? "PAYABLE" : "RECEIVABLE"
      );

    case "ADJUSTMENT":
      return postAdjustment(
        partyId,
        amountMinor,
        direction === "PAYABLE" ? "PAYABLE" : "RECEIVABLE"
      );

    case "REVERSAL": {
      if (!originalOf) {
        throw new AppError(
          `Legacy reversal ${txn.id} has no original transaction to invert.`,
          500
        );
      }
      return invertLines(linesForLegacyTransaction(originalOf));
    }

    default:
      throw new AppError(
        `Unknown legacy transaction type "${txn.transactionType}" on ${txn.id}.`,
        500
      );
  }
}

export interface BackfillReport {
  businesses: number;
  accountsCreated: number;
  entriesCreated: number;
  transactionsSkipped: number;
  partiesRebalanced: number;
  /** Parties whose recomputed balance differed from the stored one. */
  balancesCorrected: Array<{
    partyId: string;
    before: { receivableMinor: string; payableMinor: string };
    after: { receivableMinor: string; payableMinor: string };
  }>;
}

export interface BackfillOptions {
  /**
   * Restrict the run to one workspace.
   *
   * Without it every business in the database is migrated, which is right for a
   * release but wrong almost everywhere else - a test that omitted this
   * migrated the developer's real workspace and attributed the entries to a
   * fixture user.
   */
  businessId?: string;
  tx?: Prisma.TransactionClient;
}

/**
 * Seeds the chart of accounts and posts every legacy transaction.
 *
 * Reversals are posted after their originals, so a REVERSAL can always find the
 * entry it inverts.
 */
export async function backfillJournal(
  actorUserId: string,
  options: BackfillOptions = {}
): Promise<BackfillReport> {
  const tx = options.tx ?? prisma;
  const report: BackfillReport = {
    businesses: 0,
    accountsCreated: 0,
    entriesCreated: 0,
    transactionsSkipped: 0,
    partiesRebalanced: 0,
    balancesCorrected: [],
  };

  const businesses = await tx.business.findMany({
    where: options.businessId ? { id: options.businessId } : {},
    select: { id: true },
  });
  report.businesses = businesses.length;

  for (const business of businesses) {
    const before = await tx.ledgerAccount.count({ where: { businessId: business.id } });
    await accountRepository.ensureSystemAccounts(business.id, tx);
    const after = await tx.ledgerAccount.count({ where: { businessId: business.id } });
    report.accountsCreated += after - before;

    const transactions = (await tx.transaction.findMany({
      where: { businessId: business.id },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        partyId: true,
        transactionType: true,
        amountMinor: true,
        direction: true,
        transactionDate: true,
        notes: true,
        reversedTransactionId: true,
      },
    })) as LegacyTransaction[];

    const byId = new Map(transactions.map((t) => [t.id, t]));

    // Already-posted transactions are skipped, so a repeated run is harmless.
    const posted = await tx.journalEntry.findMany({
      where: { businessId: business.id, sourceType: "LEGACY_TRANSACTION" },
      select: { sourceId: true },
    });
    const postedIds = new Set(posted.map((e) => e.sourceId));

    // Originals first, so a reversal always finds what it inverts.
    const ordered = [
      ...transactions.filter((t) => t.transactionType !== "REVERSAL"),
      ...transactions.filter((t) => t.transactionType === "REVERSAL"),
    ];

    for (const txn of ordered) {
      if (postedIds.has(txn.id)) {
        report.transactionsSkipped += 1;
        continue;
      }

      const original = txn.reversedTransactionId
        ? byId.get(txn.reversedTransactionId)
        : undefined;

      await journalRepository.post(
        {
          businessId: business.id,
          createdById: actorUserId,
          entryDate: txn.transactionDate,
          sourceType: "LEGACY_TRANSACTION",
          sourceId: txn.id,
          narration: txn.notes ?? `Migrated ${txn.transactionType}`,
          lines: linesForLegacyTransaction(txn, original),
        },
        tx
      );

      report.entriesCreated += 1;
    }

    // Balances are now derived from the journal rather than maintained
    // alongside it, so rebuild every one and record any that disagreed.
    const parties = await tx.party.findMany({
      where: { businessId: business.id },
      select: { id: true, balance: true },
    });

    for (const party of parties) {
      const previous = {
        receivableMinor: (party.balance?.receivableMinor ?? 0n).toString(),
        payableMinor: (party.balance?.payableMinor ?? 0n).toString(),
      };

      const rebuilt = await journalRepository.recomputePartyBalance(
        party.id,
        business.id,
        tx
      );
      report.partiesRebalanced += 1;

      const now = {
        receivableMinor: rebuilt.receivableMinor.toString(),
        payableMinor: rebuilt.payableMinor.toString(),
      };

      if (
        now.receivableMinor !== previous.receivableMinor ||
        now.payableMinor !== previous.payableMinor
      ) {
        report.balancesCorrected.push({
          partyId: party.id,
          before: previous,
          after: now,
        });
      }
    }
  }

  return report;
}
