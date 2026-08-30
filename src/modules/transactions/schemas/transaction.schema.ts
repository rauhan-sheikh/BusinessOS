import { z } from "zod";

export const transactionTypeEnum = z.enum([
  "SALE",
  "PURCHASE",
  "PAYMENT_RECEIEVED",
  "PAYMENT_MADE",
  "ADJUSTMENT",
  "REVERSAL",
]);

export const createTransactionSchema = z.object({
  partyId: z.string().uuid("Invalid party ID"),
  transactionType: transactionTypeEnum,
  amount: z.union([z.number().positive("Amount must be greater than 0"), z.string().min(1, "Amount is required")]),
  adjustmentType: z.enum(["RECEIVABLE", "PAYABLE"]).optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
  referenceNumber: z.string().max(100).optional().or(z.literal("")),
});

export const reverseTransactionSchema = z.object({
  reason: z.string().max(500).optional().or(z.literal("")),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type ReverseTransactionInput = z.infer<typeof reverseTransactionSchema>;
