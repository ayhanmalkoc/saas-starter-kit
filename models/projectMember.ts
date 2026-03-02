import { prisma } from '@/lib/prisma';
import { Prisma, Role } from '@prisma/client';
import { normalizeUser } from './user';

export const addProjectMember = async (
  projectId: string,
  userId: string,
  role: Role
) => {
  return await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    create: {
      projectId,
      userId,
      role,
    },
    update: {
      role,
    },
  });
};

export const removeProjectMember = async (
  projectId: string,
  userId: string
) => {
  return await prisma.projectMember.delete({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });
};

export const getProjectMembers = async (projectId: string) => {
  const members = await prisma.projectMember.findMany({
    where: {
      projectId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return members.map((member) => ({
    ...member,
    user: normalizeUser(member.user),
  }));
};

export const getProjectMemberByProjectId = async (
  userId: string,
  projectId: string
) => {
  return await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    include: {
      project: {
        include: {
          organization: true,
        },
      },
    },
  });
};

export const getProjectMemberByOrgAndProjectSlug = async (
  userId: string,
  organizationSlug: string,
  projectSlug: string
) => {
  return await prisma.projectMember.findFirst({
    where: {
      userId,
      role: {
        in: [Role.ADMIN, Role.MEMBER, Role.OWNER],
      },
      project: {
        slug: projectSlug,
        organization: {
          slug: organizationSlug,
        },
      },
    },
    include: {
      project: {
        include: {
          organization: true,
        },
      },
    },
  });
};

export const getProjectRoles = async (userId: string) => {
  return await prisma.projectMember.findMany({
    where: {
      userId,
    },
    select: {
      projectId: true,
      role: true,
    },
  });
};

export const isProjectAdmin = async (userId: string, projectId: string) => {
  const projectMember = await prisma.projectMember.findUniqueOrThrow({
    where: {
      projectId_userId: {
        userId,
        projectId,
      },
    },
  });

  return projectMember.role === Role.ADMIN || projectMember.role === Role.OWNER;
};

export const countProjectMembers = async ({
  where,
}: {
  where: Prisma.ProjectMemberWhereInput;
}) => {
  return await prisma.projectMember.count({ where });
};

export const updateProjectMember = async ({
  where,
  data,
}: {
  where: Prisma.ProjectMemberWhereUniqueInput;
  data: Prisma.ProjectMemberUpdateInput;
}) => {
  return await prisma.projectMember.update({ where, data });
};
