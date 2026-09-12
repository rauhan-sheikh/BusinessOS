import { z } from "zod";

export const saveEmailTemplateSchema = z.object({
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject must be 200 characters or fewer"),
  // Stored verbatim and escaped at render time, so no sanitisation is applied
  // here. The cap is a guard against unbounded rows, not a security control.
  html: z
    .string()
    .min(1, "Email body is required")
    .max(50_000, "Email body must be 50,000 characters or fewer"),
});

export type SaveEmailTemplateInput = z.infer<typeof saveEmailTemplateSchema>;
