import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import type { NextApiRequest, NextApiResponse } from 'next';
import env from '@/lib/env';
import type { Readable } from 'node:stream';
import {
  createStripeSubscription,
  deleteStripeSubscription,
  getBySubscriptionId,
  updateStripeSubscription,
} from 'models/subscription';
import { getByCustomerId } from 'models/team';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Get raw body as string
async function getRawBody(readable: Readable): Promise<Buffer> {
  const chunks: any[] = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

const relevantEvents: Stripe.Event.Type[] = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

export default async function POST(req: NextApiRequest, res: NextApiResponse) {
  const rawBody = await getRawBody(req);

  const sig = req.headers['stripe-signature'] as string;
  const { webhookSecret } = env.stripe;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) {
      return res.status(400).json({
        error: { message: 'Missing signature or webhook secret' },
      });
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }

  if (relevantEvents.includes(event.type)) {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await handleSubscriptionCreated(event);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event);
          break;
        case 'customer.subscription.deleted':
          await deleteStripeSubscription(
            (event.data.object as Stripe.Subscription).id
          );
          break;
        default:
          throw new Error('Unhandled relevant event!');
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return res.status(400).json({
        error: {
          message: 'Webhook handler failed. View your nextjs function logs.',
        },
      });
    }
  }
  return res.status(200).json({ received: true });
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
  const {
    cancel_at,
    cancel_at_period_end,
    id,
    status,
    current_period_end,
    current_period_start,
    customer,
    trial_end,
    items,
  } = event.data.object as Stripe.Subscription;

  const subscription = await getBySubscriptionId(id);
  if (!subscription) {
    const teamExists = await getByCustomerId(customer as string);
    if (!teamExists) {
      return;
    } else {
      await handleSubscriptionCreated(event);
    }
  } else {
    const subscriptionItem = items.data[0];
    const priceId = subscriptionItem?.price?.id ?? null;
    const productId =
      typeof subscriptionItem?.price?.product === 'string'
        ? subscriptionItem.price.product
        : null;
    //type Stripe.Subscription.Status = "active" | "canceled" | "incomplete" | "incomplete_expired" | "past_due" | "paused" | "trialing" | "unpaid"
    await updateStripeSubscription(id, {
      status,
      quantity: subscriptionItem?.quantity ?? null,
      currency: subscriptionItem?.price?.currency ?? null,
      currentPeriodEnd: current_period_end
        ? new Date(current_period_end * 1000)
        : undefined,
      currentPeriodStart: current_period_start
        ? new Date(current_period_start * 1000)
        : undefined,
      cancelAt: cancel_at ? new Date(cancel_at * 1000) : undefined,
      cancelAtPeriodEnd: cancel_at_period_end ?? undefined,
      trialEnd: trial_end ? new Date(trial_end * 1000) : undefined,
      priceId,
      productId,
    });
  }
}

async function handleSubscriptionCreated(event: Stripe.Event) {
  const {
    customer,
    id,
    status,
    current_period_start,
    current_period_end,
    cancel_at,
    cancel_at_period_end,
    trial_end,
    items,
  } = event.data.object as Stripe.Subscription;

  const team = await getByCustomerId(customer as string);
  if (!team) {
    return;
  }

  const subscriptionItem = items.data[0];
  const priceId = subscriptionItem?.price?.id ?? null;
  const productId =
    typeof subscriptionItem?.price?.product === 'string'
      ? subscriptionItem.price.product
      : null;

  await createStripeSubscription({
    id,
    teamId: team.id,
    customerId: customer as string,
    status,
    quantity: subscriptionItem?.quantity ?? null,
    currency: subscriptionItem?.price?.currency ?? null,
    currentPeriodStart: current_period_start
      ? new Date(current_period_start * 1000)
      : null,
    currentPeriodEnd: current_period_end
      ? new Date(current_period_end * 1000)
      : null,
    cancelAt: cancel_at ? new Date(cancel_at * 1000) : null,
    cancelAtPeriodEnd: cancel_at_period_end ?? false,
    trialEnd: trial_end ? new Date(trial_end * 1000) : null,
    priceId,
    productId,
  });
}
