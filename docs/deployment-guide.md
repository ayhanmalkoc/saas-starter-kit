# Deployment Guide

For environment-specific command sequences (local dev reset, staging, production), see:

- `docs/environment-commands-playbook.md`

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

## Environment variables

The app validates environment variables at startup using Zod. If any required variable is missing/invalid, startup fails immediately with a clear error message.

| Variable                                                            | Required | Notes                                                          |
| ------------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| `DATABASE_URL`                                                      | Yes      | Prisma database connection string.                             |
| `APP_URL`                                                           | Yes      | Public app URL (must be a valid URL).                          |
| `NEXTAUTH_SECRET`                                                   | Yes      | Secret used by NextAuth to sign/encrypt tokens.                |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Optional | Needed for email provider flows.                               |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`                          | Optional | Needed when GitHub auth is enabled.                            |
| `JACKSON_WEBHOOK_SECRET`                                            | Optional | Required when DSync webhook signature verification is enabled. |
| `STRIPE_SYNC_SECRET`                                                | Optional | Required for `/api/admin/stripe/sync` header validation.       |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                          | Optional | Needed when Google auth is enabled.                            |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                        | Optional | Needed when billing/team payments are enabled.                 |
| `JACKSON_*` and `SVIX_*` variables                                  | Optional | Needed only for SSO/Directory Sync/webhook integrations.       |

## Suggested CI/CD order

1. Install dependencies
2. Run `npx prisma migrate deploy`
3. Run build (`npm run build-ci`)
4. Run smoke/E2E tests
5. Promote/deploy artifact

For operational procedures when migrations fail or a rollback is required, see [Migration Operations Runbook](./migration-operations-runbook.md).
