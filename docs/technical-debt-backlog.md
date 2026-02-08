# Technical Debt Backlog

This document tracks warnings observed during build that do not block release, and captures them as actionable technical debt.

## 1) Sentry modern instrumentation migration

- **Priority:** P1
- **Status:** Open
- **Observation:** Build output shows a deprecation warning for `sentry.client.config.ts` and recommends using the `onRequestError` hook.
- **Risk:** Potential observability gaps or incomplete error capture in future Next.js / Sentry versions.
- **Action items:**
  1. Move the contents of `sentry.client.config.ts` to `instrumentation-client.ts`.
  2. Add Sentry capture integration for `onRequestError`.
  3. Validate event delivery with client + server error smoke tests.
- **Related files:**
  - `sentry.client.config.ts`
  - `next.config.js`

## 2) Edge Runtime uyumluluğu: middleware içinde `micromatch` bağımlılığı

- **Priority:** P1/P2
- **Status:** Open
- **Observation:** Build output includes Edge Runtime warnings about Node API usage (`process.platform`, `process.version`) inside `micromatch/picomatch`.
- **Risk:** Compatibility issues if Edge runtime constraints become stricter.
- **Action items:**
  1. Replace middleware route matching based on `micromatch` with an Edge-safe pattern (native matcher / `startsWith` / controlled regex).
  2. Update middleware unit tests and run regression tests.
- **Related files:**
  - `middleware.ts`
  - `package.json`

## 3) ESLint Next plugin uyumlandırması

- **Priority:** P2
- **Status:** Open
- **Observation:** Build shows the warning: "Next.js plugin was not detected in your ESLint configuration".
- **Risk:** Incomplete enforcement of Next.js-specific quality rules.
- **Action items:**
  1. Verify that the recommended Next.js plugin/preset is enabled in ESLint configuration.
  2. Analyze output differences between `eslint` and `next lint`.

## 4) `baseline-browser-mapping` güncelliği

- **Priority:** P3
- **Status:** Open
- **Observation:** Build shows a warning that the dataset currency is outdated.
- **Risk:** Stale browser baseline decisions.
- **Action items:**
  1. Update the `baseline-browser-mapping` package.
  2. Include it in a periodic update policy via Dependabot/Renovate.

---

## Tracking note

- These items are not release blockers.
- However, they should be handled in the next sprint to improve production maturity.
