import { prisma } from "@/db";
import type {
  Prisma,
  TransactionType,
  BalanceDirection,
} from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";
import {
  effectOf,
  invert,
  recomputeBalance,
  type BalanceEffect,
  type LedgerEntry,
} from "../ledger";

export interface TransactionFilterOptions {
  partyId?: string;
  type?: TransactionType;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface CreateTransactionParams {
  businessId: string;
  partyId: string;
  createdById: string;
  transactionType: TransactionType;
  amountMinor: bigint;
  direction?: BalanceDirection | null;
  transactionDate?: Date | null;
  notes?: string | null;
  referenceNumber?: string | null;
}

const LEDGER_ENTRY_SELECT = {
  id: true,
  transactionType: true,
  direction: true,
  amountMinor: true,
  reversedTransactionId: true,
} as const;

/**
 * Turns a scored effect into a Prisma atomic update.
 *
 * `increment` with a signed delta is applied in-place by Postgres under a row
 * lock, so concurrent writers serialise instead of each reading a stale
 * snapshot and overwriting the other.
 */
function balanceIncrement(effect: BalanceEffect, amountMinor: bigint) {
  const delta = BigInt(effect.sign) * amountMinor;

  return effect.column === "receivableMinor"
    ? { receivableMinor: { increment: delta } }
    : { payableMinor: { increment: delta } };
}

/** The opening totals for a balance row created by its first entry. */
function balanceSeed(effect: BalanceEffect, amountMinor: bigint) {
  const delta = BigInt(effect.sign) * amountMinor;

  return {
    receivableMinor: effect.column === "receivableMinor" ? delta : 0n,
    payableMinor: effect.column === "payableMinor" ? delta : 0n,
  };
}

async function assertPartyInBusiness(
  tx: Prisma.TransactionClient,
  partyId: string,
  businessId: string
) {
  const party = await tx.party.findFirst({
    where: { id: partyId, businessId },
    select: { id: true },
  });

  if (!party) {
    throw new AppError("Party not found", 404);
  }
}

export const transactionRepository = {
  async findMany(businessId: string, options?: TransactionFilterOptions) {
    const { partyId, type, search, startDate, endDate, limit = 50, offset = 0 } = options || {};

    const where = {
      businessId,
      ...(partyId ? { partyId } : {}),
      ...(type ? { transactionType: type } : {}),
      // Filtered on the business date, not the insert timestamp, so back-dated
      // entries fall in the period they actually belong to.
      ...(startDate || endDate
        ? {
            transactionDate: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { referenceNumber: { contains: search, mode: "insensitive" as const } },
              { notes: { contains: search, mode: "insensitive" as const } },
              { party: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          party: {
            select: { id: true, name: true, phone: true, gstin: true, pan: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, totalCount };
  },

  async findById(id: string, businessId: string) {
    return prisma.transaction.findFirst({
      where: { id, businessId },
      include: {
        party: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
  },

  /**
   * Records a ledger entry and moves the party's balance, atomically.
   *
   * REVERSAL is rejected here: reversals carry guards this path cannot apply,
   * and must go through reverseTransaction.
   */
  async createWithBalanceUpdate(params: CreateTransactionParams) {
    if (params.transactionType === "REVERSAL") {
      throw new AppError(
        "Reversals cannot be recorded directly; reverse the original transaction instead.",
        400
      );
    }

    const effect = effectOf(params.transactionType, params.direction ?? null);

    return prisma.$transaction(async (tx) => {
      await assertPartyInBusiness(tx, params.partyId, params.businessId);

      const transaction = await tx.transaction.create({
        data: {
          businessId: params.businessId,
          partyId: params.partyId,
          transactionType: params.transactionType,
          amountMinor: params.amountMinor,
          direction: params.direction ?? null,
          transactionDate: params.transactionDate ?? new Date(),
          notes: params.notes ?? null,
          referenceNumber: params.referenceNumber ?? null,
          createdById: params.createdById,
        },
        include: {
          party: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      const updatedBalance = await tx.partyBalance.upsert({
        where: { partyId: params.partyId },
        create: {
          businessId: params.businessId,
          partyId: params.partyId,
          ...balanceSeed(effect, params.amountMinor),
        },
        update: balanceIncrement(effect, params.amountMinor),
      });

      return { transaction, updatedBalance };
    });
  },

  /**
   * Reverses an entry by posting an opposing REVERSAL entry.
   *
   * The original is never mutated. A transaction can be reversed at most once -
   * enforced by the unique constraint on reversedTransactionId, so two
   * concurrent requests cannot both pass a check and double-apply the inverse.
   */
  async reverseTransaction(
    originalTransactionId: string,
    businessId: string,
    userId: string,
    reason?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const original = await tx.transaction.findFirst({
        where: { id: originalTransactionId, businessId },
        select: { ...LEDGER_ENTRY_SELECT, partyId: true, referenceNumber: true },
      });

      if (!original) {
        throw new AppError("Transaction not found", 404);
      }

      if (original.transactionType === "REVERSAL") {
        throw new AppError("Cannot reverse a reversal transaction", 400);
      }

      const effect = invert(effectOf(original.transactionType, original.direction));

      const reversal = await tx.transaction
        .create({
          data: {
            businessId,
            partyId: original.partyId,
            transactionType: "REVERSAL",
            amountMinor: original.amountMinor,
            // Recorded for display and filtering. The engine re-derives the
            // effect from the original rather than trusting this value.
            direction: effect.column === "receivableMinor" ? "RECEIVABLE" : "PAYABLE",
            transactionDate: new Date(),
            notes: reason
              ? `Reversal: ${reason}`
              : `Reversal of transaction #${original.id.slice(0, 8)}`,
            referenceNumber: original.referenceNumber
              ? `REV-${original.referenceNumber}`
              : null,
            reversedTransactionId: original.id,
            createdById: userId,
          },
          include: {
            party: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
          },
        })
        .catch((err: unknown) => {
          if (
            typeof err === "object" &&
            err !== null &&
            (err as { code?: string }).code === "P2002"
          ) {
            throw new AppError("This transaction has already been reversed", 409);
          }
          throw err;
        });

      await tx.partyBalance.upsert({
        where: { partyId: original.partyId },
        create: {
          businessId,
          partyId: original.partyId,
          ...balanceSeed(effect, original.amountMinor),
        },
        update: balanceIncrement(effect, original.amountMinor),
      });

      return reversal;
    });
  },

  /**
   * Rebuilds a party's snapshot by replaying its whole ledger.
   *
   * The ledger is the source of truth; PartyBalance is a cache of it. This is
   * the repair path for a snapshot suspected of having drifted, and the
   * backfill used when balance semantics change.
   */
  async recomputeBalanceForParty(partyId: string, businessId: string) {
    return prisma.$transaction(async (tx) => {
      await assertPartyInBusiness(tx, partyId, businessId);

      const entries: LedgerEntry[] = await tx.transaction.findMany({
        where: { partyId, businessId },
        select: LEDGER_ENTRY_SELECT,
      });

      const totals = recomputeBalance(entries);

      return tx.partyBalance.upsert({
        where: { partyId },
        create: { businessId, partyId, ...totals },
        update: totals,
      });
    });
  },
};
