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
