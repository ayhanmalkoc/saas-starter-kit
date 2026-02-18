import { NextApiRequest, NextApiResponse } from 'next';
import type Stripe from 'stripe';

import { assertBusinessTierPrice } from '@/lib/billing/catalog';
import { resolveBillingScopeFromTeamId } from '@/lib/billing/scope';
import { getSession } from '@/lib/session';
import { throwIfNoTeamAccess } from 'models/team';
import { stripe } from '@/lib/stripe';
import { updateSubscriptionSchema, validateWithSchema } from '@/lib/zod';
import { getBySubscriptionId } from 'models/subscription';
import { ApiError } from '@/lib/errors';

type PlanChangeType = 'upgrade' | 'downgrade' | 'lateral';

const getYearlyAmount = (price: Stripe.Price, quantity: number) => {
  if (typeof price.unit_amount !== 'number') {
    return null;
  }

  const intervalCount = price.recurring?.interval_count ?? 1;
  if (!price.recurring?.interval) {
    return null;
  }

  const cyclesPerYear =
    price.recurring.interval === 'year'
      ? 1 / intervalCount
      : price.recurring.interval === 'month'
        ? 12 / intervalCount
        : price.recurring.interval === 'week'
          ? 52 / intervalCount
          : 365 / intervalCount;

  return price.unit_amount * quantity * cyclesPerYear;
};

const isSeatBasedPrice = (price: Stripe.Price) =>
  (price.billing_scheme === 'per_unit' || price.billing_scheme === 'tiered') &&
  price.recurring?.usage_type !== 'metered';

const resolvePlanChangeType = ({
  currentPrice,
  nextPrice,
  currentQuantity,
  nextQuantity,
}: {
  currentPrice: Stripe.Price;
  nextPrice: Stripe.Price;
  currentQuantity: number;
  nextQuantity: number;
}): PlanChangeType => {
  const currentYearly = getYearlyAmount(currentPrice, currentQuantity);
  const nextYearly = getYearlyAmount(nextPrice, nextQuantity);

  if (currentYearly === null || nextYearly === null) {
    return 'lateral';
  }

  if (nextYearly > currentYearly) {
    return 'upgrade';
  }

  if (nextYearly < currentYearly) {
    return 'downgrade';
  }

  return 'lateral';
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
  const { subscriptionId, price, quantity } = validateWithSchema(
    updateSubscriptionSchema,
    req.body
  );

  await getSession(req, res);
  const teamMember = await throwIfNoTeamAccess(req, res);
  await assertBusinessTierPrice(price);
  const billingScope = await resolveBillingScopeFromTeamId(teamMember.teamId);

  const subscription = await getBySubscriptionId(subscriptionId);
  const canAccessByOrganization =
    Boolean(billingScope.organizationId) &&
    subscription?.organizationId === billingScope.organizationId;

  if (
    !subscription ||
    (subscription.teamId !== teamMember.teamId && !canAccessByOrganization)
  ) {
    throw new ApiError(404, 'Subscription not found');
  }

  const stripeSubscription =
    await stripe.subscriptions.retrieve(subscriptionId);
  const subscriptionItem = stripeSubscription.items.data[0];
  if (!subscriptionItem) {
    throw new ApiError(422, 'Subscription item not found');
  }

  const stripePrice = await stripe.prices.retrieve(price);
  const currentStripePrice = await stripe.prices.retrieve(
    subscriptionItem.price.id
  );
  const isNextPlanSeatBased = isSeatBasedPrice(stripePrice);

  const nextQuantity = isNextPlanSeatBased
    ? typeof quantity === 'number'
      ? quantity
      : (subscription.quantity ?? subscriptionItem.quantity ?? 1)
    : undefined;

  const currentQuantity = isSeatBasedPrice(currentStripePrice)
    ? (subscriptionItem.quantity ?? subscription.quantity ?? 1)
    : 1;
  const upcomingQuantity = isNextPlanSeatBased ? (nextQuantity ?? 1) : 1;

  const changeType = resolvePlanChangeType({
    currentPrice: currentStripePrice,
    nextPrice: stripePrice,
    currentQuantity,
    nextQuantity: upcomingQuantity,
  });

  const prorationBehavior =
    changeType === 'upgrade'
      ? 'always_invoice'
      : changeType === 'downgrade'
        ? 'none'
        : 'create_prorations';

  const updatedSubscription = await stripe.subscriptions.update(
    subscriptionId,
    {
      items: [
        {
          id: subscriptionItem.id,
          price,
          ...(typeof nextQuantity === 'number'
            ? { quantity: nextQuantity }
            : {}),
        },
      ],
      billing_cycle_anchor: 'unchanged',
      proration_behavior: prorationBehavior,
    }
  );

  res.json({ data: updatedSubscription, changeType, prorationBehavior });
};
