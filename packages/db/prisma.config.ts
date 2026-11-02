import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Load the repo-root .env when running from packages/db
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
