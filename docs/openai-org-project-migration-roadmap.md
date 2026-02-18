# OpenAI-Style Org/Project Migration Roadmap

This document tracks the migration from legacy `Team`-scoped SaaS billing to:

- `Organization` (billing + governance scope)
- `Project` (runtime/API scope)

The target model mirrors OpenAI Platform structure:

- Organization: billing, limits, usage governance, people
- Project: API keys, webhooks, evaluations, project-level limits/people

## PR Series

## PR-1: Additive Foundation (current branch)

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

## PR-3: Billing Scope Cutover

Scope:

- Make subscription authority organization-scoped.
- Migrate remaining team-scoped reads to organization/project reads.
- Backfill/cleanup stale team-only subscription records.
- Harden guardrails for duplicate subscriptions across projects.

## PR-4: Team as Legacy Alias (optional deprecation step)

Scope:

- Keep `Team` as backward-compatible alias layer or remove if fully migrated.
- Finalize docs and remove dual-write paths.

## Operational Commands

Local migration bootstrap:

```bash
npm run org:bootstrap
```

Local billing reset/sync with new scope bootstrap:

```bash
npm run setup:stripe
```
