/**
 * Backfill Stripe subscriptions into local DB for organizations with Stripe customers.
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

const resolveProjectForSubscription = (subscription, projects) => {
  const metadataProjectId =
    typeof subscription.metadata?.projectId === 'string'
      ? subscription.metadata.projectId.trim()
      : '';

  if (metadataProjectId) {
    const matchedById = projects.find(
      (project) => project.id === metadataProjectId
    );
    if (matchedById) {
      return matchedById.id;
    }
  }

  const metadataProjectSlug =
    typeof subscription.metadata?.projectSlug === 'string'
      ? subscription.metadata.projectSlug.trim()
      : '';

  if (metadataProjectSlug) {
    const matchedBySlug = projects.find(
      (project) => project.slug === metadataProjectSlug
    );
    if (matchedBySlug) {
      return matchedBySlug.id;
    }
  }

  return projects[0]?.id ?? null;
};

const syncSubscriptionsForOrganization = async ({
  organization,
  customerId,
  sourceLabel,
}) => {
  const subscriptions = await listStripeSubscriptionsByCustomer(customerId);
  if (subscriptions.length === 0) {
    return { createdCount: 0, updatedCount: 0, syncedCount: 0 };
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const subscription of subscriptions) {
    const projectId = resolveProjectForSubscription(
      subscription,
      organization.projects
    );

    if (!projectId) {
      console.warn(
        `No project available under organization ${organization.slug}. Skipping subscription ${subscription.id}.`
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
        organizationId: organization.id,
        projectId,
        customerId,
        ...data,
      },
      update: {
        organizationId: organization.id,
        projectId,
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
      projects: {
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          slug: true,
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

    const result = await syncSubscriptionsForOrganization({
      organization,
      customerId,
      sourceLabel: `organization ${organization.slug}`,
    });

    createdCount += result.createdCount;
    updatedCount += result.updatedCount;
    syncedCount += result.syncedCount;
  }

  if (syncedCount === 0) {
    console.log('No Stripe-linked organizations found. Nothing to sync.');
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
