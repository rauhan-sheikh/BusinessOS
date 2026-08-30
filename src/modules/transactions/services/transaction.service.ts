import { transactionRepository, type TransactionFilterOptions } from "../repositories/transaction.repository";
import {
  createTransactionSchema,
  reverseTransactionSchema,
  type CreateTransactionInput,
  type ReverseTransactionInput,
} from "../schemas/transaction.schema";
import { auditService } from "@/modules/audit/services/audit.service";
import { toMinorUnits } from "@/shared/utils/currency";

export class TransactionService {
  async listTransactions(businessId: string, options?: TransactionFilterOptions) {
    return transactionRepository.findMany(businessId, options);
  }

  async getTransactionById(id: string, businessId: string) {
    return transactionRepository.findById(id, businessId);
  }

  async recordTransaction(
    businessId: string,
    userId: string,
    input: CreateTransactionInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const validated = createTransactionSchema.parse(input);
    const amountMinor = toMinorUnits(validated.amount);

    const { transaction, updatedBalance } = await transactionRepository.createWithBalanceUpdate({
      businessId,
      partyId: validated.partyId,
      createdById: userId,
      transactionType: validated.transactionType,
      amountMinor,
      openingBalanceType: validated.adjustmentType ?? null,
      notes: validated.notes || null,
      referenceNumber: validated.referenceNumber || null,
    });

    await auditService.log({
      businessId,
      userId,
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
    userId: string,
    input?: ReverseTransactionInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const validated = input ? reverseTransactionSchema.parse(input) : undefined;

    const reversal = await transactionRepository.reverseTransaction(
      transactionId,
      businessId,
      userId,
      validated?.reason
    );

    await auditService.log({
      businessId,
      userId,
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
}

export const transactionService = new TransactionService();
