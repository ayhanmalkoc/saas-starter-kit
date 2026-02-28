# OpenAI-Style Org/Project Migration Roadmap

This document tracks the migration from legacy `Team`-scoped SaaS billing to:

- `Organization` (billing + governance scope)
- `Project` (runtime/API scope)

The target model mirrors OpenAI Platform structure:

- Organization: billing, limits, usage governance, people
- Project: API keys, webhooks, evaluations, project-level limits/people

## PR Series

## PR-1: Additive Foundation

Scope:

- Add schema primitives: `Organization`, `OrganizationMember`, `Project`, `ProjectMember`.
- Add compatibility columns: `Team.organizationId`, `Team.projectId`, `Subscription.organizationId`, `Subscription.projectId`, `Invoice.organizationId`.
- Add bootstrap service layer:
  - `models/organization.ts` (`ensureOrganizationAndProjectForTeam`)
  - `models/project.ts`
  - `lib/billing/scope.ts`
- Update billing flows to use compatibility scope (`team + organization`):
  - entitlements resolution
  - checkout/update/products routes
  - Stripe webhook upserts
  - Stripe subscription backfill script
- Add data bootstrap command:
  - `npm run org:bootstrap`
  - included in `npm run setup:stripe`

Behavior guarantee:

- Existing `/teams/*` routes keep working.
- Legacy installations can migrate incrementally without hard cutover.

## PR-2: Org/Project Native APIs + UI Routing

Scope:

- Introduce `/orgs/:orgSlug/projects/:projectSlug/*` routes.
- Add route compatibility adapters/redirects from legacy team URLs.
- Move API-key/webhook/entitlement checks to project/org context explicitly.
- Keep dual-read during transition.

Current implementation status:

- Added UI compatibility route:
  - `pages/orgs/[orgSlug]/projects/[projectSlug]/[[...path]].tsx`
- Added API compatibility route:
  - `pages/api/orgs/[orgSlug]/projects/[projectSlug]/[[...path]].ts`
- Added shared resolver:
  - `lib/routing/org-project-compat.ts`
- Added workspace route URL builders:
  - `lib/routing/workspace-routes.ts`
- Updated hooks and team-facing UI to build workspace-aware app/API URLs:
  - Team tabs/navigation/dropdown
  - Team members/invitations/webhooks/API keys/billing portal calls
  - Team SSO and Directory Sync settings pages
  - Pricing/billing product fetches and plan-change actions
- Teams listing now includes project/organization slug context for canonical links.
- Replaced org/project UI compatibility redirect with native page dispatch:
  - `pages/orgs/[orgSlug]/projects/[projectSlug]/[[...path]].tsx` now delegates to team page modules
  - Existing team page `getServerSideProps` are reused with injected legacy `slug` during transition
  - `/orgs/:orgSlug/projects/:projectSlug` now resolves to team settings page by default

## PR-3: Billing Scope Cutover

Scope:

- Make subscription authority organization-scoped.
- Migrate remaining team-scoped reads to organization/project reads.
- Backfill/cleanup stale team-only subscription records.
- Harden guardrails for duplicate subscriptions across projects.

Status:

- Implemented and merged to `main`.

Current implementation status:

- Subscription/invoice billing scope reads are now organization-authoritative when `organizationId` exists.
- Stripe customer authority moved to `Organization.billingId` (team billing remains compatibility fallback).
- Checkout/portal provider selection now prefers organization billing provider before team fallback.
- Checkout session metadata now carries `teamId`/`organizationId`/`projectId` for stronger webhook correlation.
- Stripe webhook subscription upsert now prefers metadata-based team/org mapping before customer lookup fallback.
- Stripe invoice webhook mapping now prefers existing subscription→team correlation before customer fallback.
- Duplicate-subscription guardrails added in checkout/update flows:
  - hard-fail on multiple blocking subscriptions in Stripe or DB scope (`duplicate_subscriptions`)
  - hard-fail on non-authoritative update target (`subscription_mismatch`)
  - cross-source duplicate detection (Stripe + DB merged view)
- Entitlement resolution now picks a single authoritative active subscription in duplicate states (with warning logs).
- Added backfill command for existing records:
  - `npm run billing:backfill-org-scope`
- Updated Stripe subscription sync script to:
  - prioritize organization-scoped customers
  - map subscriptions to teams via metadata (`teamId`) when available
  - backfill legacy team-scoped rows

## PR-4: Team as Legacy Alias (optional deprecation step)

Scope:

- Keep `Team` as backward-compatible alias layer or remove if fully migrated.
- Finalize docs and remove dual-write paths.

Current implementation status:

- Team UI routes now enforce canonical app URL shape at SSR:
  - Requests on `/teams/:slug/*` are redirected to `/orgs/:orgSlug/projects/:projectSlug/*`.
  - Redirect preserves route suffix (`settings`, `members`, `billing`, etc.) and query string.
- Team API routes now enforce canonical API URL shape at handler entry:
  - Requests on `/api/teams/:slug/*` are redirected (307) to `/api/orgs/:orgSlug/projects/:projectSlug/*`.
  - Redirect preserves endpoint suffix and query string.
- Workspace URL fallback generation now uses canonical-aware helpers:
  - Added API helper `buildTeamWorkspaceApiPath` in `lib/routing/workspace-routes.ts`.
  - Team UI/API clients now prefer helper-based fallback over hardcoded `/teams` or `/api/teams` path strings.
- Legacy alias behavior is now environment-controlled:
  - `LEGACY_TEAM_ROUTE_MODE=enabled` keeps legacy team-slug routes active.
  - `LEGACY_TEAM_ROUTE_MODE=redirect` (default) redirects legacy team-slug routes to canonical org/project routes.
  - `LEGACY_TEAM_ROUTE_MODE=disabled` blocks legacy team-slug routes (`404/410`) for hard cutover.
- Production guardrail for deprecation mode:
  - Production boot fails if `LEGACY_TEAM_ROUTE_MODE=enabled` unless explicit emergency override `ALLOW_LEGACY_TEAM_ROUTE_ENABLED_IN_PRODUCTION=true` is set.
- Added shared redirect helper:
  - `lib/routing/legacy-team-redirect.ts`
- Added shared API redirect helper:
  - `lib/routing/legacy-team-api-redirect.ts`
- Added canonical route resolution from team slug:
  - `models/team.ts` (`getTeamCanonicalRouteBySlug`)

## Completion Snapshot (as of February 28, 2026)

- PR-1: Complete
- PR-2: Complete
- PR-3: Complete
- PR-4: Complete as compatibility/deprecation-control layer

Open items are operational, not architectural:

- Monitor redirect traffic on legacy `/teams/*` and `/api/teams/*` routes.
- Execute controlled hard-cutover by switching production route mode from `redirect` to `disabled` after release sign-off.

## Production Route-Mode Decision

Current production policy:

- Default production mode is `LEGACY_TEAM_ROUTE_MODE=redirect`.
- `LEGACY_TEAM_ROUTE_MODE=enabled` is prohibited in production except emergency rollback with
  `ALLOW_LEGACY_TEAM_ROUTE_ENABLED_IN_PRODUCTION=true`.
- `LEGACY_TEAM_ROUTE_MODE=disabled` is a planned hard-cutover mode and should be enabled only in a controlled release window.

## Operational Commands

Local migration bootstrap:

```bash
npm run org:bootstrap
```

Local billing reset/sync with new scope bootstrap:

```bash
npm run setup:stripe
```
