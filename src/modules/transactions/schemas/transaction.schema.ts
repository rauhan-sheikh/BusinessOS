import { z } from "zod";
import { toMinorUnits } from "@/shared/utils/currency";

/**
 * Transaction types a client may post directly.
 *
 * REVERSAL is deliberately excluded: it carries guards (the entry must exist,
 * must not itself be a reversal, and must not already be reversed) that only
 * the reversal endpoint applies. Accepting it here previously let any member
 * move a party's balance arbitrarily under a REVERSAL label.
 */
export const transactionTypeEnum = z.enum([
  "SALE",
  "PURCHASE",
  "PAYMENT_RECEIVED",
  "PAYMENT_MADE",
  "OPENING_BALANCE",
  "ADJUSTMENT",
]);

export const balanceDirectionEnum = z.enum(["RECEIVABLE", "PAYABLE"]);

/** Types that do not imply a side, so the caller must choose one. */
const DIRECTIONAL_TYPES = ["OPENING_BALANCE", "ADJUSTMENT"] as const;

/** A positive decimal in major units, with at most two decimal places. */
const AMOUNT_PATTERN = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;

/**
 * Accepts a number or a string and normalises it to a validated decimal string.
 *
 * The previous schema length-checked the string branch only, so "-500" and
 * "abc" both reached the ledger - the first inverting a balance, the second
 * recording a silent zero.
 */
export const amountSchema = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === "number" ? String(value) : value.trim()))
  .refine((value) => AMOUNT_PATTERN.test(value), {
    message: "Amount must be a positive number with at most 2 decimal places",
  })
  .refine((value) => toMinorUnits(value) > 0n, {
    message: "Amount must be greater than 0",
  });

export const createTransactionSchema = z
  .object({
    partyId: z.string().uuid("Invalid party ID"),
    transactionType: transactionTypeEnum,
    amount: amountSchema,
    direction: balanceDirectionEnum.optional(),
    /** Business date of the entry. Defaults to now; may be back-dated. */
    transactionDate: z.coerce.date().optional(),
    notes: z.string().max(500).optional().or(z.literal("")),
    referenceNumber: z.string().max(100).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const needsDirection = (DIRECTIONAL_TYPES as readonly string[]).includes(
      value.transactionType
    );

    if (needsDirection && !value.direction) {
      ctx.addIssue({
        code: "custom",
        path: ["direction"],
        message: `A ${value.transactionType} entry requires a direction of RECEIVABLE or PAYABLE.`,
      });
    }
  });

export const reverseTransactionSchema = z.object({
  reason: z.string().max(500).optional().or(z.literal("")),
});

/** Query-string filters for the ledger list. Validated, not cast. */
export const listTransactionsQuerySchema = z.object({
  partyId: z.string().uuid("Invalid party ID").optional(),
  type: z.enum([...transactionTypeEnum.options, "REVERSAL"]).optional(),
  search: z.string().max(200).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(25),
});

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type ReverseTransactionInput = z.infer<typeof reverseTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
