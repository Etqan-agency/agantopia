import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

export * from "../generated/prisma/client";
export { Prisma } from "../generated/prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __agentopiaPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString, max: 10 });
  return new PrismaClient({ adapter });
}

/** Singleton Prisma client (survives Next.js dev HMR). */
export const prisma: PrismaClient = globalThis.__agentopiaPrisma ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__agentopiaPrisma = prisma;
}

export type Db = PrismaClient;
