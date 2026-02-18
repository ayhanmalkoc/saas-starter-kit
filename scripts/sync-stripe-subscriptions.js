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

async function main() {
  console.log('Starting Stripe subscription backfill...');

  const teams = await db.team.findMany({
    where: {
      billingProvider: 'stripe',
      billingId: { not: null },
    },
    select: {
      id: true,
      slug: true,
      billingId: true,
    },
  });

  if (teams.length === 0) {
    console.log('No Stripe-linked teams found. Nothing to sync.');
    return;
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const team of teams) {
    const customerId = team.billingId;
    if (!customerId) {
      continue;
    }

    const subscriptions = await listStripeSubscriptionsByCustomer(customerId);
    if (subscriptions.length === 0) {
      continue;
    }

    for (const subscription of subscriptions) {
      const data = extractStripeSubscriptionShape(subscription);
      const existing = await db.subscription.findUnique({
        where: { id: subscription.id },
        select: { id: true },
      });

      await db.subscription.upsert({
        where: { id: subscription.id },
        create: {
          id: subscription.id,
          teamId: team.id,
          customerId,
          ...data,
        },
        update: {
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
      `Synced ${subscriptions.length} subscription(s) for team ${team.slug}.`
    );
  }

  console.log(
    `Stripe subscription backfill completed. Created: ${createdCount}, Updated: ${updatedCount}`
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
