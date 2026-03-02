import { prisma } from '@/lib/prisma';
import { Prisma, Role } from '@prisma/client';

const DEFAULT_PROJECT_SLUG = 'default';

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'org';

const buildUniqueOrganizationSlug = async (
  tx: Prisma.TransactionClient,
  baseValue: string
) => {
  const base = normalizeSlug(baseValue);
  let candidate = base;
  let suffix = 1;

  while (true) {
    const exists = await tx.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
};

const buildUniqueProjectSlug = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  baseValue: string
) => {
  const base = normalizeSlug(baseValue);
  let candidate = base;
  let suffix = 1;

  while (true) {
    const exists = await tx.project.findFirst({
      where: {
        organizationId,
        slug: candidate,
      },
      select: { id: true },
    });
    if (!exists) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
};

export const createOrganizationWithDefaultProject = async ({
  ownerUserId,
  organizationName,
  organizationSlug,
  projectName,
}: {
  ownerUserId: string;
  organizationName: string;
  organizationSlug?: string;
  projectName?: string;
}) => {
  return await prisma.$transaction(
    async (tx) => {
      const resolvedOrganizationSlug = await buildUniqueOrganizationSlug(
        tx,
        organizationSlug || organizationName
      );

      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug: resolvedOrganizationSlug,
        },
      });

      const resolvedProjectSlug = await buildUniqueProjectSlug(
        tx,
        organization.id,
        DEFAULT_PROJECT_SLUG
      );

      const project = await tx.project.create({
        data: {
          organizationId: organization.id,
          name: projectName || organizationName,
          slug: resolvedProjectSlug,
        },
      });

      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: ownerUserId,
          },
        },
        create: {
          organizationId: organization.id,
          userId: ownerUserId,
          role: Role.OWNER,
        },
        update: {
          role: Role.OWNER,
        },
      });

      await tx.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId: ownerUserId,
          },
        },
        create: {
          projectId: project.id,
          userId: ownerUserId,
          role: Role.OWNER,
        },
        update: {
          role: Role.OWNER,
        },
      });

      return {
        organization,
        project,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
};

export const getOrganizationByCustomerId = async (billingId: string) => {
  return await prisma.organization.findFirst({
    where: {
      billingId,
    },
  });
};

export const getOrganizationBySlug = async (slug: string) => {
  return await prisma.organization.findUnique({
    where: {
      slug,
    },
  });
};

export const getOrganizationById = async (id: string) => {
  return await prisma.organization.findUnique({
    where: {
      id,
    },
  });
};

export const getOrganizationsByUserId = async (userId: string) => {
  return await prisma.organization.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      projects: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
};

export const setOrganizationBillingIfEmpty = async (
  organizationId: string,
  billingId: string,
  billingProvider: string
) => {
  const result = await prisma.organization.updateMany({
    where: {
      id: organizationId,
      billingId: null,
    },
    data: {
      billingId,
      billingProvider,
    },
  });

  return result.count > 0;
};
