# Migration Operations Runbook

This runbook explains what to do when a database migration fails in CI/CD or when a rollback is needed in production.

## 1) Detection and initial triage

- Confirm failure source from CI logs (`npx prisma migrate deploy`).
- Identify failed migration name from output (e.g. `20260206120000_add_invoice`).
- Check migration status:

```bash
npx prisma migrate status
```

- Verify DB connectivity and credentials.

## 2) Immediate containment

- Pause further deploys to the same environment.
- Communicate incident status in your team channel.
- If app health is impacted, route traffic to previous healthy release (platform-specific rollback) while DB investigation continues.

## 3) Failure classification

Common classes:

1. **Connectivity/permission issue**
   - DB unavailable, wrong `DATABASE_URL`, missing privileges.
2. **Data constraint conflict**
   - Existing rows violate new constraint/index.
3. **SQL/runtime error in migration**
   - Invalid SQL, lock timeout, incompatible operation.

## 4) Recovery procedure

### A. Connectivity/permission issue

1. Fix connectivity / network / secret configuration.
2. Re-run:

```bash
npx prisma migrate deploy
```

### B. Data conflict issue

1. Prepare a corrective SQL/data patch (back up affected rows first).
2. Apply correction during maintenance window if needed.
3. Re-run migration deploy.

### C. Broken migration script

1. Stop rollout.
2. Create a new forward migration that safely amends the issue.
3. Validate on staging with production-like data snapshot.
4. Deploy again with `npx prisma migrate deploy`.

> Prefer **roll-forward** over destructive rollback for schema changes.

## 5) Rollback guidance

Because database schema rollback may be lossy, use this order:

1. **Application rollback first:** revert app artifact/container image to previous stable version.
2. Keep DB at last successful migration state when possible.
3. If a DB rollback is unavoidable:
   - take full backup/snapshot first,
   - execute reviewed reverse SQL script,
   - run verification queries,
   - document data-loss risk and approval.

## 6) Verification checklist

After remediation:

- `npx prisma migrate status` shows no pending failed state.
- Critical endpoints pass smoke tests.
- Error rate/latency normal in monitoring.
- CI/CD pipeline is unblocked.

## 7) Post-incident actions

- Add regression test for the migration scenario.
- Record root cause and timeline in incident log.
- Update migration/release checklist if a gap was found.
