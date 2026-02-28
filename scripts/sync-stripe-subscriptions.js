/**
 * Backfill Stripe subscriptions into local DB for teams with Stripe customers.
 *
 * This is a recovery path when webhook delivery is missed and billing UI
 * still shows Free plan despite active Stripe subscriptions.
 */
const dotenv = require('dotenv');
const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ quiet: true });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is missing! Please check your .env file.');
}

const db = new PrismaClient();
const stripe = new Stripe(stripeSecretKey);

const toDate = (unixSeconds) =>
  typeof unixSeconds === 'number' ? new Date(unixSeconds * 1000) : null;

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

      return {
        organizationId,
        projectId,
      };
    },
    {
      isolationLevel: 'Serializable',
    }
  );
};

const extractStripeSubscriptionShape = (subscription) => {
  const subscriptionItem = subscription.items?.data?.[0];
  const priceId = subscriptionItem?.price?.id ?? null;
  const productId =
    typeof subscriptionItem?.price?.product === 'string'
      ? subscriptionItem.price.product
      : null;

  return {
    status: subscription.status,
    quantity: subscriptionItem?.quantity ?? null,
    currency: subscriptionItem?.price?.currency ?? null,
    currentPeriodStart: toDate(subscription.current_period_start),
    currentPeriodEnd: toDate(subscription.current_period_end),
    cancelAt: toDate(subscription.cancel_at),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    trialEnd: toDate(subscription.trial_end),
    priceId,
    productId,
  };
};

const listStripeSubscriptionsByCustomer = async (customerId) =>
  await stripe.subscriptions
    .list({
      customer: customerId,
      status: 'all',
      limit: 100,
    })
    .autoPagingToArray({ limit: 10000 });

const syncSubscriptionsForTeamAndCustomer = async ({
  team,
  teamsInScope,
  customerId,
  sourceLabel,
}) => {
  const scopedTeams =
    teamsInScope && teamsInScope.length > 0 ? teamsInScope : [team];
  const billingScopeByTeamId = new Map();

  // Backfill legacy team-scoped rows into organization scope before upsert.
  for (const scopedTeam of scopedTeams) {
    const billingScope = await ensureBillingScopeForTeam(scopedTeam.id);
    billingScopeByTeamId.set(scopedTeam.id, billingScope);

    await db.subscription.updateMany({
      where: {
        teamId: scopedTeam.id,
        organizationId: null,
      },
      data: {
        organizationId: billingScope.organizationId,
        projectId: billingScope.projectId,
      },
    });
  }

  const subscriptions = await listStripeSubscriptionsByCustomer(customerId);
  if (subscriptions.length === 0) {
    return { createdCount: 0, updatedCount: 0, syncedCount: 0 };
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const subscription of subscriptions) {
    const metadataTeamId =
      typeof subscription.metadata?.teamId === 'string' &&
      subscription.metadata.teamId.trim()
        ? subscription.metadata.teamId.trim()
        : null;

    const resolvedTeam =
      (metadataTeamId
        ? scopedTeams.find((candidate) => candidate.id === metadataTeamId)
        : undefined) || team;
    const billingScope = billingScopeByTeamId.get(resolvedTeam.id);

    if (!billingScope) {
      console.warn(
        `Billing scope not found for team ${resolvedTeam.slug}. Skipping subscription ${subscription.id}.`
      );
      continue;
    }

    const data = extractStripeSubscriptionShape(subscription);
    const existing = await db.subscription.findUnique({
      where: { id: subscription.id },
      select: { id: true },
    });

    await db.subscription.upsert({
      where: { id: subscription.id },
      create: {
        id: subscription.id,
        teamId: resolvedTeam.id,
        organizationId: billingScope.organizationId,
        projectId: billingScope.projectId,
        customerId,
        ...data,
      },
      update: {
        teamId: resolvedTeam.id,
        organizationId: billingScope.organizationId,
        projectId: billingScope.projectId,
        customerId,
        ...data,
      },
    });

    if (existing) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
  }

  console.log(
    `Synced ${subscriptions.length} subscription(s) for ${sourceLabel}.`
  );

  return {
    createdCount,
    updatedCount,
    syncedCount: subscriptions.length,
  };
};

async function main() {
  console.log('Starting Stripe subscription backfill...');

  const organizations = await db.organization.findMany({
    where: {
      billingProvider: 'stripe',
      billingId: { not: null },
    },
    select: {
      id: true,
      slug: true,
      billingId: true,
      teams: {
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          slug: true,
          billingId: true,
          billingProvider: true,
          organizationId: true,
          projectId: true,
        },
      },
    },
  });

  let createdCount = 0;
  let updatedCount = 0;
  let syncedCount = 0;

  for (const organization of organizations) {
    const customerId = organization.billingId;
    if (!customerId) {
      continue;
    }

    const team =
      organization.teams.find((candidate) => candidate.billingId === customerId) ||
      organization.teams[0];

    if (!team) {
      console.warn(
        `No team found under organization ${organization.slug}. Skipping customer ${customerId}.`
      );
      continue;
    }

    const result = await syncSubscriptionsForTeamAndCustomer({
      team,
      teamsInScope: organization.teams,
      customerId,
      sourceLabel: `organization ${organization.slug}`,
    });

    createdCount += result.createdCount;
    updatedCount += result.updatedCount;
    syncedCount += result.syncedCount;
  }

  // Legacy fallback for installations that still only have team-level billing ids.
  const legacyTeams = await db.team.findMany({
    where: {
      billingProvider: 'stripe',
      billingId: { not: null },
      OR: [
        {
          organizationId: null,
        },
        {
          organization: {
            is: {
              billingId: null,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      slug: true,
      billingId: true,
      billingProvider: true,
      organizationId: true,
      projectId: true,
    },
  });

  for (const team of legacyTeams) {
    const customerId = team.billingId;
    if (!customerId) {
      continue;
    }

    const result = await syncSubscriptionsForTeamAndCustomer({
      team,
      customerId,
      sourceLabel: `legacy team ${team.slug}`,
    });

    createdCount += result.createdCount;
    updatedCount += result.updatedCount;
    syncedCount += result.syncedCount;
  }

  if (syncedCount === 0) {
    console.log('No Stripe-linked organizations/teams found. Nothing to sync.');
    return;
  }

  console.log(
    `Stripe subscription backfill completed. Synced: ${syncedCount}, Created: ${createdCount}, Updated: ${updatedCount}`
  );
}

main()
  .catch((error) => {
    console.error('Stripe subscription backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
