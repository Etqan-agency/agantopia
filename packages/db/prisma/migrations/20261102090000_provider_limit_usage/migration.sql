-- Additive: last provider-reported usage window (never invented).
ALTER TABLE "ProviderLimitState" ADD COLUMN IF NOT EXISTS "utilization" DOUBLE PRECISION;
ALTER TABLE "ProviderLimitState" ADD COLUMN IF NOT EXISTS "windowLabel" TEXT;
