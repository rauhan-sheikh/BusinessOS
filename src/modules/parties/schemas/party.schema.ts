import { z } from "zod";
import { amountSchema, balanceDirectionEnum } from "@/modules/transactions/schemas/transaction.schema";

export const createPartySchema = z.object({
  name: z.string().min(1, "Party name is required").max(120),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  gstin: z.string().max(15).optional().or(z.literal("")),
  pan: z.string().max(10).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  // Optional opening balance, in MAJOR units. The previous field was named
  // "...Minor" but was passed through toMinorUnits(), i.e. treated as major
  // units - and accepted negatives and garbage without complaint.
  openingBalanceAmount: amountSchema.optional(),
  openingBalanceType: balanceDirectionEnum.optional(),
});

export const updatePartySchema = z.object({
  name: z.string().min(1, "Party name is required").max(120).optional(),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  gstin: z.string().max(15).optional().or(z.literal("")),
  pan: z.string().max(10).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  isArchived: z.boolean().optional(),
});

export type CreatePartyInput = z.input<typeof createPartySchema>;
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
