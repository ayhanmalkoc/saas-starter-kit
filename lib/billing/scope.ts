import { prisma } from '@/lib/prisma';
import { ensureOrganizationAndProjectForTeam } from 'models/organization';

export type BillingScope = {
  teamId: string;
  organizationId: string | null;
  projectId: string | null;
};

export const resolveBillingScopeFromTeamId = async (
  teamId: string
): Promise<BillingScope> => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      organizationId: true,
      projectId: true,
    },
  });

  if (!team) {
    throw new Error(`Team not found while resolving billing scope: ${teamId}`);
  }

  if (team.organizationId && team.projectId) {
    return {
      teamId: team.id,
      organizationId: team.organizationId,
      projectId: team.projectId,
    };
  }

  const bootstrapped = await ensureOrganizationAndProjectForTeam(team.id);
  return {
    teamId: team.id,
    organizationId: bootstrapped.organizationId,
    projectId: bootstrapped.projectId,
  };
};
