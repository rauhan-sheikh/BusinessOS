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

/**
 * Whether the command being run can change a database.
 *
 * This config is loaded by every Prisma CLI command, `generate` included, and
 * `generate` is the first half of `npm run build`. Throwing for every command
 * therefore broke production builds, where DATABASE_URL is legitimately remote
 * and nothing migrates: the build ran `prisma generate`, the guard fired, and
 * the deploy failed with a message about migrations it was never going to run.
 *
 * Only `migrate` and `db` reach the database destructively, so only those are
 * guarded. Reading argv is crude, but the alternative - refusing to resolve a
 * url the safe commands need - is what caused the problem.
 */
function isSchemaWritingCommand(): boolean {
  return process.argv.some((arg) => arg === "migrate" || arg === "db");
}

function resolveMigrationUrl(): string | undefined {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) return undefined;

  if (!isSchemaWritingCommand()) return url;

  // CI is the intended place for this. GitHub Actions sets CI=true; other
  // runners set other truthy values, so anything non-empty counts.
  if (process.env.CI) return url;
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
