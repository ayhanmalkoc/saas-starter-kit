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

## 2) Edge Runtime compatibility: `micromatch` dependency in middleware

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

## 3) ESLint Next plugin alignment

- **Priority:** P2
- **Status:** In Progress
- **Last Updated:** 2026-02-08
- **Owner:** Frontend Platform
- **Target Sprint:** 2026-S08
- **Observation:** Build showed the warning: "Next.js plugin was not detected in your ESLint configuration" when running `next lint` against the flat config.
- **Risk:** Incomplete enforcement of Next.js-specific quality rules and drift between local lint (`eslint`) and framework lint (`next lint`) behavior.
- **Action Items:**
  1. Keep a single lint entrypoint in scripts (`check-lint`) aligned to Next.js guidance (`eslint .`) instead of explicit `next lint`.
  2. Ensure flat config explicitly loads `@next/eslint-plugin-next` (plugin + `settings.next.rootDir`) while continuing to consume `next/core-web-vitals` via `FlatCompat`.
  3. Keep any newly introduced Next.js-specific rules in warning mode first; only promote to errors after CI noise remains stable for one sprint.
  4. Track CLI output drift with a comparison matrix and open follow-up tasks for any rule coverage mismatch.
- **Comparison Matrix (2026-02-08):**

  | Command | Next.js plugin detected | Rule findings | Warning/Error count | Runtime |
  | --- | --- | --- | --- | --- |
  | `npm run check-lint` (`eslint .`) | N/A (no framework detector) | No findings | 0 warnings / 0 errors | 10.46s |
  | `npx next lint` (with flat config + explicit plugin registration) | **No** (detector warning still emitted) | No findings | 1 framework warning + 0 lint findings | 9.81s |

- **Follow-up Backlog Tasks (from matrix):**
  1. Investigate why `next lint` still reports plugin detection warning despite `@next/next` plugin + rules appearing in `eslint --print-config`.
  2. Record any delta in warning/error count between `eslint .` and `next lint` while phasing out deprecated `next lint` in CI.
  3. Gate CI changes behind warning-budget monitoring to avoid unexpected lint volume growth.
- **Validation:**
  - `npm run check-lint` (`eslint .`) passes.
  - `npx next lint` no longer prints "Next.js plugin was not detected".
  - CI lint job shows no unexpected warning/error count increase versus baseline.
- **Closure Criteria:**
  - "Next.js plugin detected" warning is absent.
  - CI lint output does not show an unexpected increase in warnings/errors.
- **Rollback:**
  - Revert ESLint flat config/plugin wiring changes and keep `eslint .` as entrypoint while Next.js-specific rule rollout remains in warning mode.
- **Dependencies:**
  - ESLint configuration files (`eslint.config.*` or `.eslintrc*`)
  - `eslint-config-next`
  - `@next/eslint-plugin-next`

## 4) `baseline-browser-mapping` currency

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
