# Production Readiness Guide

This guide defines minimum production readiness requirements and the final checks before go-live.

For environment-specific command order (fresh clone, dev reset, staging, production), use:

- `docs/environment-commands-playbook.md`

## 1) Required Configuration

Set and verify these before production release:

- `APP_URL` and `NEXTAUTH_URL` set to the production domain (HTTPS).
- `DATABASE_URL` points to production DB with SSL and appropriate connection settings.
- `NEXTAUTH_SECRET` is strong and unique.
- OAuth provider secrets (GitHub/Google) are configured with production callback URLs.
- Stripe production keys are set:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_SYNC_SECRET`
- Security flags are production-safe:
  - `ENABLE_HSTS=true`
  - `ENABLE_CSP_STRICT=true`
  - `ENABLE_COEP=true` (only if your external assets are compatible)
  - `NEXTAUTH_TRUST_HOST=false`
  - `NEXTAUTH_DEBUG=false`

## 2) Build and Migration Gate

Run in CI/CD:

```bash
npm ci
npx prisma migrate deploy
npm run build-ci
```

Rules:

- Do not use `prisma db push` in production.
- If migration fails, follow `docs/migration-operations-runbook.md`.

## 3) Production Smoke Checks

After deployment, verify:

1. Login/register and team creation flows.
2. Billing page loads and expected plans are visible.
3. Stripe webhook endpoint receives and verifies events.
4. Key feature gates (SSO, webhooks, audit logs, API keys) behave per plan entitlements.
5. Error monitoring (Sentry) receives expected runtime events.

## 4) Security and Operations Checklist

1. Secrets are managed in platform secret manager (not committed in repo).
2. TLS is enforced and certificates are valid.
3. DB backup policy is active and recovery has been tested.
4. Logs/monitoring/alerts are enabled.
5. Release rollback strategy is confirmed and documented.

## 5) Post-Deploy Stripe Sync

If Stripe product/price records are missing in app DB after deploy:

```bash
npm run sync-stripe
```

This command requires a running application and valid `APP_URL`.

## Related Documents

- Deployment process: `docs/deployment-guide.md`
- Billing architecture and sync behavior: `docs/billing-integration-guide.md`
- Migration incident handling: `docs/migration-operations-runbook.md`
- Release verification checklist: `docs/release-checklist.md`
