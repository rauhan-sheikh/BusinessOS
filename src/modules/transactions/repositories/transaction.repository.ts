import { prisma } from "@/db";
import type { TransactionType, OpeningBalanceType } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";

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
  openingBalanceType?: OpeningBalanceType | null;
  notes?: string | null;
  referenceNumber?: string | null;
  reversedTransactionId?: string | null;
}

export const transactionRepository = {
  async findMany(businessId: string, options?: TransactionFilterOptions) {
    const { partyId, type, search, startDate, endDate, limit = 50, offset = 0 } = options || {};

    const where = {
      businessId,
      ...(partyId ? { partyId } : {}),
      ...(type ? { transactionType: type } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
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
        orderBy: { createdAt: "desc" },
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
   * Executes atomic creation of a ledger transaction and updates the party's snapshot balance.
   */
  async createWithBalanceUpdate(params: CreateTransactionParams) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify party exists and belongs to this business
      const party = await tx.party.findFirst({
        where: { id: params.partyId, businessId: params.businessId },
        include: { balance: true },
      });

      if (!party) {
        throw new AppError("Party not found", 404);
      }

      // 2. Fetch or initialize current balance
      let currentBalance = party.balance;
      if (!currentBalance) {
        currentBalance = await tx.partyBalance.create({
          data: {
            businessId: params.businessId,
            partyId: params.partyId,
            receivableMinor: BigInt(0),
            payableMinor: BigInt(0),
          },
        });
      }

      // 3. Compute net balance delta based on transaction type
      // Net balance is defined as: (receivable - payable)
      // Positive = Party owes Business. Negative = Business owes Party.
      let netDelta = BigInt(0);
      const amount = params.amountMinor;

      switch (params.transactionType) {
        case "SALE":
          // Increases what customer owes us
          netDelta = amount;
          break;
        case "PAYMENT_RECEIEVED":
          // Decreases what customer owes us
          netDelta = -amount;
          break;
        case "PURCHASE":
          // Decreases net balance (increases what we owe vendor)
          netDelta = -amount;
          break;
        case "PAYMENT_MADE":
          // Increases net balance (reduces what we owe vendor)
          netDelta = amount;
          break;
        case "OPENING_BALANCE":
          netDelta = params.openingBalanceType === "RECEIVABLE" ? amount : -amount;
          break;
        case "ADJUSTMENT":
          netDelta = params.openingBalanceType === "RECEIVABLE" ? amount : -amount;
          break;
        case "REVERSAL":
          // Handled via reverseTransaction specific calculation
          netDelta = params.openingBalanceType === "RECEIVABLE" ? amount : -amount;
          break;
      }

      const currentNet = currentBalance.receivableMinor - currentBalance.payableMinor;
      const newNet = currentNet + netDelta;

      let newReceivable = BigInt(0);
      let newPayable = BigInt(0);

      if (newNet >= BigInt(0)) {
        newReceivable = newNet;
        newPayable = BigInt(0);
      } else {
        newReceivable = BigInt(0);
        newPayable = -newNet;
      }

      // 4. Update PartyBalance snapshot atomically
      const updatedBalance = await tx.partyBalance.update({
        where: { id: currentBalance.id },
        data: {
          receivableMinor: newReceivable,
          payableMinor: newPayable,
        },
      });

      // 5. Create immutable transaction record
      const transaction = await tx.transaction.create({
        data: {
          businessId: params.businessId,
          partyId: params.partyId,
          transactionType: params.transactionType,
          amountMinor: params.amountMinor,
          OpeningBalanceType: params.openingBalanceType ?? null,
          notes: params.notes ?? null,
          referenceNumber: params.referenceNumber ?? null,
          reversedTransactionId: params.reversedTransactionId ?? null,
          createdById: params.createdById,
        },
        include: {
          party: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      return { transaction, updatedBalance };
    });
  },

  /**
   * Reverses an existing transaction and restores the party balance atomically.
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
        include: { party: { include: { balance: true } } },
      });

      if (!original) {
        throw new AppError("Transaction not found", 404);
      }

      if (original.transactionType === "REVERSAL") {
        throw new AppError("Cannot reverse a reversal transaction", 400);
      }

      // Check if already reversed
      const existingReversal = await tx.transaction.findFirst({
        where: { reversedTransactionId: originalTransactionId, businessId },
      });

      if (existingReversal) {
        throw new AppError("This transaction has already been reversed", 400);
      }

      // Calculate inverse delta
      let originalDelta = BigInt(0);
      const amount = original.amountMinor;

      switch (original.transactionType) {
        case "SALE":
          originalDelta = amount;
          break;
        case "PAYMENT_RECEIEVED":
          originalDelta = -amount;
          break;
        case "PURCHASE":
          originalDelta = -amount;
          break;
        case "PAYMENT_MADE":
          originalDelta = amount;
          break;
        case "OPENING_BALANCE":
        case "ADJUSTMENT":
          originalDelta = original.OpeningBalanceType === "RECEIVABLE" ? amount : -amount;
          break;
      }

      // Inverse effect:
      const reverseDelta = -originalDelta;
      const balance = original.party.balance!;
      const currentNet = balance.receivableMinor - balance.payableMinor;
      const newNet = currentNet + reverseDelta;

      let newReceivable = BigInt(0);
      let newPayable = BigInt(0);

      if (newNet >= BigInt(0)) {
        newReceivable = newNet;
        newPayable = BigInt(0);
      } else {
        newReceivable = BigInt(0);
        newPayable = -newNet;
      }

      await tx.partyBalance.update({
        where: { id: balance.id },
        data: {
          receivableMinor: newReceivable,
          payableMinor: newPayable,
        },
      });

      const reversalTx = await tx.transaction.create({
        data: {
          businessId,
          partyId: original.partyId,
          transactionType: "REVERSAL",
          amountMinor: original.amountMinor,
          OpeningBalanceType: reverseDelta >= BigInt(0) ? "RECEIVABLE" : "PAYABLE",
          notes: reason ? `Reversal: ${reason}` : `Reversal of transaction #${original.id.slice(0, 8)}`,
          referenceNumber: original.referenceNumber ? `REV-${original.referenceNumber}` : null,
          reversedTransactionId: original.id,
          createdById: userId,
        },
        include: {
          party: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      return reversalTx;
    });
  },
};
