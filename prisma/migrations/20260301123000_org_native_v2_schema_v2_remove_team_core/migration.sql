-- PR-ORG-1 (Schema V2): Remove Team core and enforce org/project-native ownership.
-- Rollback notes: docs/release-notes/pr-org-1-schema-v2-rollback-notes.md

ALTER TABLE "ApiKey"
  ADD COLUMN IF NOT EXISTS "projectId" TEXT;

ALTER TABLE "Invitation"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT,
  ADD COLUMN IF NOT EXISTS "projectId" TEXT;

DO $$
BEGIN
  IF to_regclass('"Team"') IS NOT NULL THEN
    -- Ensure every legacy team has an organization before rewiring child entities.
    INSERT INTO "Organization" (
      "id",
      "name",
      "slug",
      "billingId",
      "billingProvider",
      "createdAt",
      "updatedAt"
    )
    SELECT
      'org-' || t."id",
      COALESCE(NULLIF(t."name", ''), 'Organization ' || LEFT(t."id", 8)),
      'org-' || REPLACE(t."id", '-', ''),
      t."billingId",
      t."billingProvider",
      COALESCE(t."createdAt", CURRENT_TIMESTAMP),
      CURRENT_TIMESTAMP
    FROM "Team" t
    WHERE t."organizationId" IS NULL
    ON CONFLICT ("id") DO NOTHING;

    UPDATE "Team" t
    SET "organizationId" = 'org-' || t."id"
    WHERE t."organizationId" IS NULL;

    -- Ensure every legacy team has a project before rewiring child entities.
    INSERT INTO "Project" (
      "id",
      "organizationId",
      "name",
      "slug",
      "legacyTeamId",
      "createdAt",
      "updatedAt"
    )
    SELECT
      'project-' || t."id",
      t."organizationId",
      COALESCE(NULLIF(t."name", ''), 'Default Project'),
      'project-' || REPLACE(t."id", '-', ''),
      t."id",
      COALESCE(t."createdAt", CURRENT_TIMESTAMP),
      CURRENT_TIMESTAMP
    FROM "Team" t
    WHERE t."projectId" IS NULL
      AND t."organizationId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "Project" p
        WHERE p."legacyTeamId" = t."id"
      )
    ON CONFLICT ("id") DO NOTHING;

    UPDATE "Team" t
    SET "projectId" = p."id"
    FROM "Project" p
    WHERE t."projectId" IS NULL
      AND p."legacyTeamId" = t."id";

    IF EXISTS (
      SELECT 1
      FROM "Team"
      WHERE "organizationId" IS NULL OR "projectId" IS NULL
    ) THEN
      RAISE EXCEPTION 'PR-ORG-1 validation failed: unresolved Team.organizationId/projectId mappings.';
    END IF;

    -- Map TeamMember rows into OrganizationMember + ProjectMember.
    INSERT INTO "OrganizationMember" (
      "id",
      "organizationId",
      "userId",
      "role",
      "createdAt",
      "updatedAt"
    )
    SELECT
      md5('org-member:' || t."organizationId" || ':' || tm."userId"),
      t."organizationId",
      tm."userId",
      tm."role",
      tm."createdAt",
      tm."updatedAt"
    FROM "TeamMember" tm
    INNER JOIN "Team" t ON t."id" = tm."teamId"
    ON CONFLICT ("organizationId", "userId") DO UPDATE
    SET
      "role" = CASE
        WHEN "OrganizationMember"."role" = 'OWNER' THEN 'OWNER'::"Role"
        WHEN EXCLUDED."role" = 'OWNER' THEN 'OWNER'::"Role"
        WHEN "OrganizationMember"."role" = 'ADMIN' THEN 'ADMIN'::"Role"
        WHEN EXCLUDED."role" = 'ADMIN' THEN 'ADMIN'::"Role"
        ELSE 'MEMBER'::"Role"
      END,
      "updatedAt" = GREATEST("OrganizationMember"."updatedAt", EXCLUDED."updatedAt");

    INSERT INTO "ProjectMember" (
      "id",
      "projectId",
      "userId",
      "role",
      "createdAt",
      "updatedAt"
    )
    SELECT
      md5('project-member:' || t."projectId" || ':' || tm."userId"),
      t."projectId",
      tm."userId",
      tm."role",
      tm."createdAt",
      tm."updatedAt"
    FROM "TeamMember" tm
    INNER JOIN "Team" t ON t."id" = tm."teamId"
    ON CONFLICT ("projectId", "userId") DO UPDATE
    SET
      "role" = CASE
        WHEN "ProjectMember"."role" = 'OWNER' THEN 'OWNER'::"Role"
        WHEN EXCLUDED."role" = 'OWNER' THEN 'OWNER'::"Role"
        WHEN "ProjectMember"."role" = 'ADMIN' THEN 'ADMIN'::"Role"
        WHEN EXCLUDED."role" = 'ADMIN' THEN 'ADMIN'::"Role"
        ELSE 'MEMBER'::"Role"
      END,
      "updatedAt" = GREATEST("ProjectMember"."updatedAt", EXCLUDED."updatedAt");

    -- Rewire Team-linked entities to org/project columns.
    UPDATE "ApiKey" ak
    SET "projectId" = t."projectId"
    FROM "Team" t
    WHERE ak."teamId" = t."id"
      AND ak."projectId" IS NULL;

    UPDATE "Invitation" i
    SET
      "organizationId" = t."organizationId",
      "projectId" = t."projectId"
    FROM "Team" t
    WHERE i."teamId" = t."id"
      AND (i."organizationId" IS NULL OR i."projectId" IS NULL);

    UPDATE "Subscription" s
    SET
      "organizationId" = COALESCE(s."organizationId", t."organizationId"),
      "projectId" = COALESCE(s."projectId", t."projectId")
    FROM "Team" t
    WHERE s."teamId" = t."id"
      AND (s."organizationId" IS NULL OR s."projectId" IS NULL);

    UPDATE "Invoice" i
    SET "organizationId" = COALESCE(i."organizationId", t."organizationId")
    FROM "Team" t
    WHERE i."teamId" = t."id"
      AND i."organizationId" IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM "ApiKey" WHERE "projectId" IS NULL) THEN
    RAISE EXCEPTION 'PR-ORG-1 validation failed: ApiKey.projectId contains NULL values.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Invitation"
    WHERE "organizationId" IS NULL OR "projectId" IS NULL
  ) THEN
    RAISE EXCEPTION 'PR-ORG-1 validation failed: Invitation organization/project mappings are incomplete.';
  END IF;

  IF EXISTS (SELECT 1 FROM "Subscription" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'PR-ORG-1 validation failed: Subscription.organizationId contains NULL values.';
  END IF;

  IF EXISTS (SELECT 1 FROM "Invoice" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'PR-ORG-1 validation failed: Invoice.organizationId contains NULL values.';
  END IF;
END
$$;

ALTER TABLE "ApiKey" DROP CONSTRAINT IF EXISTS "ApiKey_teamId_fkey";
ALTER TABLE "ApiKey" DROP CONSTRAINT IF EXISTS "ApiKey_projectId_fkey";
DROP INDEX IF EXISTS "ApiKey_teamId_idx";
DROP INDEX IF EXISTS "ApiKey_projectId_idx";
ALTER TABLE "ApiKey" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "ApiKey"
  ADD CONSTRAINT "ApiKey_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ApiKey_projectId_idx" ON "ApiKey"("projectId");
ALTER TABLE "ApiKey" DROP COLUMN IF EXISTS "teamId";

ALTER TABLE "Invitation" DROP CONSTRAINT IF EXISTS "Invitation_teamId_fkey";
ALTER TABLE "Invitation" DROP CONSTRAINT IF EXISTS "Invitation_projectId_fkey";
ALTER TABLE "Invitation" DROP CONSTRAINT IF EXISTS "Invitation_organizationId_fkey";
DROP INDEX IF EXISTS "Invitation_teamId_email_key";
DROP INDEX IF EXISTS "Invitation_projectId_email_key";
DROP INDEX IF EXISTS "Invitation_organizationId_idx";
DROP INDEX IF EXISTS "Invitation_projectId_idx";
ALTER TABLE "Invitation" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Invitation" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_projectId_email_key"
  ON "Invitation"("projectId", "email");
CREATE INDEX IF NOT EXISTS "Invitation_organizationId_idx"
  ON "Invitation"("organizationId");
CREATE INDEX IF NOT EXISTS "Invitation_projectId_idx"
  ON "Invitation"("projectId");
ALTER TABLE "Invitation" DROP COLUMN IF EXISTS "teamId";

ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_teamId_fkey";
ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_organizationId_fkey";
ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_projectId_fkey";
DROP INDEX IF EXISTS "Subscription_teamId_idx";
ALTER TABLE "Subscription" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "teamId";

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_teamId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_organizationId_fkey";
DROP INDEX IF EXISTS "Invoice_teamId_idx";
ALTER TABLE "Invoice" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "teamId";

ALTER TABLE "Project" DROP COLUMN IF EXISTS "legacyTeamId";

DROP TABLE IF EXISTS "TeamMember";
DROP TABLE IF EXISTS "Team";
