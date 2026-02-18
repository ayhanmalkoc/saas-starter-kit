import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { findOrCreateApp } from '@/lib/svix';
import { Role, Team } from '@prisma/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureOrganizationAndProjectForTeam } from './organization';
import { getCurrentUser } from './user';
import { normalizeUser } from './user';
import { validateWithSchema, teamSlugSchema } from '@/lib/zod';

export const createTeam = async (param: {
  userId: string;
  name: string;
  slug: string;
}) => {
  const { userId, name, slug } = param;

  const team = await prisma.team.create({
    data: {
      name,
      slug,
    },
  });

  await addTeamMember(team.id, userId, Role.OWNER);
  await ensureOrganizationAndProjectForTeam(team.id);

  await findOrCreateApp(team.name, team.id);

  return team;
};

export const getByCustomerId = async (
  billingId: string
): Promise<Team | null> => {
  const team = await prisma.team.findFirst({
    where: {
      billingId,
    },
  });

  if (team) {
    return team;
  }

  const organization = await prisma.organization.findFirst({
    where: {
      billingId,
    },
    select: {
      teams: {
        orderBy: {
          createdAt: 'asc',
        },
        take: 1,
      },
    },
  });

  return organization?.teams[0] ?? null;
};

export const getTeam = async (key: { id: string } | { slug: string }) => {
  return await prisma.team.findUniqueOrThrow({
    where: key,
  });
};

export const deleteTeam = async (key: { id: string } | { slug: string }) => {
  return await prisma.team.delete({
    where: key,
  });
};

export const addTeamMember = async (
  teamId: string,
  userId: string,
  role: Role
) => {
  return await prisma.teamMember.upsert({
    create: {
      teamId,
      userId,
      role,
    },
    update: {
      role,
    },
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
  });
};

export const removeTeamMember = async (teamId: string, userId: string) => {
  return await prisma.teamMember.delete({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
  });
};

// Keep this query index-friendly; monitor performance on large team-member datasets.
export const getTeams = async (userId: string) => {
  return await prisma.team.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      _count: {
        select: { members: true },
      },
    },
  });
};

export async function getTeamRoles(userId: string) {
  return await prisma.teamMember.findMany({
    where: {
      userId,
    },
    select: {
      teamId: true,
      role: true,
    },
  });
}

// Check if the user is an admin or owner of the team
export async function isTeamAdmin(userId: string, teamId: string) {
  const teamMember = await prisma.teamMember.findUniqueOrThrow({
    where: {
      teamId_userId: {
        userId,
        teamId,
      },
    },
  });

  return teamMember.role === Role.ADMIN || teamMember.role === Role.OWNER;
}

// Keep this query index-friendly; monitor performance on large team-member datasets.
export const getTeamMembers = async (slug: string) => {
  const members = await prisma.teamMember.findMany({
    where: {
      team: {
        slug,
      },
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return members?.map((member) => {
    member.user = normalizeUser(member.user);
    return member;
  });
};

export const updateTeam = async (slug: string, data: Partial<Team>) => {
  return await prisma.team.update({
    where: {
      slug,
    },
    data: data,
  });
};

export const setTeamBillingIfEmpty = async (
  slug: string,
  billingId: string,
  billingProvider: string
) => {
  const result = await prisma.team.updateMany({
    where: {
      slug,
      billingId: null,
    },
    data: {
      billingId,
      billingProvider,
    },
  });

  return result.count > 0;
};

// Keep this query index-friendly; monitor performance as team count grows.
export const isTeamExists = async (slug: string) => {
  return await prisma.team.count({
    where: {
      slug,
    },
  });
};

// Check if the current user has access to the team
// Should be used in API routes to check if the user has access to the team
export const throwIfNoTeamAccess = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  const session = await getSession(req, res);

  if (!session) {
    throw new Error('Unauthorized');
  }

  const { slug } = validateWithSchema(teamSlugSchema, req.query);

  const teamMember = await getTeamMember(session.user.id, slug);

  if (!teamMember.team.organizationId || !teamMember.team.projectId) {
    await ensureOrganizationAndProjectForTeam(teamMember.team.id);
    return {
      ...(await getTeamMember(session.user.id, slug)),
      user: {
        ...session.user,
      },
    };
  }

  if (!teamMember) {
    throw new Error('You do not have access to this team');
  }

  return {
    ...teamMember,
    user: {
      ...session.user,
    },
  };
};

// Keep this query index-friendly; monitor performance for team/user joins.
// Get the current user's team member object
export const getTeamMember = async (userId: string, slug: string) => {
  return await prisma.teamMember.findFirstOrThrow({
    where: {
      userId,
      team: {
        slug,
      },
      role: {
        in: ['ADMIN', 'MEMBER', 'OWNER'],
      },
    },
    include: {
      team: true,
    },
  });
};

// Get current user with team info
export const getCurrentUserWithTeam = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  const user = await getCurrentUser(req, res);

  const { slug } = validateWithSchema(teamSlugSchema, req.query);

  const { role, team } = await getTeamMember(user.id, slug);

  return {
    ...user,
    role,
    team,
  };
};
