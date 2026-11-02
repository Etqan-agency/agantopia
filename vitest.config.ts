import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), ".env") });

export default defineConfig({
  test: {
    include: [
      "packages/**/src/**/*.test.ts",
      "packages/**/test/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
      "apps/worker/src/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**"],
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
    fileParallelism: false,
  },
});
