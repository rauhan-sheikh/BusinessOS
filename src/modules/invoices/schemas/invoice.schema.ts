import { z } from "zod";

/**
 * Request shapes for invoicing.
 *
 * Decimal strings arrive from the client and become integers here, so nothing
 * downstream ever handles a fractional amount. Parsing by pattern rather than
 * with parseFloat means "1e3" and "abc" are rejected rather than coerced.
 */

/** Quantity: up to three decimal places, stored in thousandths. */
const quantitySchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? String(v) : v.trim()))
  .refine((v) => /^\d+(\.\d{1,3})?$/.test(v), {
    message: "Quantity must be positive, with at most 3 decimal places",
  })
  .transform((v) => {
    const [whole, fraction = ""] = v.split(".");
    return BigInt(`${whole}${fraction.padEnd(3, "0")}`);
  })
  .refine((v) => v > 0n, { message: "Quantity must be greater than 0" });

/** Money: up to two decimal places, stored in minor units. */
const amountSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? String(v) : v.trim()))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), {
    message: "Amount must be a positive number with at most 2 decimal places",
  })
  .transform((v) => {
    const [whole, fraction = ""] = v.split(".");
    return BigInt(`${whole}${fraction.padEnd(2, "0")}`);
  });

export const invoiceLineSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  quantityMilli: quantitySchema,
  unitPriceMinor: amountSchema,
  discountMinor: amountSchema.optional(),
  /** Basis points, so 18% is 1800 and no rate is fractional. */
  taxRateBps: z.coerce.number().int().min(0).max(10_000).default(0),
  hsnSacCode: z.string().max(20).optional().or(z.literal("")),
  unitOfMeasure: z.string().max(20).optional().or(z.literal("")),
  itemId: z.string().uuid().optional(),
});

export const createInvoiceSchema = z.object({
  partyId: z.string().uuid("Select a counterparty"),
  kind: z.enum(["SALES", "PURCHASE"]).default("SALES"),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  placeOfSupply: z.string().max(2).optional().or(z.literal("")),
  isExempt: z.coerce.boolean().optional(),
  roundTotalToUnit: z.coerce.boolean().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  terms: z.string().max(2000).optional().or(z.literal("")),
  lines: z.array(invoiceLineSchema).min(1, "An invoice needs at least one line"),
});

export const allocationSchema = z.object({
  invoiceId: z.string().uuid(),
  amountMinor: amountSchema,
});

export const recordPaymentSchema = z.object({
  partyId: z.string().uuid("Select a counterparty"),
  kind: z.enum(["SALES", "PURCHASE"]).default("SALES"),
  amountMinor: amountSchema.refine((v) => v > 0n, {
    message: "Amount must be greater than 0",
  }),
  paymentDate: z.coerce.date(),
  method: z.string().max(50).optional().or(z.literal("")),
  reference: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  /**
   * Omitted means allocate automatically, oldest first. An empty array holds
   * the whole payment on account - the two are deliberately different.
   */
  allocations: z.array(allocationSchema).optional(),
});

export const reallocateSchema = z.object({
  allocations: z.array(allocationSchema),
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().max(500).optional().or(z.literal("")),
});

export const listInvoicesQuerySchema = z.object({
  kind: z.enum(["SALES", "PURCHASE"]).optional(),
  status: z.enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED"]).optional(),
  partyId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const agingQuerySchema = z.object({
  kind: z.enum(["SALES", "PURCHASE"]).default("SALES"),
  asAt: z.coerce.date().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
