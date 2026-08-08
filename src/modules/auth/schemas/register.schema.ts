import { z } from "zod";

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Full name must be at least 3 characters")
    .max(100),
  //   businessName: z.string().trim().min(2, "Business name is required").max(100),
  email: z.email("Invalid email address").trim().toLowerCase(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers and underscores",
    ),
  password: z
    .string()
    .trim()
    .min(8, "Password must be at least 8 characters")
    .max(100),
});

export type RegisterInput = z.infer<typeof registerSchema>;
