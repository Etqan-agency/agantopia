-- Idempotent: a first attempt of this migration partially applied (enum types created, TaskStatus value added,
-- search indexes dropped by Prisma drift detection). Every statement below is safe to re-run.

-- CreateEnum
DO $$ BEGIN CREATE TYPE "ProviderAuthMode" AS ENUM ('SUBSCRIPTION_CLI', 'API_KEY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProviderLimitKind" AS ENUM ('OK', 'RATE_LIMITED', 'USAGE_LIMIT', 'AUTH_EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_PROVIDER_LIMIT';

-- AlterTable
ALTER TABLE "ExecutionSession" ADD COLUMN IF NOT EXISTS "errorKind" TEXT;
ALTER TABLE "ProviderConnection" ADD COLUMN IF NOT EXISTS "authMode" "ProviderAuthMode" NOT NULL DEFAULT 'SUBSCRIPTION_CLI';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "limitRetries" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProviderLimitState" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "ProviderKind" NOT NULL,
    "kind" "ProviderLimitKind" NOT NULL DEFAULT 'OK',
    "message" TEXT,
    "retryAfterAt" TIMESTAMP(3),
    "resetAt" TIMESTAMP(3),
    "source" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderLimitState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProviderLimitState_companyId_provider_key" ON "ProviderLimitState"("companyId", "provider");
DO $$ BEGIN
  ALTER TABLE "ProviderLimitState" ADD CONSTRAINT "ProviderLimitState_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: connections that already hold an API key stay API_KEY (explicit, separately billed);
-- key-less LOCAL_RUNNER / SIMULATED connections become SUBSCRIPTION_CLI.
UPDATE "ProviderConnection" SET "authMode" = 'API_KEY' WHERE "encryptedSecret" IS NOT NULL OR "mode" = 'API';

-- Knowledge search column: convert the GENERATED column into a trigger-maintained column so Prisma's
-- drift detection no longer tries to drop its expression, and restore the two indexes.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'KnowledgeEntry' AND column_name = 'searchVector' AND is_generated = 'ALWAYS') THEN
    ALTER TABLE "KnowledgeEntry" ALTER COLUMN "searchVector" DROP EXPRESSION;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION knowledge_entry_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english', coalesce(NEW."title", '') || ' ' || coalesce(NEW."content", ''));
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS knowledge_entry_search_vector_trg ON "KnowledgeEntry";
CREATE TRIGGER knowledge_entry_search_vector_trg BEFORE INSERT OR UPDATE OF "title", "content" ON "KnowledgeEntry"
  FOR EACH ROW EXECUTE FUNCTION knowledge_entry_search_vector_update();
UPDATE "KnowledgeEntry" SET "searchVector" = to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", '')) WHERE "searchVector" IS NULL;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "KnowledgeEntry_searchVector_idx" ON "KnowledgeEntry" USING GIN ("searchVector");
CREATE INDEX IF NOT EXISTS "KnowledgeEntry_title_trgm_idx" ON "KnowledgeEntry" USING GIN ("title" gin_trgm_ops);
