import { NextApiRequest, NextApiResponse } from 'next';

import { assertBusinessTierPrice } from '@/lib/billing/catalog';
import { resolveBillingScopeFromTeamId } from '@/lib/billing/scope';
import { ApiError } from '@/lib/errors';
import { getSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import { throwIfNoTeamAccess } from 'models/team';
import { getByBillingScope } from 'models/subscription';
import { getBillingProvider } from '@/lib/billing/provider';
import type {
  BillingSession,
  BillingTeamMember,
} from '@/lib/billing/provider/types';
import env from '@/lib/env';
import { checkoutSessionSchema, validateWithSchema } from '@/lib/zod';

const BLOCKING_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'incomplete',
  'unpaid',
]);

const getBlockingStripeSubscriptionId = async (customerId: string) => {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });

    const blocking = subscriptions.data
      .filter((subscription) =>
        BLOCKING_SUBSCRIPTION_STATUSES.has(subscription.status)
      )
      .sort((a, b) => b.created - a.created);

    return blocking[0]?.id ?? null;
  } catch (error) {
    console.error(
      `Failed to check Stripe subscriptions for customer ${customerId}`,
      error
    );
    throw new ApiError(
      502,
      'Unable to validate existing Stripe subscriptions. Please retry.'
    );
  }
};

const getExistingScopeSubscriptionId = async ({
  teamId,
  organizationId,
  customerId,
}: {
  teamId: string;
  organizationId?: string | null;
  customerId: string;
}) => {
  const stripeSubscriptionId =
    await getBlockingStripeSubscriptionId(customerId);
  if (stripeSubscriptionId) {
    return stripeSubscriptionId;
  }

  const scopeSubscriptions = await getByBillingScope({
    teamId,
    organizationId,
  });

  const blockingScopeSubscriptions = scopeSubscriptions
    .filter((subscription) =>
      BLOCKING_SUBSCRIPTION_STATUSES.has(subscription.status)
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return blockingScopeSubscriptions[0]?.id ?? null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    switch (req.method) {
      case 'POST':
        await handlePOST(req, res);
        break;
      default:
        res.setHeader('Allow', 'POST');
        res.status(405).json({
          error: { message: `Method ${req.method} Not Allowed` },
        });
    }
  } catch (error: any) {
    const message = error.message || 'Something went wrong';
    const status = error.status || 500;

    res.status(status).json({ error: { message } });
  }
}

const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const { price, quantity } = validateWithSchema(
    checkoutSessionSchema,
    req.body
  );

  const teamMember = await throwIfNoTeamAccess(req, res);
  await assertBusinessTierPrice(price);
  const session = await getSession(req, res);
  const billingProvider = getBillingProvider(teamMember.team.billingProvider);
  const customerId = await billingProvider.getCustomerId(
    teamMember as BillingTeamMember,
    session as BillingSession
  );
  const billingScope = await resolveBillingScopeFromTeamId(teamMember.teamId);

  const existingSubscriptionId = await getExistingScopeSubscriptionId({
    teamId: teamMember.teamId,
    organizationId: billingScope.organizationId,
    customerId,
  });

  if (existingSubscriptionId) {
    return res.status(409).json({
      error: {
        code: 'subscription_exists',
        message:
          'An active subscription already exists for this team. Use subscription update flow.',
      },
      data: {
        subscriptionId: existingSubscriptionId,
      },
    });
  }

  const checkoutSession = await billingProvider.createCheckoutSession({
    customerId,
    price,
    quantity,

    successUrl: `${env.appUrl}/teams/${teamMember.team.slug}/billing`,
    cancelUrl: `${env.appUrl}/teams/${teamMember.team.slug}/billing`,
  });

  res.json({ data: checkoutSession });
};
