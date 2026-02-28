# Org/Project Hard Cutover (Breaking Change)

Date: March 1, 2026

## Summary

Workspace routing is now strictly org/project canonical. Legacy team-slug alias routes are removed.

## Breaking changes

- Removed legacy app routes:
  - `/teams/:slug/*`
- Removed legacy API routes:
  - `/api/teams/:slug/*`
- Removed legacy route-mode runtime toggles:
  - `LEGACY_TEAM_ROUTE_MODE`
  - `ALLOW_LEGACY_TEAM_ROUTE_ENABLED_IN_PRODUCTION`

## What to update in downstream apps

1. Replace all workspace links with canonical app paths:
   - `/orgs/:orgSlug/projects/:projectSlug/*`
2. Replace all workspace API calls with canonical API paths:
   - `/api/orgs/:orgSlug/projects/:projectSlug/*`
3. Ensure project/team payloads include org/project slug context for client routing.

## Validation completed

- `npm run check-lint`
- `npm run check-types`
- `npm run build-ci`
- `npx playwright test tests/e2e/smoke/org-project-cutover.spec.ts -x`
