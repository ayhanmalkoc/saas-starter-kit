/**
 * Backfills Organization + Project foundation for legacy Team records.
 *
 * This script is idempotent and safe to run multiple times.
 */
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

const normalizeSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'org';

const buildUniqueOrganizationSlug = async (tx, baseValue) => {
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

const buildUniqueProjectSlug = async (tx, organizationId, baseValue) => {
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

const ensureBillingScopeForTeam = async (teamId) => {
  return await db.$transaction(
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
        throw new Error(`Team not found while bootstrapping scope: ${teamId}`);
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
          const slug = await buildUniqueOrganizationSlug(
            tx,
            team.slug || team.name
          );
          organization = await tx.organization.create({
            data: {
              name: team.name,
              slug,
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
            'default'
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
            role: member.role,
          })),
          skipDuplicates: true,
        });

        await tx.projectMember.createMany({
          data: team.members.map((member) => ({
            projectId,
            userId: member.userId,
            role: member.role,
          })),
          skipDuplicates: true,
        });
      }
    },
    {
      isolationLevel: 'Serializable',
    }
  );
};

async function main() {
  console.log(
    'Bootstrapping Organization/Project model from existing teams...'
  );

  const teams = await db.team.findMany({
    select: {
      id: true,
      slug: true,
      organizationId: true,
      projectId: true,
    },
  });

  let processed = 0;

  for (const team of teams) {
    if (team.organizationId && team.projectId) {
      continue;
    }

    await ensureBillingScopeForTeam(team.id);
    processed += 1;
    console.log(`Bootstrapped team: ${team.slug}`);
  }

  console.log(
    `Organization/Project bootstrap completed. Processed teams: ${processed}`
  );
}

main()
  .catch((error) => {
    console.error('Organization/Project bootstrap failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
