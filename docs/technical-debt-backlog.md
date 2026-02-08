# Technical Debt Backlog

This document tracks warnings observed during build that do not block release, and captures them as actionable technical debt.

## Standard item template

Use the following fields for every backlog entry:

- **Priority:** (P0/P1/P2/P3)
- **Status:** (`Open` | `In Progress` | `Blocked` | `Done`)
- **Last Updated:** (YYYY-MM-DD)
- **Owner:** (team or person)
- **Target Sprint:** (e.g. 2026-S04)
- **Risk:** (impact if not resolved)
- **Action Items:** (numbered implementation tasks)
- **Validation:** (commands/logs/evidence to confirm completion)
- **Rollback:** (how to safely revert/disable)
- **Dependencies:** (related packages/teams/configs)

## 1) Sentry modern instrumentation migration

- **Priority:** P1
- **Status:** Open
- **Last Updated:** 2026-02-08
- **Owner:** Platform / Observability
- **Target Sprint:** 2026-S07
- **Observation:** Build output shows a deprecation warning for `sentry.client.config.ts` and recommends using the `onRequestError` hook.
- **Risk:** Potential observability gaps or incomplete error capture in future Next.js / Sentry versions.
- **Action Items:**
  1. Move the contents of `sentry.client.config.ts` to `instrumentation-client.ts`.
  2. Add Sentry capture integration for `onRequestError`.
  3. Validate event delivery with client + server error smoke tests.
- **Validation:**
  - `npm run build` log no longer contains Sentry deprecation warning for `sentry.client.config.ts`.
  - Trigger a controlled 500 and confirm corresponding event in Sentry project issue stream.
- **Rollback:**
  - Revert instrumentation changes and restore previous `sentry.client.config.ts` setup; temporarily disable new `onRequestError` hook wiring if error volume/regression is detected.
- **Dependencies:**
  - `@sentry/nextjs`
  - Next.js instrumentation hooks
- **Related Files:**
  - `sentry.client.config.ts`
  - `next.config.js`

## 2) Edge Runtime uyumluluğu: middleware içinde `micromatch` bağımlılığı

- **Priority:** P1
- **Status:** In Progress
- **Last Updated:** 2026-02-08
- **Owner:** Platform / Web Runtime
- **Target Sprint:** 2026-S07
- **Observation:** Build output includes Edge Runtime warnings about Node API usage (`process.platform`, `process.version`) inside `micromatch/picomatch`.
- **Risk:** Compatibility issues if Edge runtime constraints become stricter.
- **Action Items:**
  1. Replace middleware route matching based on `micromatch` with an Edge-safe pattern (native matcher / `startsWith` / controlled regex).
  2. Update middleware unit tests and run regression tests.
- **Validation:**
  - `npm run build` log no longer reports Edge Runtime Node API warnings originating from `micromatch/picomatch`.
  - `npm test -- middleware` (or project-equivalent middleware tests) passes.
- **Rollback:**
  - Revert middleware matcher changes to previous behavior and pin known-good middleware rules if auth/routing regressions occur.
- **Dependencies:**
  - `middleware.ts`
  - Routing/auth middleware test coverage
- **Related Files:**
  - `middleware.ts`
  - `package.json`

## 3) ESLint Next plugin uyumlandırması

- **Priority:** P2
- **Status:** Open
- **Last Updated:** 2026-02-08
- **Owner:** Frontend Platform
- **Target Sprint:** 2026-S08
- **Observation:** Build shows the warning: "Next.js plugin was not detected in your ESLint configuration".
- **Risk:** Incomplete enforcement of Next.js-specific quality rules.
- **Action Items:**
  1. Verify that the recommended Next.js plugin/preset is enabled in ESLint configuration.
  2. Analyze output differences between `eslint` and `next lint`.
- **Validation:**
  - `npm run lint` completes without the Next.js plugin detection warning.
  - `npx next lint` and `npx eslint .` show aligned rule coverage for Next.js files.
- **Rollback:**
  - Revert ESLint config changes to last stable config if lint noise blocks CI, then reintroduce incrementally.
- **Dependencies:**
  - ESLint configuration files (`eslint.config.*` or `.eslintrc*`)
  - `eslint-config-next`

## 4) `baseline-browser-mapping` güncelliği

- **Priority:** P3
- **Status:** Open
- **Last Updated:** 2026-02-08
- **Owner:** DevEx
- **Target Sprint:** 2026-S09
- **Observation:** Build shows a warning that the dataset currency is outdated.
- **Risk:** Stale browser baseline decisions.
- **Action Items:**
  1. Update the `baseline-browser-mapping` package.
  2. Include it in a periodic update policy via Dependabot/Renovate.
- **Validation:**
  - `npm outdated baseline-browser-mapping` shows installed version is up to date after upgrade.
  - `npm run build` no longer emits dataset currency warning.
- **Rollback:**
  - Restore previous lockfile/package version if update introduces browser target regressions.
- **Dependencies:**
  - `baseline-browser-mapping`
  - Dependabot/Renovate configuration

---

## Tracking note

- These items are not release blockers.
- However, they should be handled in the next sprint to improve production maturity.

## Triage cadence

- Backlog is reviewed weekly in technical debt triage.
- Open/In Progress/Blocked items are synced into sprint planning with explicit owner and target sprint updates.
- Items moved to `Done` must include validation evidence (command output or monitoring log reference) before closure.
