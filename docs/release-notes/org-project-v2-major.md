# Org/Project Native V2 Major Release Notes

Date: March 1, 2026

## Summary

This release finalizes the hard cutover to an org/project-native architecture.
Legacy team-slug route aliases and team-compat runtime paths are removed.

## Breaking Changes

- Canonical UI routes only:
  - `/orgs/:orgSlug/projects/:projectSlug/*`
- Canonical API routes only:
  - `/api/orgs/:orgSlug/projects/:projectSlug/*`
- Legacy aliases removed:
  - `/teams/:slug/*`
  - `/api/teams/:slug/*`
- Auth and SSO contracts updated:
  - Join payload uses `organizationName` (replaces `team`).
  - SSO verify payload uses `projectSlug` (replaces `slug`).
  - SSO verify multi-match response uses `useProjectSlug` (replaces `useSlug`).

## Integration Changes

- Audit contract is project-native (`project.*` actions and `project` group payload).
- Invitation email module and template are project-native:
  - `lib/email/sendProjectInviteEmail.ts`
  - `components/emailTemplates/ProjectInvite.tsx`
- Runtime guard module names are project-native:
  - `lib/guards/project-api-key.ts`
  - `lib/guards/project-sso.ts`
  - `lib/guards/project-dsync.ts`

## Validation

The following gates are green on the `org` branch state:

- `npm run check-format`
- `npm run check-lint`
- `npm run check-types`
- `npm run test`
- `npm run build-ci`
