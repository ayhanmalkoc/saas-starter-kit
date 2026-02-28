type ParamValue = string | string[] | undefined;

const normalizeParam = (value: ParamValue): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export type WorkspaceRouteContext = {
  teamSlug: string | null;
  organizationSlug: string | null;
  projectSlug: string | null;
};

export const getWorkspaceRouteContextFromQuery = (query: {
  slug?: ParamValue;
  orgSlug?: ParamValue;
  projectSlug?: ParamValue;
}): WorkspaceRouteContext => {
  return {
    teamSlug: normalizeParam(query.slug),
    organizationSlug: normalizeParam(query.orgSlug),
    projectSlug: normalizeParam(query.projectSlug),
  };
};

export const hasOrgProjectRouteContext = (
  context: WorkspaceRouteContext
): boolean => Boolean(context.organizationSlug && context.projectSlug);

export const getWorkspaceAppPrefix = ({
  context,
  teamSlug,
}: {
  context: WorkspaceRouteContext;
  teamSlug?: string | null;
}) => {
  if (hasOrgProjectRouteContext(context)) {
    return `/orgs/${context.organizationSlug}/projects/${context.projectSlug}`;
  }

  const resolvedTeamSlug = teamSlug ?? context.teamSlug;
  if (!resolvedTeamSlug) {
    return null;
  }

  return `/teams/${resolvedTeamSlug}`;
};

export const buildWorkspaceAppPath = ({
  context,
  teamSlug,
  suffix,
}: {
  context: WorkspaceRouteContext;
  teamSlug?: string | null;
  suffix?: string;
}) => {
  const prefix = getWorkspaceAppPrefix({ context, teamSlug });
  if (!prefix) {
    return null;
  }

  const normalizedSuffix = suffix?.trim().replace(/^\/+|\/+$/g, '');
  if (!normalizedSuffix) {
    return prefix;
  }

  return `${prefix}/${normalizedSuffix}`;
};

export const buildWorkspaceApiPath = ({
  context,
  teamSlug,
  suffix,
}: {
  context: WorkspaceRouteContext;
  teamSlug?: string | null;
  suffix?: string;
}) => {
  const normalizedSuffix = suffix?.trim().replace(/^\/+|\/+$/g, '');

  if (hasOrgProjectRouteContext(context)) {
    const base = `/api/orgs/${context.organizationSlug}/projects/${context.projectSlug}`;
    return normalizedSuffix ? `${base}/${normalizedSuffix}` : base;
  }

  const resolvedTeamSlug = teamSlug ?? context.teamSlug;
  if (!resolvedTeamSlug) {
    return null;
  }

  const base = `/api/teams/${resolvedTeamSlug}`;
  return normalizedSuffix ? `${base}/${normalizedSuffix}` : base;
};

type TeamRouteTarget = {
  slug: string;
  project?: {
    slug: string;
    organization?: {
      slug: string;
    } | null;
  } | null;
};

export const buildTeamWorkspaceAppPath = ({
  team,
  suffix,
}: {
  team: TeamRouteTarget;
  suffix?: string;
}) => {
  const normalizedSuffix = suffix?.trim().replace(/^\/+|\/+$/g, '');
  const projectSlug = team.project?.slug;
  const organizationSlug = team.project?.organization?.slug;

  if (organizationSlug && projectSlug) {
    const base = `/orgs/${organizationSlug}/projects/${projectSlug}`;
    return normalizedSuffix ? `${base}/${normalizedSuffix}` : base;
  }

  const base = `/teams/${team.slug}`;
  return normalizedSuffix ? `${base}/${normalizedSuffix}` : base;
};
