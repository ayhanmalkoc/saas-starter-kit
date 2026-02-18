# Environment Commands Playbook

This runbook standardizes command order by environment so setup/reset/sync steps are repeatable.

Use this as the single source of truth for:

- fresh clone bootstrap
- local dev reset
- staging test flow
- production test/deploy flow

## Prerequisites

Before any flow:

1. Ensure `.env` exists and contains valid values (do not keep dummy Stripe keys for real sync).
2. Ensure Docker is running for local (`setup:db`) workflows.
3. Ensure Stripe CLI is installed if you test webhooks locally.

## Command Reference

| Command                             | Purpose                                                                                                                                             | Requires running app (`npm run dev` / `npm run start`) |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `npm run setup:db`                  | Reset local Docker stack + apply Prisma schema + initialize Svix/Retraced DBs                                                                       | No                                                     |
| `npm run org:bootstrap`             | Backfill OpenAI-style Organization/Project scope from existing Team records                                                                         | No                                                     |
| `npm run stripe:cleanup`            | Archive all active Stripe products/prices (destructive in selected Stripe account)                                                                  | No                                                     |
| `npm run setup:stripe`              | Validate plan model, bootstrap org/project scope, seed Stripe products/prices, sync catalog to DB, and backfill subscriptions from Stripe customers | No                                                     |
| `npm run stripe:sync-db`            | Sync Stripe products/prices directly into DB (no API call)                                                                                          | No                                                     |
| `npm run stripe:sync-subscriptions` | Backfill subscriptions from Stripe customers into DB (recovery path when webhook events are missed)                                                 | No                                                     |
| `npm run sync-stripe`               | Sync via `/api/admin/stripe/sync` endpoint                                                                                                          | Yes                                                    |
| `npm run dev`                       | Start local Next.js dev server on `:4002`                                                                                                           | N/A                                                    |
| `npm run build-ci && npm run start` | Start app in production mode                                                                                                                        | N/A                                                    |

## 1) Fresh Clone (Local Dev Bootstrap)

Use this when cloning the repo for the first time.

```bash
npm install
```

Create `.env`:

- macOS/Linux: `cp .env.example .env`
- PowerShell: `Copy-Item .env.example .env`

Then:

```bash
npm run setup:db
npm run setup:stripe
npm run dev
```

Optional local Stripe webhook forwarding:

```bash
stripe listen --forward-to http://localhost:4002/api/webhooks/stripe
```

Set generated `whsec_...` into `STRIPE_WEBHOOK_SECRET`, then restart app.

## 2) Dev Environment Reset (Your current workflow)

Use this when you want a clean local restart with a fresh Stripe catalog.

```bash
npm run setup:db
npm run stripe:cleanup
npm run setup:stripe
npm run dev
```

Notes:

- `stripe:cleanup` archives active catalog entries in the configured Stripe account. Use only when intentional.
- If you only need catalog sync without reseeding, use `npm run stripe:sync-db`.
- If billing still shows Free after a successful Stripe checkout, run `npm run stripe:sync-subscriptions`.
- If app is already running and you prefer API-based sync, use `npm run sync-stripe`.

## 3) Staging Environment Test Flow

Staging should use migration-driven schema updates and should not use local Docker reset scripts.

```bash
npm ci
npx prisma migrate deploy
npm run build-ci
npm run start -- --port 4002
```

Then choose one Stripe sync method:

1. Preferred when app is live/reachable:

```bash
npm run sync-stripe
```

2. Alternative with direct DB access:

```bash
npm run stripe:sync-db
npm run stripe:sync-subscriptions
```

Staging rules:

- Do not run `npm run setup:db`.
- Do not run `prisma db push`.
- Avoid `npm run stripe:cleanup` unless intentionally resetting staging Stripe test catalog.

## 4) Production Test / Deploy Flow

Production must use immutable deploy flow + Prisma migrations.

```bash
npm ci
npx prisma migrate deploy
npm run build-ci
npm run start
```

For first-time or corrective catalog sync after deploy:

```bash
npm run sync-stripe
npm run stripe:sync-subscriptions
```

Production rules:

- Never run `npm run setup:db`.
- Never run `prisma db push`.
- Never run `npm run stripe:cleanup` in production unless explicitly approved and planned.

## Validation Checklist (All Environments)

After running the selected flow:

1. Pricing page loads expected plans.
2. Team billing page shows current subscription correctly.
3. Feature-gated pages (e.g., audit logs/webhooks/SSO) match plan entitlements.
4. Stripe webhook endpoint is reachable and signature secret is valid where applicable.

## Related Documents

- Deployment specifics: `docs/deployment-guide.md`
- Production hardening and checks: `docs/production-readiness-guide.md`
- Billing architecture and troubleshooting: `docs/billing-integration-guide.md`
- Migration incident handling: `docs/migration-operations-runbook.md`
