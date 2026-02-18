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

export const ensureOrganizationAndProjectForTeam = async (teamId: string) => {
  return await prisma.$transaction(
    async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
        include: {
          members: {
            select: {
              userId: true,
              role: true,
            },
          },
        },
      });

      if (!team) {
        throw new Error(`Team not found for bootstrap: ${teamId}`);
      }

      let organizationId = team.organizationId;
      if (!organizationId) {
        let organization = team.billingId
          ? await tx.organization.findFirst({
              where: {
                billingId: team.billingId,
              },
            })
          : null;

        if (!organization) {
          const organizationSlug = await buildUniqueOrganizationSlug(
            tx,
            team.slug || team.name
          );
          organization = await tx.organization.create({
            data: {
              name: team.name,
              slug: organizationSlug,
              billingId: team.billingId,
              billingProvider: team.billingProvider,
            },
          });
        } else if (!organization.billingId && team.billingId) {
          organization = await tx.organization.update({
            where: { id: organization.id },
            data: {
              billingId: team.billingId,
              billingProvider: team.billingProvider,
            },
          });
        }

        organizationId = organization.id;
      }

      let projectId = team.projectId;
      if (!projectId) {
        let project = await tx.project.findUnique({
          where: {
            legacyTeamId: team.id,
          },
        });

        if (!project) {
          const projectSlug = await buildUniqueProjectSlug(
            tx,
            organizationId,
            DEFAULT_PROJECT_SLUG
          );

          project = await tx.project.create({
            data: {
              organizationId,
              name: team.name,
              slug: projectSlug,
              legacyTeamId: team.id,
            },
          });
        }

        projectId = project.id;
      }

      if (
        team.organizationId !== organizationId ||
        team.projectId !== projectId
      ) {
        await tx.team.update({
          where: { id: team.id },
          data: {
            organizationId,
            projectId,
          },
        });
      }

      if (team.members.length > 0) {
        await tx.organizationMember.createMany({
          data: team.members.map((member) => ({
            organizationId,
            userId: member.userId,
            role: member.role as Role,
          })),
          skipDuplicates: true,
        });

        await tx.projectMember.createMany({
          data: team.members.map((member) => ({
            projectId,
            userId: member.userId,
            role: member.role as Role,
          })),
          skipDuplicates: true,
        });
      }

      return {
        organizationId,
        projectId,
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
