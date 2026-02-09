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
- **Status:** Completed
- **Last Updated:** 2026-02-09
- **Owner:** Platform / Observability
- **Target Sprint:** 2026-S07
- **Observation:** Build output shows a deprecation warning for `sentry.client.config.ts` and recommends using the `onRequestError` hook.
- **Risk:** Potential observability gaps or incomplete error capture in future Next.js / Sentry versions.
- **Action Items:**
  1. Inventory existing init points across `instrumentation.ts`, `sentry.client.config.ts`, and any `sentry.server.config.*` files.
  2. Move the client init flow to `instrumentation-client.ts` and keep a short-lived deprecation shim in `sentry.client.config.ts` (removal target: 2026-03-31).
  3. Add Sentry capture integration for `onRequestError` and standardize request-error capture in one hook.
  4. Validate `withSentryConfig` options (`silent`, source map behavior) and ensure no overlap with runtime init paths.
  5. Validate event delivery with client, API route, and middleware/edge smoke tests.
- **Validation:**
  - `npm run build` log no longer contains Sentry deprecation warning for `sentry.client.config.ts`.
  - Trigger a controlled 500 and confirm corresponding event in Sentry project issue stream.
- **Done Criteria:**
  - `npm run build` no longer contains Sentry deprecation warning for `sentry.client.config.ts`.
  - Deprecation shim warning is no longer observed after `sentry.client.config.ts` removal in the follow-up PR.
  - Event delivery success rate stays at or above 99% for the first 24h after rollout.
  - Rollback steps are documented and can be executed in a single revert.
- **Rollback:**
  - Revert instrumentation changes and restore previous `sentry.client.config.ts` setup; temporarily disable new `onRequestError` hook wiring if error volume/regression is detected.
- **Dependencies:**
  - `@sentry/nextjs`
  - Next.js instrumentation hooks
- **Related Files:**
  - `instrumentation.ts`
  - `instrumentation-client.ts`
  - `sentry.client.config.ts`
  - `sentry.shared.config.ts`
  - `next.config.js`

## 2) Edge Runtime compatibility: `micromatch` dependency in middleware

- **Priority:** P1
- **Status:** Completed
- **Last Updated:** 2026-02-09
- **Owner:** Platform / Web Runtime
- **Target Sprint:** 2026-S07
- **Observation:** Middleware route matching was migrated away from direct `micromatch` usage and root dependency declarations were removed; lockfile now only retains transitive `micromatch` entries required by third-party tooling.
- **Risk:** Compatibility issues if Edge runtime constraints become stricter.
- **Action Items:**
  1. ✅ Replace middleware route matching based on `micromatch` with an Edge-safe pattern (native matcher / `startsWith` / controlled regex).
  2. ✅ Update middleware unit tests and run regression tests.
  3. ✅ Add a risk guardrail: preserve auth-protected route behavior (no bypass regression) while confirming Edge Runtime build warning removal.
- **Validation:**
  - `npm run build-ci` compiles successfully and does not emit Edge Runtime Node API warnings from `micromatch/picomatch` before failing at runtime env validation (`DATABASE_URL`, `APP_URL`, `NEXTAUTH_SECRET` missing in CI-like local shell).
  - `npm test -- --runInBand` passes, including middleware-focused suites (`__tests__/middleware.route-match.spec.ts`, `__tests__/middleware.security-headers.spec.ts`).
- **Rollback:**
  - Revert middleware matcher changes to previous behavior and pin known-good middleware rules if auth/routing regressions occur.
- **Dependencies:**
  - `middleware.ts`
  - Routing/auth middleware test coverage
  - `package.json` / `package-lock.json` dependency cleanup (`micromatch`, `@types/micromatch` removed from root declarations)
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

  | Command                                                           | Next.js plugin detected                 | Rule findings | Warning/Error count                   | Runtime |
  | ----------------------------------------------------------------- | --------------------------------------- | ------------- | ------------------------------------- | ------- |
  | `npm run check-lint` (`eslint .`)                                 | N/A (no framework detector)             | No findings   | 0 warnings / 0 errors                 | 10.46s  |
  | `npx next lint` (with flat config + explicit plugin registration) | **No** (detector warning still emitted) | No findings   | 1 framework warning + 0 lint findings | 9.81s   |

- **Follow-up Backlog Tasks (from matrix):**
  1. Investigate why `next lint` still reports plugin detection warning despite `@next/next` plugin + rules appearing in `eslint --print-config`.
  2. Record any delta in warning/error count between `eslint .` and `next lint` while phasing out `next lint` in favor of `eslint .` in CI.
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
- **Status:** In Progress
- **Last Updated:** 2026-02-08
- **Owner:** DevEx
- **Target Sprint:** 2026-S09
- **Observation:** Build shows a warning that the dataset currency is outdated.
- **Risk:** Stale browser baseline decisions.
- **Action Items:**
  1. `baseline-browser-mapping` is **transitive** (chain: `autoprefixer` → `browserslist` → `baseline-browser-mapping`), so update the parent package chain rather than pinning it directly.
  2. Include the direct parent package (`autoprefixer`) in a dedicated Dependabot group for periodic updates; transitive browser baseline packages will follow via lockfile updates.
  3. Gate release with a checklist item confirming build output is clean from the `outdated dataset currency` warning.
- **Validation:**
  - `npm ls baseline-browser-mapping --all` confirms the package is transitive under `autoprefixer`/`browserslist`.
  - `npm outdated baseline-browser-mapping browserslist autoprefixer` shows no pending updates after upgrade.
  - `npm run build` no longer emits dataset currency warning.
- **Rollback:**
  - Restore previous lockfile/package version if update introduces browser target regressions.
- **Operational SLA:** Browser baseline package chain updates must be merged within **30 days** of upstream release.
- **Dependencies:**
  - `autoprefixer`
  - `browserslist`
  - `baseline-browser-mapping`
  - Dependabot configuration (`.github/dependabot.yml`)
  - Release checklist (`docs/release-checklist.md`)

---

## Tracking note

- These items are not release blockers.
- However, they should be handled in the next sprint to improve production maturity.

## Triage cadence

- Backlog is reviewed weekly in technical debt triage.
- Open/In Progress/Blocked items are synced into sprint planning with explicit owner and target sprint updates.
- Items moved to `Done` must include validation evidence (command output or monitoring log reference) before closure.
