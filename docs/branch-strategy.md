# Branch Strategy

This repository uses a three-track branch model to evolve two product architectures in parallel.

## Branches

- `main`
  - Stable shared baseline.
  - Must stay production-safe and minimal.
  - Used as the source branch for new long-lived architecture branches.

- `org`
  - OpenAI-style org/project architecture track.
  - Contains canonical org/project routing and billing scope changes.
  - Receives merges from org-focused feature branches.

- `team`
  - Team-scoped architecture track.
  - Preserves and evolves team-first product behavior.
  - Receives merges from team-focused feature branches.

## Ownership and intent

- `main` is not the place for architecture experiments.
- `org` and `team` are long-lived product tracks.
- Cross-track compatibility is explicit, not accidental.

## Feature branch naming

- Org track:
  - `feat/org-*`
  - `fix/org-*`
- Team track:
  - `feat/team-*`
  - `fix/team-*`
- Shared non-breaking work:
  - `chore/shared-*`
  - `docs/shared-*`

## Merge policy

1. Target the right long-lived branch first:
   - org-related work -> `org`
   - team-related work -> `team`
2. Never merge `org` directly into `team`, or `team` into `org`.
3. Promote only vetted shared changes to `main`.
4. Backport from `main` to `org` and `team` regularly to keep base dependencies aligned.

## Quality gates (all PRs)

Run before merge:

1. `npm run check-lint`
2. `npm run check-types`
3. `npm run build-ci`

For workflow-critical changes, also run relevant E2E suites.

## Release model

- Team-track releases come from `team`.
- Org-track releases come from `org`.
- `main` can be released only for shared baseline cuts.
- Breaking architectural cuts must include migration/release notes in `docs/release-notes/`.

## Suggested weekly hygiene

1. Sync `main` with approved shared fixes.
2. Rebase or merge `main` into `org`.
3. Rebase or merge `main` into `team`.
4. Resolve drift early (dependencies, scripts, docs) before it compounds.

## Conflict resolution rule

When the same domain changes in both tracks:

1. Keep separate implementations in `org` and `team`.
2. Extract only clearly shared primitives into `main`.
3. Do not force a single abstraction if it weakens either architecture.
