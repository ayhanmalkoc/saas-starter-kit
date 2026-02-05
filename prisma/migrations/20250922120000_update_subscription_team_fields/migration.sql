-- Add new subscription fields and prepare for backfill
ALTER TABLE "Subscription"
  ADD COLUMN "teamId" TEXT,
  ADD COLUMN "status" TEXT,
  ADD COLUMN "quantity" INTEGER,
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "trialEnd" TIMESTAMP(3),
  ADD COLUMN "productId" TEXT;

-- Backfill teamId using Team.billingId (introduced in 20240212105842_stripe)
UPDATE "Subscription" AS s
SET "teamId" = t."id"
FROM "Team" AS t
WHERE t."billingId" = s."customerId";

-- Backfill status using legacy active/cancel fields
UPDATE "Subscription"
SET "status" = CASE
  WHEN "active" = true THEN 'active'
  WHEN "cancelAt" IS NOT NULL THEN 'canceled'
  ELSE 'canceled'
END
WHERE "status" IS NULL;

-- Backfill period fields from legacy start/end dates
UPDATE "Subscription"
SET "currentPeriodStart" = "startDate",
    "currentPeriodEnd" = "endDate"
WHERE "currentPeriodStart" IS NULL
  AND "currentPeriodEnd" IS NULL;

-- Make priceId nullable for Stripe price IDs
ALTER TABLE "Subscription"
  ALTER COLUMN "priceId" DROP NOT NULL;

-- Enforce non-null teamId and status
ALTER TABLE "Subscription"
  ALTER COLUMN "teamId" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL;

-- Drop legacy columns
ALTER TABLE "Subscription"
  DROP COLUMN "active",
  DROP COLUMN "startDate",
  DROP COLUMN "endDate";

-- Add indexes for new lookup patterns
CREATE INDEX IF NOT EXISTS "Subscription_customerId_idx" ON "Subscription"("customerId");
CREATE INDEX IF NOT EXISTS "Subscription_teamId_idx" ON "Subscription"("teamId");
CREATE INDEX IF NOT EXISTS "Subscription_priceId_idx" ON "Subscription"("priceId");

-- Add foreign key for team linkage
ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
