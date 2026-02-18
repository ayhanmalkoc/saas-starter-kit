import { prisma } from '@/lib/prisma';

export const getProjectById = async (id: string) => {
  return await prisma.project.findUnique({
    where: {
      id,
    },
  });
};

export const getProjectByOrgAndSlug = async (
  organizationSlug: string,
  projectSlug: string
) => {
  return await prisma.project.findFirst({
    where: {
      slug: projectSlug,
      organization: {
        slug: organizationSlug,
      },
    },
    include: {
      organization: {
        select: {
          id: true,
          slug: true,
        },
      },
      teams: {
        select: {
          id: true,
          slug: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });
};

export const getProjectByLegacyTeamId = async (legacyTeamId: string) => {
  return await prisma.project.findUnique({
    where: {
      legacyTeamId,
    },
  });
};

export const getProjectsByOrganizationId = async (organizationId: string) => {
  return await prisma.project.findMany({
    where: {
      organizationId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
};

export const getProjectsByUserId = async (userId: string) => {
  return await prisma.project.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
};
