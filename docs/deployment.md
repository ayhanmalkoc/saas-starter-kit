# Deployment Guide

## Production database migrations

Before starting the application build in CI/CD, apply pending Prisma migrations:

```bash
npx prisma migrate deploy
```

After migrations complete successfully, continue with the build:

```bash
npm run build-ci
```

> **Important:** Do **not** use `prisma db push` in production. `db push` is for local prototyping/development and bypasses migration history.

## Suggested CI/CD order

1. Install dependencies
2. Run `npx prisma migrate deploy`
3. Run build (`npm run build-ci`)
4. Run smoke/E2E tests
5. Promote/deploy artifact

For operational procedures when migrations fail or a rollback is required, see [Migration Operations Runbook](./operations-migration-runbook.md).
