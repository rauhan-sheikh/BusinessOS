import {
  transactionRepository,
  type TransactionFilterOptions,
} from "../repositories/transaction.repository";
import {
  createTransactionSchema,
  reverseTransactionSchema,
  type CreateTransactionInput,
  type ReverseTransactionInput,
} from "../schemas/transaction.schema";
import { auditService } from "@/modules/audit/services/audit.service";
import { toMinorUnits } from "@/shared/utils/currency";
import { PERMISSION, requirePermission, type Actor } from "@/modules/auth/permissions";

export class TransactionService {
  async listTransactions(businessId: string, actor: Actor, options?: TransactionFilterOptions) {
    requirePermission(actor, PERMISSION.TRANSACTION_VIEW);
    return transactionRepository.findMany(businessId, options);
  }

  async getTransactionById(id: string, businessId: string, actor: Actor) {
    requirePermission(actor, PERMISSION.TRANSACTION_VIEW);
    return transactionRepository.findById(id, businessId);
  }

  async recordTransaction(
    businessId: string,
    actor: Actor,
    input: CreateTransactionInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    requirePermission(actor, PERMISSION.TRANSACTION_CREATE);

    const validated = createTransactionSchema.parse(input);
    const amountMinor = toMinorUnits(validated.amount);

    const { transaction, updatedBalance } = await transactionRepository.createWithBalanceUpdate({
      businessId,
      partyId: validated.partyId,
      createdById: actor.userId,
      transactionType: validated.transactionType,
      amountMinor,
      direction: validated.direction ?? null,
      transactionDate: validated.transactionDate ?? null,
      notes: validated.notes || null,
      referenceNumber: validated.referenceNumber || null,
    });

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "TRANSACTION_RECORDED",
      metadata: {
        transactionId: transaction.id,
        partyId: validated.partyId,
        type: validated.transactionType,
        amountMinor: amountMinor.toString(),
        newReceivableMinor: updatedBalance.receivableMinor.toString(),
        newPayableMinor: updatedBalance.payableMinor.toString(),
      },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return transaction;
  }

  async reverseTransaction(
    transactionId: string,
    businessId: string,
    actor: Actor,
    input?: ReverseTransactionInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    requirePermission(actor, PERMISSION.TRANSACTION_REVERSE);

    const validated = input ? reverseTransactionSchema.parse(input) : undefined;

    const reversal = await transactionRepository.reverseTransaction(
      transactionId,
      businessId,
      actor.userId,
      validated?.reason
    );

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "TRANSACTION_REVERSED",
      metadata: {
        reversedTransactionId: transactionId,
        reversalTransactionId: reversal.id,
        partyId: reversal.partyId,
        reason: validated?.reason,
      },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return reversal;
  }

  /**
   * Rebuilds a party's snapshot from its ledger. The repair path for a balance
   * suspected of having drifted from the entries that produced it.
   */
  async recomputePartyBalance(
    partyId: string,
    businessId: string,
    actor: Actor,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    requirePermission(actor, PERMISSION.TRANSACTION_REVERSE);

    const balance = await transactionRepository.recomputeBalanceForParty(partyId, businessId);

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "BALANCE_RECOMPUTED",
      metadata: {
        partyId,
        receivableMinor: balance.receivableMinor.toString(),
        payableMinor: balance.payableMinor.toString(),
      },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return balance;
  }
}

export const transactionService = new TransactionService();
