import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const getProjectById = async (id: string) => {
  return await prisma.project.findUnique({
    where: {
      id,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          billingId: true,
          billingProvider: true,
        },
      },
    },
  });
};

export const getProjectBySlug = async (slug: string) => {
  return await prisma.project.findFirst({
    where: {
      slug,
    },
    include: {
      organization: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
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
          name: true,
          billingId: true,
          billingProvider: true,
        },
      },
    },
  });
};

export const getProjectBySlugWithinOrganization = async ({
  organizationId,
  slug,
}: {
  organizationId: string;
  slug: string;
}) => {
  return await prisma.project.findFirst({
    where: {
      organizationId,
      slug,
    },
  });
};

export const updateProject = async (
  projectId: string,
  data: Prisma.ProjectUpdateInput
) => {
  return await prisma.project.update({
    where: {
      id: projectId,
    },
    data,
  });
};

export const deleteProject = async (projectId: string) => {
  return await prisma.project.delete({
    where: {
      id: projectId,
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
    include: {
      _count: {
        select: {
          members: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          billingId: true,
          billingProvider: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
};
