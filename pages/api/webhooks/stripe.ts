import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import type { NextApiRequest, NextApiResponse } from 'next';
import env from '@/lib/env';
import type { Readable } from 'node:stream';
import {
  deleteStripeSubscription,
  upsertStripeSubscription,
} from 'models/subscription';
import { ensureOrganizationAndProjectForTeam } from 'models/organization';
import { getByCustomerId } from 'models/team';
import { createWebhookEvent, getWebhookEventById } from 'models/webhookEvent';
import { Prisma } from '@prisma/client';
import { upsertServiceFromStripe } from 'models/service';
import { upsertPriceFromStripe } from 'models/price';
import { upsertInvoiceFromStripe } from 'models/invoice';

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
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.updated',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'price.created',
  'price.updated',
  'product.created',
  'product.updated',
];

export default async function POST(req: NextApiRequest, res: NextApiResponse) {
  const rawBody = await getRawBody(req);

  const sig = req.headers['stripe-signature'] as string;
  const { webhookSecret } = env.stripe;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) {
      console.error('Stripe webhook missing signature or secret');
      return res.status(400).json({
        error: { message: 'Missing signature or webhook secret' },
      });
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed', err);
    return res.status(400).json({ error: { message: err.message } });
  }

  if (relevantEvents.includes(event.type)) {
    const existingEvent = await getWebhookEventById(event.id);
    if (existingEvent) {
      return res.status(200).json({ received: true });
    }

    const eventPayload = JSON.parse(JSON.stringify(event.data.object));

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event);
          break;
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
        case 'customer.updated':
          await handleCustomerUpdated(event);
          break;
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event);
          break;
        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(event);
          break;
        case 'price.created':
        case 'price.updated':
          await handlePriceCreatedOrUpdated(event);
          break;
        case 'product.created':
        case 'product.updated':
          await handleProductCreatedOrUpdated(event);
          break;
        default:
          throw new Error('Unhandled relevant event!');
      }

      await createWebhookEvent(event.id, event.type, eventPayload);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return res.status(200).json({ received: true });
      }

      console.error(
        `Stripe webhook handler failed for event ${event.id} (${event.type})`,
        error
      );
      return res.status(500).json({
        error: {
          message: 'Webhook handler failed.',
        },
      });
    }
  }
  return res.status(200).json({ received: true });
}

async function handleInvoicePaymentSucceeded(_event: Stripe.Event) {
  const invoice = _event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string | null;
  if (!customerId) {
    return;
  }
  const team = await getByCustomerId(customerId);
  if (!team) {
    return;
  }
  const billingScope = await ensureOrganizationAndProjectForTeam(team.id);
  await upsertInvoiceFromStripe(invoice, team.id, billingScope.organizationId);
}

async function handleInvoicePaymentFailed(_event: Stripe.Event) {
  const invoice = _event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string | null;
  if (!customerId) {
    return;
  }
  const team = await getByCustomerId(customerId);
  if (!team) {
    return;
  }
  const billingScope = await ensureOrganizationAndProjectForTeam(team.id);
  await upsertInvoiceFromStripe(invoice, team.id, billingScope.organizationId);
}

async function handleCustomerUpdated(event: Stripe.Event) {
  void event;
  console.warn('customer.updated received but not handled');
}

async function handleProductCreatedOrUpdated(_event: Stripe.Event) {
  const product = _event.data.object as Stripe.Product;
  await upsertServiceFromStripe(product);
}

async function handlePriceCreatedOrUpdated(_event: Stripe.Event) {
  const price = _event.data.object as Stripe.Price;
  await upsertPriceFromStripe(price);
}

const toDate = (timestamp: number | null | undefined) =>
  typeof timestamp === 'number' ? new Date(timestamp * 1000) : null;

const upsertSubscriptionFromStripe = async (
  subscription: Stripe.Subscription
) => {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) {
    console.warn(
      `Stripe subscription ${subscription.id} has no customer id. Skipping.`
    );
    return;
  }

  const team = await getByCustomerId(customerId);
  if (!team) {
    console.warn(
      `No team found for Stripe customer ${customerId}. Skipping subscription ${subscription.id}.`
    );
    return;
  }
  const billingScope = await ensureOrganizationAndProjectForTeam(team.id);

  const subscriptionItem = subscription.items.data[0];
  const priceId = subscriptionItem?.price?.id ?? null;
  const productId =
    typeof subscriptionItem?.price?.product === 'string'
      ? subscriptionItem.price.product
      : null;

  await upsertStripeSubscription({
    id: subscription.id,
    teamId: team.id,
    organizationId: billingScope.organizationId,
    projectId: billingScope.projectId,
    customerId,
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
  });
};

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await upsertSubscriptionFromStripe(subscription);
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  await upsertSubscriptionFromStripe(subscription);
}

async function handleSubscriptionCreated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  await upsertSubscriptionFromStripe(subscription);
}
