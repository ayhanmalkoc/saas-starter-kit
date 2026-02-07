# Database query performance notes

This document centralizes EXPLAIN/SQL reference notes that were previously kept inline in model/API files.

## `models/team.ts`

- **`getTeams`**
  - Observed plans show a join from `TeamMember` filtered by `userId` into `Team`, with an aggregate count over `TeamMember` for `_count.members`.
  - In larger datasets, the aggregate side may use `Seq Scan` + `HashAggregate`.
- **`getTeamMembers`**
  - Observed plans show lookup by `Team.slug` and fetch of related `TeamMember` (+ `User` via include), using `Team_slug_key` and `TeamMember_teamId_userId_key` in indexed scenarios.
  - Small datasets can still produce `Seq Scan` plans.
- **`isTeamExists`**
  - Count by `slug` may use either index-only access on `Team_slug_key` or sequential scan depending on table size/statistics.
- **`getTeamMember`**
  - Access pattern is user + team slug (+ role filter), with a join between `TeamMember` and `Team`; plans varied between index-assisted and sequential scans depending on data distribution.

## `models/invitation.ts`

- **`getInvitations`**
  - Query filters invitations by `(teamId, sentViaEmail)` and returns invitation fields used to build invite URLs.
  - Historical plans show bitmap index/heap scans on invitation indexes for `teamId`.

## `pages/api/teams/[slug]/members.ts`

- **Leave-team owner guard (`countTeamMembers`)**
  - The owner-count check uses `COUNT(*)` over `TeamMember` filtered by `teamId` and `role = OWNER`.
  - Plans historically varied between bitmap/index-assisted and sequential scans in small tables.

## `pages/api/teams/[slug]/invitations.ts`

- **Invite-via-email existing-member guard (`countTeamMembers` with `user.email`)**
  - The guard checks whether an invited email already belongs to a team member using a relation filter (`TeamMember` + `User`).
  - Historical plans included both index-assisted join paths (`User_email_key`, `TeamMember_teamId_userId_key`) and small-table sequential scan variants.
