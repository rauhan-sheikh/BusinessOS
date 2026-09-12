/**
 * Validated server environment.
 *
 * Every variable was previously read inline with `!` or `as string`, so a
 * missing RESEND_API_KEY or BETTER_AUTH_URL surfaced as an undefined deep
 * inside a request - a silently unsent email, or a verification link pointing
 * at localhost in production. Parsing once at import turns that into a startup
 * failure naming the variable.
 *
 * Import only from server code. Values here must never reach the client.
 */
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /**
   * Better Auth reads the secret itself and accepts either name, so this only
   * asserts that one of them is present and long enough to be a real secret.
   */
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  AUTH_SECRET: z.string().min(32).optional(),

  /** Absolute origin. Verification and invitation links are built from it. */
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be an absolute URL"),

  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  EMAIL_FROM: z.string().min(1, "EMAIL_FROM is required"),

  // Optional: Google sign-in is simply unavailable when these are absent.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function loadServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid server environment. Check your .env against .env.example:\n${details}`
    );
  }

  if (!parsed.data.BETTER_AUTH_SECRET && !parsed.data.AUTH_SECRET) {
    throw new Error(
      "Invalid server environment: set BETTER_AUTH_SECRET (or AUTH_SECRET) to a random string of at least 32 characters."
    );
  }

  return parsed.data;
}

export const env = loadServerEnv();

export const isProduction = env.NODE_ENV === "production";

/** Whether Google sign-in can be offered at all. */
export const hasGoogleOAuth = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
