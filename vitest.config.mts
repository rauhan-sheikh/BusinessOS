import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Integration tests talk to the database named by DATABASE_URL; they skip
// themselves when it is absent, so unit runs need no local Postgres.
config();

export default defineConfig({
  // Vite resolves the "@/*" alias from tsconfig.json natively.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests share one database; running their files in parallel
    // would let one suite's cleanup delete another's fixtures.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/modules/**", "src/shared/**"],
      exclude: ["src/generated/**", "**/*.test.ts"],
    },
  },
});
