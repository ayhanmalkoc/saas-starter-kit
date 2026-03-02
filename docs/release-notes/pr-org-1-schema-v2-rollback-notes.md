# PR-ORG-1 Schema V2 Rollback Notes

## Scope

This note accompanies migration:

- `prisma/migrations/20260301123000_org_native_v2_schema_v2_remove_team_core/migration.sql`

It removes Team-centric schema (`Team`, `TeamMember`, and Team-linked foreign keys/columns) and rewires data to org/project-native ownership.

## Before Deploy

1. Take a full database backup/snapshot.
2. Confirm migration prechecks on a staging clone.
3. Save row-count snapshots for:
   - `Team`, `TeamMember`
   - `Organization`, `Project`
   - `OrganizationMember`, `ProjectMember`
   - `ApiKey`, `Invitation`, `Subscription`, `Invoice`

## Validation Queries (Post-Migration)

```sql
SELECT COUNT(*) AS team_tables_left
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('Team', 'TeamMember');

SELECT COUNT(*) AS api_key_missing_project
FROM "ApiKey"
WHERE "projectId" IS NULL;

SELECT COUNT(*) AS invitation_missing_scope
FROM "Invitation"
WHERE "organizationId" IS NULL OR "projectId" IS NULL;

SELECT COUNT(*) AS subscription_missing_org
FROM "Subscription"
WHERE "organizationId" IS NULL;

SELECT COUNT(*) AS invoice_missing_org
FROM "Invoice"
WHERE "organizationId" IS NULL;
```

Expected result for all counts: `0`.

## Rollback Strategy

This change is destructive and should be treated as roll-forward by default.

1. Roll back the application artifact first.
2. Restore the database from the pre-deploy snapshot.
3. If snapshot restore is not possible, execute a reviewed reverse migration in a maintenance window.

## Reverse Migration Requirements (If Needed)

A manual reverse migration must:

1. Recreate `Team` and `TeamMember` tables and indexes/constraints.
2. Re-add Team foreign keys/columns:
   - `ApiKey.teamId`
   - `Invitation.teamId`
   - `Subscription.teamId`
   - `Invoice.teamId`
   - `Project.legacyTeamId` (if required by old code)
3. Rehydrate Team ownership from org/project mapping tables with deterministic mapping rules.
4. Recreate Team-based unique constraints and indexes.

Do not run reverse SQL without a backup and explicit approval.
