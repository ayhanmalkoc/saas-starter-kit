import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export const addOrganizationMember = async (
  organizationId: string,
  userId: string,
  role: Role
) => {
  return await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    create: {
      organizationId,
      userId,
      role,
    },
    update: {
      role,
    },
  });
};

export const getOrganizationMemberBySlug = async (
  userId: string,
  organizationSlug: string
) => {
  return await prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: {
        slug: organizationSlug,
      },
      role: {
        in: [Role.ADMIN, Role.MEMBER, Role.OWNER],
      },
    },
    include: {
      organization: true,
    },
  });
};
