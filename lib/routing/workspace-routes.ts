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
  void teamSlug;

  if (hasOrgProjectRouteContext(context)) {
    return `/orgs/${context.organizationSlug}/projects/${context.projectSlug}`;
  }
  return null;
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
  void teamSlug;

  const prefix = getWorkspaceAppPrefix({ context });
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
  void teamSlug;

  const normalizedSuffix = suffix?.trim().replace(/^\/+|\/+$/g, '');

  if (hasOrgProjectRouteContext(context)) {
    const base = `/api/orgs/${context.organizationSlug}/projects/${context.projectSlug}`;
    return normalizedSuffix ? `${base}/${normalizedSuffix}` : base;
  }
  return null;
};

export type TeamRouteTarget = {
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
  return null;
};

export const buildTeamWorkspaceApiPath = ({
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
    const base = `/api/orgs/${organizationSlug}/projects/${projectSlug}`;
    return normalizedSuffix ? `${base}/${normalizedSuffix}` : base;
  }
  return null;
};
