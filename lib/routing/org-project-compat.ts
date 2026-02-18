import { prisma } from '@/lib/prisma';
import { getProjectByOrgAndSlug } from 'models/project';

export type LegacyTeamContext = {
  organizationId: string;
  organizationSlug: string;
  projectId: string;
  projectSlug: string;
  teamId: string;
  teamSlug: string;
};

const normalizeSingleParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const resolveLegacyTeamContextFromOrgProject = async ({
  organizationSlug,
  projectSlug,
}: {
  organizationSlug: string;
  projectSlug: string;
}): Promise<LegacyTeamContext | null> => {
  const project = await getProjectByOrgAndSlug(organizationSlug, projectSlug);
  if (!project) {
    return null;
  }

  let team: { id: string; slug: string } | null = null;

  if (project.legacyTeamId) {
    team = await prisma.team.findUnique({
      where: {
        id: project.legacyTeamId,
      },
      select: {
        id: true,
        slug: true,
      },
    });
  }

  if (!team) {
    team = project.teams[0]
      ? {
          id: project.teams[0].id,
          slug: project.teams[0].slug,
        }
      : null;
  }

  if (!team) {
    return null;
  }

  return {
    organizationId: project.organizationId,
    organizationSlug: project.organization.slug,
    projectId: project.id,
    projectSlug: project.slug,
    teamId: team.id,
    teamSlug: team.slug,
  };
};

export const normalizeOrgProjectRouteParams = (params: {
  orgSlug?: string | string[];
  projectSlug?: string | string[];
}) => {
  const organizationSlug = normalizeSingleParam(params.orgSlug);
  const projectSlug = normalizeSingleParam(params.projectSlug);

  if (!organizationSlug || !projectSlug) {
    return null;
  }

  return { organizationSlug, projectSlug };
};

export const buildLegacyTeamDestination = ({
  teamSlug,
  suffixSegments,
  query,
  fallbackPath = 'settings',
}: {
  teamSlug: string;
  suffixSegments?: string[];
  query?: Record<string, string | string[] | undefined>;
  fallbackPath?: string;
}) => {
  const normalizedSuffix = (suffixSegments || [])
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/');

  const destinationPath = normalizedSuffix || fallbackPath;
  const destination = `/teams/${teamSlug}/${destinationPath}`;

  if (!query) {
    return destination;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || key === 'orgSlug' || key === 'projectSlug') {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      continue;
    }

    params.set(key, value);
  }

  const queryString = params.toString();
  return queryString ? `${destination}?${queryString}` : destination;
};
