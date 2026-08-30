import { z } from "zod";

export const createPartySchema = z.object({
  name: z.string().min(1, "Party name is required").max(120),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  gstin: z.string().max(15).optional().or(z.literal("")),
  pan: z.string().max(10).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  // Optional opening balance
  openingBalanceMinor: z.union([z.number(), z.string(), z.bigint()]).optional(),
  openingBalanceType: z.enum(["RECEIVABLE", "PAYABLE"]).optional(),
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

export type CreatePartyInput = z.infer<typeof createPartySchema>;
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
