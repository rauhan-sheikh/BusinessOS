import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Migration datasource, with a guard against migrating production by accident.
 *
 * MIGRATION_DATABASE_URL takes precedence over DATABASE_URL so CI can point
 * migrations at the direct, non-pooled connection. The hazard is that the same
 * variable in a local .env silently redirects every `prisma migrate` command on
 * a developer machine at production - including `migrate dev`, which creates
 * and drops a shadow database, and `migrate reset`, which drops everything.
 *
 * A remote target is therefore refused outside CI unless explicitly allowed for
 * the single command that needs it:
 *
 *   ALLOW_REMOTE_MIGRATIONS=true npm run db:deploy
 */
function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".localhost")
  );
}

function resolveMigrationUrl(): string | undefined {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) return undefined;

  // CI is the intended place for this, and sets CI=true.
  if (process.env.CI === "true") return url;
  if (process.env.ALLOW_REMOTE_MIGRATIONS === "true") return url;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    // Not parseable as a URL; let Prisma report it rather than guessing.
    return url;
  }

  if (isLocalHost(hostname)) return url;

  throw new Error(
    [
      `Refusing to run migrations against a remote database (${hostname}).`,
      "",
      "MIGRATION_DATABASE_URL takes precedence over DATABASE_URL, so a remote",
      "value in your local .env points every prisma migrate command at it -",
      "including ones that create or drop databases.",
      "",
      "If this is deliberate, run the single command with:",
      "  ALLOW_REMOTE_MIGRATIONS=true <command>",
      "",
      "Otherwise remove MIGRATION_DATABASE_URL from .env; it belongs in CI",
      "secrets, where the workflow sets it for the migrate job alone.",
    ].join("\n")
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveMigrationUrl(),
  },
});
