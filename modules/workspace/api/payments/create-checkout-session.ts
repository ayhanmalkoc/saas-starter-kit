import { NextApiRequest, NextApiResponse } from 'next';

import { assertBusinessTierPrice } from '@/lib/billing/catalog';
import { ApiError } from '@/lib/errors';
import { getSession } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import { getOrganizationById } from 'models/organization';
import { throwIfNoProjectAccess } from 'models/access';
import {
  BLOCKING_SUBSCRIPTION_STATUSES,
  getBlockingByBillingScope,
} from 'models/subscription';
import { getBillingProvider } from '@/lib/billing/provider';
import type {
  BillingSession,
  BillingProjectMember,
} from '@/lib/billing/provider/types';
import env from '@/lib/env';
import { checkoutSessionSchema, validateWithSchema } from '@/lib/zod';
import {
  buildWorkspaceAppPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';

const getBlockingStripeSubscriptions = async (customerId: string) => {
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

    return blocking;
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

const getExistingScopeSubscriptionState = async ({
  organizationId,
  customerId,
}: {
  organizationId: string;
  customerId: string;
}) => {
  const stripeBlockingSubscriptions =
    await getBlockingStripeSubscriptions(customerId);
  if (stripeBlockingSubscriptions.length > 1) {
    return {
      state: 'duplicate' as const,
      source: 'stripe' as const,
      subscriptionIds: stripeBlockingSubscriptions.map(
        (subscription) => subscription.id
      ),
    };
  }

  const scopeBlockingSubscriptions = await getBlockingByBillingScope({
    organizationId,
  });

  if (scopeBlockingSubscriptions.length > 1) {
    return {
      state: 'duplicate' as const,
      source: 'database' as const,
      subscriptionIds: scopeBlockingSubscriptions.map(
        (subscription) => subscription.id
      ),
    };
  }

  const uniqueBlockingSubscriptionIds = new Set<string>([
    ...stripeBlockingSubscriptions.map((subscription) => subscription.id),
    ...scopeBlockingSubscriptions.map((subscription) => subscription.id),
  ]);

  const uniqueBlockingSubscriptionIdList = Array.from(
    uniqueBlockingSubscriptionIds
  );

  if (uniqueBlockingSubscriptionIdList.length > 1) {
    return {
      state: 'duplicate' as const,
      source: 'cross_source' as const,
      subscriptionIds: uniqueBlockingSubscriptionIdList,
    };
  }

  if (uniqueBlockingSubscriptionIdList.length === 1) {
    return {
      state: 'existing' as const,
      subscriptionId: uniqueBlockingSubscriptionIdList[0],
    };
  }

  return {
    state: 'none' as const,
  };
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

  const projectMember = await throwIfNoProjectAccess(req, res);
  await assertBusinessTierPrice(price);
  const session = await getSession(req, res);
  const billingOrganization = await getOrganizationById(
    projectMember.organizationId
  );
  const billingProvider = getBillingProvider(
    billingOrganization?.billingProvider ?? 'stripe'
  );
  const customerId = await billingProvider.getCustomerId(
    projectMember as BillingProjectMember,
    session as BillingSession
  );
  const routeContext = getWorkspaceRouteContextFromQuery(req.query);

  const billingPath = buildWorkspaceAppPath({
    context: routeContext,
    suffix: 'billing',
  });

  if (!billingPath) {
    throw new ApiError(400, 'Workspace app route could not be resolved.');
  }

  const existingSubscriptionState = await getExistingScopeSubscriptionState({
    organizationId: projectMember.organizationId,
    customerId,
  });

  if (existingSubscriptionState.state === 'duplicate') {
    return res.status(409).json({
      error: {
        code: 'duplicate_subscriptions',
        message:
          'Multiple active subscriptions found in billing scope. Resolve duplicates before creating a new checkout session.',
      },
      data: {
        source: existingSubscriptionState.source,
        subscriptionIds: existingSubscriptionState.subscriptionIds,
      },
    });
  }

  if (existingSubscriptionState.state === 'existing') {
    return res.status(409).json({
      error: {
        code: 'subscription_exists',
        message:
          'An active subscription already exists for this organization. Use subscription update flow.',
      },
      data: {
        subscriptionId: existingSubscriptionState.subscriptionId,
      },
    });
  }

  const checkoutSession = await billingProvider.createCheckoutSession({
    customerId,
    price,
    quantity,
    metadata: {
      organizationId: projectMember.organizationId,
      projectId: projectMember.projectId,
    },
    successUrl: `${env.appUrl}${billingPath}`,
    cancelUrl: `${env.appUrl}${billingPath}`,
  });

  res.json({ data: checkoutSession });
};
