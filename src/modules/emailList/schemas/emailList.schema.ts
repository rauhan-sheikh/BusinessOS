import { z } from "zod";

export const emailListSchema = z.object({
  email: z.email("Invalid email address").trim().toLowerCase(),
});

export type EmailListInput = z.infer<typeof emailListSchema>;
