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
- Legacy alias behavior was initially mode-controlled, then fixed to canonical redirect in PR-5A.
- Added shared redirect helper:
  - `lib/routing/legacy-team-redirect.ts`
- Added shared API redirect helper:
  - `lib/routing/legacy-team-api-redirect.ts`
- Added canonical route resolution from team slug:
  - `models/team.ts` (`getTeamCanonicalRouteBySlug`)
- Note: PR-4 compatibility behavior is superseded by PR-5B hard cutover for team-slug routes.

## PR-5: Hard Cutover (Physical Removal of Legacy Team Alias)

Status:

- In progress.

Decision context:

- Repository is currently greenfield (no active external installations).
- We can prefer clean architecture over backward-compatibility layer.

Primary goal:

- Remove legacy alias code paths so product is strictly org/project-native.

Out of scope for PR-5:

- Full database-level removal of `Team` domain entities.
- Large semantic rename of all internal `team` variables/models.
- This phase targets alias code removal, not full domain-model rewrite.

### PR-5A: Cutover Baseline and Config Hardening

Scope:

- Remove `LEGACY_TEAM_ROUTE_MODE` operational toggles and emergency override behavior.
- Make canonical org/project routing the only supported mode.
- Remove docs that instruct `enabled/redirect/disabled` runtime switching.

Tasks:

- Remove env/config keys:
  - `LEGACY_TEAM_ROUTE_MODE`
  - `ALLOW_LEGACY_TEAM_ROUTE_ENABLED_IN_PRODUCTION`
- Remove route-mode guards/branching from `lib/env.ts` and related helpers.
- Update docs:
  - `README.md`
  - `docs/environment-commands-playbook.md`
  - `docs/production-readiness-guide.md`
  - `docs/release-checklist.md`

Acceptance criteria:

- No runtime config path exists for legacy team-route modes.
- Canonical org/project routes are documented as the only entrypoint.

Status update:

- Completed on `feat/org-project-architecture-phase1`.
- `LEGACY_TEAM_ROUTE_MODE` and `ALLOW_LEGACY_TEAM_ROUTE_ENABLED_IN_PRODUCTION` removed from runtime config.
- Legacy team alias behavior is now fixed compatibility redirect (non-configurable).

### PR-5B: UI/API Alias Route Removal

Scope:

- Remove legacy `pages/teams/*` and `pages/api/teams/*` alias surface.
- Remove legacy redirect helpers used only for team alias compatibility.
- Keep canonical routes:
  - `pages/orgs/[orgSlug]/projects/[projectSlug]/*`
  - `pages/api/orgs/[orgSlug]/projects/[projectSlug]/*`

Tasks:

- Delete legacy helper modules:
  - `lib/routing/legacy-team-redirect.ts`
  - `lib/routing/legacy-team-api-redirect.ts`
- Remove team-route redirect calls from remaining pages/APIs.
- Delete/retire legacy route trees:
  - `pages/teams/[slug]/*`
  - `pages/api/teams/[slug]/*`
- Ensure all client-side URL builders use canonical workspace helpers only.

Acceptance criteria:

- Repository has no import/use of legacy team redirect helpers.
- Build output contains no `/teams/[slug]/*` and `/api/teams/[slug]/*` route entries.
- All navigation and mutations work through canonical org/project URLs.

Status update:

- Completed on `feat/org-project-architecture-phase1`.
- Removed route trees:
  - `pages/teams/[slug]/*`
  - `pages/api/teams/[slug]/*`
- Removed compatibility helper modules:
  - `lib/routing/legacy-team-redirect.ts`
  - `lib/routing/legacy-team-api-redirect.ts`
- Canonical routes continue through:
  - `pages/orgs/[orgSlug]/projects/[projectSlug]/[[...path]].tsx`
  - `pages/api/orgs/[orgSlug]/projects/[projectSlug]/[[...path]].ts`

### PR-5C: Service/Hook Canonicalization and Naming Cleanup

Scope:

- Remove compatibility-only logic that translates team slug to org/project path.
- Keep internal business model stable while making API and route contracts canonical.

Tasks:

- Refactor hooks/services to use org/project route params directly.
- Remove fallback URL builders that generate `/teams` or `/api/teams`.
- Update UI components still coupled to team-slug route construction.
- Keep data access compatibility where needed, but eliminate route-level aliasing.

Acceptance criteria:

- No frontend mutation/query uses team alias endpoints.
- No SSR/API handler needs team-route compatibility redirect logic.

Status update:

- Completed on `feat/org-project-architecture-phase1`.
- Removed remaining `/api/teams/:slug/*` fallback behavior from route builders and plan-change service.
- Added null-safe canonical URL guards across team/invitation/billing/webhook UI actions.
- Enriched team/invitation payload usage to carry org/project slug context where route context is absent (e.g., invitation accept, post-create redirect).

### PR-5D: Validation, Test Matrix, and Release Gate

Scope:

- Validate that hard cutover is complete and safe to ship as breaking change.

Tasks:

- Mandatory checks:
  - `npm run check-types`
  - `npm run check-lint`
  - `npm run build-ci`
- Smoke matrix:
  - Auth/login
  - Org/project workspace navigation
  - Billing checkout + webhook
  - Team members/invitations flows via canonical org/project URLs
- Regression checks:
  - Ensure no accidental references to `/teams/` or `/api/teams/` remain.

Acceptance criteria:

- All checks pass.
- Canonical flow works end-to-end without alias routes.
- Breaking-change release note prepared.

Status update:

- Automated gate checks are passing:
  - `npm run check-lint`
  - `npm run check-types`
  - `npm run build-ci`
- Manual smoke coverage added with canonical Playwright scenario:
  - `tests/e2e/smoke/org-project-cutover.spec.ts`
  - command: `npx playwright test tests/e2e/smoke/org-project-cutover.spec.ts -x`
- Breaking-change release note prepared:
  - `docs/release-notes/org-project-hard-cutover.md`

### Release and Versioning Plan for PR-5

- Release as a breaking change (recommended major version bump).
- Add migration note:
  - Legacy team-slug URLs are removed.
  - Consumers must use org/project canonical routes.
- Update starter onboarding to org/project-first examples only.

### Rollback Plan

- If issues are found before merge: revert PR-5 branch.
- If issues are found after merge:
  - Fast rollback by reverting PR-5 commit set.
  - No runtime `LEGACY_TEAM_ROUTE_MODE` fallback is expected after hard cutover.
  - Keep rollback playbook documented in release notes.

## Completion Snapshot (as of March 1, 2026)

- PR-1: Complete
- PR-2: Complete
- PR-3: Complete
- PR-4: Complete as compatibility/deprecation-control layer
- PR-5A: Complete (config hardening)
- PR-5B: Complete (physical removal of team-slug alias routes)
- PR-5C: Complete (service/hook canonicalization)
- PR-5D: Complete (validation, smoke matrix, release gate)

Open items:

- None in PR-1 through PR-5 scope.

## Legacy Route Policy (Post PR-5A)

Current production policy:

- Legacy team-slug routes are removed:
  - `/teams/:slug/*`
  - `/api/teams/:slug/*`
- Runtime mode switching via environment variables is removed.
- Canonical org/project routes are the only supported workspace route contract.

## Operational Commands

Local migration bootstrap:

```bash
npm run org:bootstrap
```

Local billing reset/sync with new scope bootstrap:

```bash
npm run setup:stripe
```

### ORG-NATIVE V2 Progress Snapshot (as of March 2, 2026)

- PR-ORG-1: Complete
- PR-ORG-2: Complete
- PR-ORG-3: Complete
- PR-ORG-4: Complete
- PR-ORG-5: Complete
- PR-ORG-6: Complete
- PR-ORG-7: Complete
- PR-ORG-8: Complete
- PR-ORG-9: Complete

## ORG-NATIVE V2 Hard Cutover Plan (Team-Free Internal Model)

Goal:

- Complete the migration to a fully org/project-native architecture.
- Remove all remaining Team-based internal coupling and compatibility debt.
- Keep only canonical org/project contracts in schema, services, routes, UI, tests, scripts, and docs.

Scope policy:

- This is a major breaking-change track.
- No Team alias compatibility layer will remain after completion.
- No runtime fallback mode will be kept.

### Target End State

- Route contract:
  - App: `/orgs/:orgSlug/*`, `/orgs/:orgSlug/projects/:projectSlug/*`
  - API: `/api/orgs/:orgSlug/*`, `/api/orgs/:orgSlug/projects/:projectSlug/*`
- Domain model:
  - Organization is authority for billing/governance.
  - Project is authority for runtime/API scope.
  - Team and TeamMember entities are removed from runtime model.
- Billing model:
  - Subscription and Invoice are organization-authoritative only.
  - Stripe customer authority is organization-only.

### PR-ORG-1: Schema V2 (Remove Team Core)

Scope:

- Remove `Team` and `TeamMember` models from Prisma schema.
- Replace Team-linked foreign keys:
  - `ApiKey.teamId` -> `projectId`
  - `Invitation.teamId` -> `projectId` (and add org scope field if needed)
  - `Subscription.teamId` removed; `organizationId` required
  - `Invoice.teamId` removed; `organizationId` required
- Remove `Project.legacyTeamId`.
- Add/update required unique and composite indexes for org/project constraints.

Data migration tasks:

- Map existing Team rows to Organization + default Project.
- Map TeamMember rows to OrganizationMember + ProjectMember.
- Rewire ApiKey/Invitation/Subscription/Invoice references.
- Execute destructive cleanup for Team-based columns/tables only after successful backfill validation.

Acceptance criteria:

- `prisma/schema.prisma` contains no `Team` or `TeamMember` model.
- DB has no foreign key dependency to Team tables.
- Migration script is idempotent where applicable and has rollback notes.

Status update:

- Completed on `org` branch (March 1, 2026).
- `Team`/`TeamMember` runtime schema removed and replaced with org/project-native membership model.
- Schema migration + backfill artifacts added for destructive Team-core removal and rollback notes.

### PR-ORG-2: Domain and Service Layer Rewrite

Scope:

- Delete Team-centric model services:
  - `models/team.ts`
  - `models/teamMember.ts`
- Replace access guards:
  - `throwIfNoTeamAccess` -> `throwIfNoOrganizationAccess` / `throwIfNoProjectAccess`
- Refactor model/service methods to org/project identifiers only:
  - invitations
  - members
  - api keys
  - subscriptions
  - invoices
  - permissions

Acceptance criteria:

- Runtime code path has no dependency on Team slug/id for authorization.
- No production service import from removed Team model files.

Status update:

- Completed on `org` branch (March 1, 2026).
- Team-centric services removed from runtime path and access guards switched to organization/project access checks.
- Core API/service layer reads/writes now resolve by org/project identifiers.

### PR-ORG-3: Billing Core Org-Only Cutover

Scope:

- Remove Team-derived billing scope logic:
  - retire/replace `lib/billing/scope.ts` Team resolver
- Entitlements become organization-authoritative:
  - `getOrganizationEntitlements`
  - `requireOrganizationEntitlement`
- Stripe provider and webhook mapping:
  - customer authority by organization only
  - subscription/invoice mapping by org/project metadata + org customer
- Checkout/portal/update flows use org/project context directly (no team fallback).

Acceptance criteria:

- Billing code has zero runtime dependency on Team ids/slugs.
- Duplicate-subscription guardrails continue to pass in org scope.

Status update:

- Completed on `org` branch (March 1, 2026).
- Entitlements API cut over to organization-authoritative contract:
  - `getOrganizationEntitlements`
  - `requireOrganizationEntitlement`
  - `hasOrganizationEntitlement`
- Checkout/products/subscription update flows now use org/project context directly without Team fallback.

### PR-ORG-4: Native API Surface (No Team Adapters)

Scope:

- Remove compatibility adapter behavior in canonical org/project API route.
- Implement direct native handlers for:
  - Organization: general, people, billing, limits, usage, security, data-control
  - Project: api-keys, webhooks, people, limits, evaluations
- Remove legacy route entrypoints still present:
  - `pages/api/teams/index.ts`

Acceptance criteria:

- `/api/teams/*` no longer exists in build output.
- Org/project API handlers do not mutate query with team slug compatibility.

Status update:

- Completed on `org` branch (March 1, 2026).
- Removed org/project API compatibility adapter route:
  - deleted `pages/api/orgs/[orgSlug]/projects/[projectSlug]/[[...path]].ts`
- Added direct native API route files under:
  - `pages/api/orgs/[orgSlug]/projects/[projectSlug]/*`
  - `pages/api/orgs/index.ts`
- Removed legacy team API entrypoint:
  - deleted `pages/api/teams/index.ts`
- Build output now contains canonical `/api/orgs/...` endpoints and no `/api/teams/*` entries.

### PR-ORG-5: Native UI Surface and Navigation

Scope:

- Replace org/project compatibility page dispatch with native pages.
- Remove remaining Team shell pages:
  - `pages/teams/index.tsx`
  - `pages/teams/switch.tsx`
- Update dashboard redirection to org/project-only targets.
- Split UI modules by domain:
  - `organization/*`
  - `project/*`
  - remove `components/team/*` usage from runtime flows

Acceptance criteria:

- UI has no hardcoded `/teams/*` route generation.
- Navigation, SSR, and client mutations are org/project-native.

Status update:

- Completed on `org` branch (March 1, 2026).
- Replaced org/project compatibility page dispatch with direct native page routes:
  - removed `pages/orgs/[orgSlug]/projects/[projectSlug]/[[...path]].tsx`
  - added explicit pages for `settings`, `members`, `sso`, `directory-sync`, `audit-logs`, `billing`, `webhooks`, `api-keys`, `products`, and base index.
- Removed remaining Team shell pages:
  - deleted `pages/teams/index.tsx`
  - deleted `pages/teams/switch.tsx`
- Added canonical organization list page:
  - `pages/orgs/index.tsx`
- Updated dashboard + UI navigation to org/project-only targets (`/orgs`, `/orgs/:orgSlug/projects/:projectSlug/*`) and removed runtime `/teams`/`/api/teams` route generation.

### PR-ORG-6: Hooks, Routing, and Module Canonicalization

Scope:

- Replace/remove Team-oriented hooks:
  - `useTeam*` family -> `useOrganization*` / `useProject*`
- Remove compatibility routing helpers:
  - `lib/routing/org-project-compat.ts`
- Simplify `lib/routing/workspace-routes.ts` to canonical-only builders.
- Rename/refactor modules where needed to remove Team semantic leakage.

Acceptance criteria:

- Runtime hook and routing layers do not expose Team context abstractions.
- No fallback URL builder emits `/teams` or `/api/teams`.

Status update:

- Completed on `org` branch (March 1, 2026).
- Replaced Team-oriented runtime hooks with project-native variants:
  - removed `hooks/useTeam.ts`
  - removed `hooks/useTeams.ts`
  - removed `hooks/useTeamMembers.ts`
  - added `hooks/useProject.ts`
  - added `hooks/useProjects.ts`
  - added `hooks/useProjectMembers.ts`
- Removed compatibility routing helper:
  - deleted `lib/routing/org-project-compat.ts`
- Simplified workspace route builders to canonical org/project context only in:
  - `lib/routing/workspace-routes.ts`
- Canonicalized shell module naming to remove Team abstraction leakage in navigation/dropdown runtime components:
  - `components/shared/shell/WorkspaceNavigation.tsx`
  - `components/shared/WorkspaceDropdown.tsx`
- Validation checks:
  - `rg` runtime scan returns no matches for `useTeam*`, `/teams`/`/api/teams`, and `org-project-compat`.
  - CI gates green: `check-format`, `check-lint`, `check-types`, `test`, `build-ci`.

### PR-ORG-7: Integration Layer Alignment

Scope:

- Align SSO/DSync tenancy contract to org/project model.
- Align audit/webhook/API-key ownership to project and governance to organization.
- Update NextAuth onboarding:
  - new account bootstraps Organization and default Project (without Team entity).

Acceptance criteria:

- External integration metadata no longer depends on Team identifiers.
- Join/invitation/auth flows complete without Team references.

Status update:

- Completed on `org` branch (March 1, 2026).
- Audit integration contract is now project-native:
  - `lib/retraced.ts` request shape switched from `team` to `project`.
  - project lifecycle audit actions use `project.update` / `project.delete`.
  - workspace API audit emitters now pass `project: projectMember.project`.
- Auth and SSO verification flows are org/project-native:
  - signup payload now uses `organizationName` in `pages/api/auth/join.ts` and `components/auth/Join.tsx`.
  - SSO verify contract now uses `projectSlug` and `useProjectSlug` in:
    - `pages/api/auth/sso/verify.ts`
    - `pages/auth/sso/index.tsx`
- Invitation flow wording and email contract were canonicalized:
  - migrated invite email sender/template to project-native modules:
    - `lib/email/sendProjectInviteEmail.ts`
    - `components/emailTemplates/ProjectInvite.tsx`
  - invitation UI and page copy now use project wording in runtime invitation views.
- Invitation member-limit evaluation removed Team fallback:
  - `entitlements.limits.project_members` is authoritative in `modules/workspace/api/invitations.ts`.
- Validation:
  - `check-format`, `check-lint`, `check-types`, `test`, and `build-ci` all pass on this branch state.

### PR-ORG-8: Test, Script, and Documentation Hardening

Scope:

- Rewrite tests to canonical org/project flows only:
  - unit/integration/e2e
- Remove/update Team-compat scripts and command references.
- Update all docs to org/project-first hard cutover narrative:
  - setup guides
  - production readiness
  - release checklist
  - migration notes
- Publish major-version release notes for breaking changes.

Acceptance criteria:

- `rg` search for Team route/guard patterns in runtime code returns zero critical matches.
- CI gate fully green:
  - `npm run check-format`
  - `npm run check-lint`
  - `npm run check-types`
  - `npm run test`
  - `npm run test:e2e`
  - `npm run build-ci`

Status update:

- Completed on `org` branch (March 2, 2026).
- Runtime critical Team route/guard patterns were removed:
  - guard modules renamed to project-native paths:
    - `lib/guards/project-api-key.ts`
    - `lib/guards/project-sso.ts`
    - `lib/guards/project-dsync.ts`
  - runtime scan shows no matches for `/teams`, `/api/teams`, or legacy `team-*` guard paths in `components|hooks|lib|modules|pages`.
- Test hardening is fully green on canonical org/project contracts:
  - e2e fixtures and route intercepts use canonical `/orgs/:org/projects/default/*` and `/api/orgs/:org/projects/default/*`.
  - e2e state-leak and routing regressions fixed for settings flows (slug update navigation and webhook delete mocking).
  - middleware route test table stays canonical on `/api/orgs/...`.
- Documentation hardening updates applied:
  - `docs/testing-strategy.md`
  - `docs/environment-commands-playbook.md`
  - `docs/production-readiness-guide.md`
  - Added major release notes:
    - `docs/release-notes/org-project-v2-major.md`
- Gate status:
  - Passed: `check-format`, `check-lint`, `check-types`, `test`, `test:e2e`, `build-ci`.

### PR-ORG-9: Final Team Term Purge (No Compatibility Residue)

Scope:

- Remove last `team`-named runtime/component contracts and UI copy keys.
- Remove remaining team-only operational scripts and package command entries.
- Canonicalize seed/backfill scripts to org/project-only model.
- Normalize active test code terminology to project-native naming.

Acceptance criteria:

- `rg` scan outside historical artifacts (docs + prisma migrations) returns no `team`/`teams` tokens in active code.
- Runtime, scripts, and tests stay green on core CI gates.

Status update:

- Completed on `org` branch (March 2, 2026).
- Removed `components/team/*` completely and migrated implementations to `components/project/*`.
- Removed legacy delete script surface:
  - deleted `delete-team.js`
  - removed `delete-team` from `package.json` scripts.
- Rewrote active operational scripts to canonical org/project behavior:
  - `scripts/bootstrap-org-project-model.js` (no-op guard on native model)
  - `scripts/sync-stripe-subscriptions.js` (org customer + project metadata mapping)
  - `scripts/backfill-org-billing-scope.js` (subscription org-scope repair from project relation)
  - `prisma/seed.ts` (org/project/member/invitation-native seed flow)
- Canonicalized runtime/UI/test naming to project-first terminology and localized keys.
- Validation:
  - Passed: `check-format`, `check-lint`, `check-types`, `test`, `build-ci`.

### Validation and Release Gate

Mandatory technical gate:

- Code search checks:
  - no `/teams/` or `/api/teams/` runtime route output
  - no Team-centric guard/service usage in runtime paths
- Data integrity checks:
  - foreign key consistency
  - orphan check on migrated entities
  - billing scope consistency on subscriptions/invoices
- End-to-end smoke:
  - auth/login
  - org + project navigation
  - project API key/webhook flows
  - org billing checkout + webhook reconciliation
  - invitation/join and member management in org/project context

### Implementation Sequencing Rule

- Execute PR-ORG-1 through PR-ORG-8 in order.
- Do not begin destructive schema removal before migration backfill validation is completed.
- Do not begin implementation from this section without explicit user approval in this conversation.
