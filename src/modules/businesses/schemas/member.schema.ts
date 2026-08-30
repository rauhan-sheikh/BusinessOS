import { z } from "zod";

export const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["OWNER", "ADMIN", "ACCOUNTANT"]).default("ACCOUNTANT"),
});

export const updateBusinessProfileSchema = z.object({
  name: z.string().min(1, "Business name is required").max(100).optional(),
  legalName: z.string().max(150).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  gstin: z.string().max(15).optional().or(z.literal("")),
  pan: z.string().max(10).optional().or(z.literal("")),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateBusinessProfileInput = z.infer<typeof updateBusinessProfileSchema>;
