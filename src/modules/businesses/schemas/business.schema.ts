import { z } from "zod";

export const createBusinessSchema = z.object({
  name: z.string().min(1, "Business name is required").max(100),
  legalName: z.string().max(150).optional(),
  phone: z.string().max(20).optional(),
  email: z.email("Invalid email address").optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  gstin: z.string().max(15).optional(),
  pan: z.string().max(10).optional(),
  currency: z.string().length(3).default("INR"),
  timezone: z.string().default("Asia/Kolkata"),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
