type ParamValue = string | string[] | undefined;

const normalizeParam = (value: ParamValue): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export type WorkspaceRouteContext = {
  organizationSlug: string | null;
  projectSlug: string | null;
};

export const getWorkspaceRouteContextFromQuery = (query: {
  orgSlug?: ParamValue;
  projectSlug?: ParamValue;
}): WorkspaceRouteContext => {
  return {
    organizationSlug: normalizeParam(query.orgSlug),
    projectSlug: normalizeParam(query.projectSlug),
  };
};

export const hasOrgProjectRouteContext = (
  context: WorkspaceRouteContext
): boolean => Boolean(context.organizationSlug && context.projectSlug);

export const getWorkspaceAppPrefix = ({
  context,
}: {
  context: WorkspaceRouteContext;
}) => {
  if (hasOrgProjectRouteContext(context)) {
    return `/orgs/${context.organizationSlug}/projects/${context.projectSlug}`;
  }
  return null;
};

export const buildWorkspaceAppPath = ({
  context,
  suffix,
}: {
  context: WorkspaceRouteContext;
  suffix?: string;
}) => {
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
  suffix,
}: {
  context: WorkspaceRouteContext;
  suffix?: string;
}) => {
  const normalizedSuffix = suffix?.trim().replace(/^\/+|\/+$/g, '');

  if (hasOrgProjectRouteContext(context)) {
    const base = `/api/orgs/${context.organizationSlug}/projects/${context.projectSlug}`;
    return normalizedSuffix ? `${base}/${normalizedSuffix}` : base;
  }
  return null;
};

export type ProjectRouteTarget = {
  slug: string;
  organization?: {
    slug: string;
  } | null;
};

export const buildProjectWorkspaceAppPath = ({
  project,
  suffix,
}: {
  project: ProjectRouteTarget;
  suffix?: string;
}) => {
  const normalizedSuffix = suffix?.trim().replace(/^\/+|\/+$/g, '');
  const organizationSlug = project.organization?.slug;

  if (organizationSlug) {
    const base = `/orgs/${organizationSlug}/projects/${project.slug}`;
    return normalizedSuffix ? `${base}/${normalizedSuffix}` : base;
  }
  return null;
};

export const buildProjectWorkspaceApiPath = ({
  project,
  suffix,
}: {
  project: ProjectRouteTarget;
  suffix?: string;
}) => {
  const normalizedSuffix = suffix?.trim().replace(/^\/+|\/+$/g, '');
  const organizationSlug = project.organization?.slug;

  if (organizationSlug) {
    const base = `/api/orgs/${organizationSlug}/projects/${project.slug}`;
    return normalizedSuffix ? `${base}/${normalizedSuffix}` : base;
  }
  return null;
};
