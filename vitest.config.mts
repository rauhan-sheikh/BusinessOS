import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite resolves the "@/*" alias from tsconfig.json natively.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/modules/**", "src/shared/**"],
      exclude: ["src/generated/**", "**/*.test.ts"],
    },
  },
});
