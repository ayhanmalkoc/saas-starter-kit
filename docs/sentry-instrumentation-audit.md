# Sentry Instrumentation Audit

_Last updated: 2026-02-08_

## 1) Init point inventory

- `instrumentation.ts`
  - `register()` initializes Sentry for `nodejs` and `edge` runtimes using shared options.
  - `onRequestError` is wired to `Sentry.captureRequestError` so request-level errors are captured through one standardized hook.
- `instrumentation-client.ts`
  - Initializes client-side Sentry using the same shared option builder.
  - Includes a global guard (`__SENTRY_CLIENT_INIT_DONE__`) to avoid duplicate client init.
- `sentry.client.config.ts`
  - Temporary deprecation shim only (no init call).
  - Emits a non-production warning and sets removal target to `2026-03-31`.
- `sentry.server.config.*`
  - No server config file found in repository at audit time.

## 2) `withSentryConfig` verification (`next.config.js`)

- `withSentryConfig(nextConfig, sentryWebpackPluginOptions)` remains enabled.
- Current plugin options:
  - `silent: true`
  - `hideSourceMaps: true`
- Runtime initialization (instrumentation files) is separate from build-time webpack plugin behavior, so no direct config collision is introduced by this migration.

## 3) Smoke validation scenarios and expected event fields

### A. Client render error

- Trigger: throw from a client component render path.
- Expected in Sentry event:
  - `environment` is populated and matches deploy target.
  - `release` is populated and matches deployment release version.
  - `exception.values[0].stacktrace.frames` exists.
  - tags/context indicate browser runtime.

### B. API route error

- Trigger: throw in `/api/*` handler.
- Expected in Sentry event:
  - `environment` populated.
  - `release` populated.
  - stacktrace contains API route handler frames.
  - request metadata includes method/path.

### C. Middleware / Edge error

- Trigger: throw in middleware or edge runtime code path.
- Expected in Sentry event:
  - `environment` populated.
  - `release` populated.
  - stacktrace exists and includes middleware/edge frame context.
  - runtime indicates edge execution.

## 4) Backlog follow-up

- Deprecation shim removal target: **2026-03-31**.
- Success criteria tracked in `docs/technical-debt-backlog.md`:
  - deprecation warning removal,
  - event delivery-rate SLO,
  - rollback readiness.
