import { NextApiRequest, NextApiResponse } from 'next';

import { getSession } from '@/lib/session';
import { throwIfNoTeamAccess } from 'models/team';
import { stripe } from '@/lib/stripe';
import { updateSubscriptionSchema, validateWithSchema } from '@/lib/zod';
import { getBySubscriptionId } from 'models/subscription';
import { ApiError } from '@/lib/errors';

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

  const subscription = await getBySubscriptionId(subscriptionId);
  if (!subscription || subscription.teamId !== teamMember.teamId) {
    throw new ApiError(404, 'Subscription not found');
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscriptionId
  );
  const subscriptionItem = stripeSubscription.items.data[0];
  if (!subscriptionItem) {
    throw new ApiError(422, 'Subscription item not found');
  }

  const stripePrice = await stripe.prices.retrieve(price);
  const usageType = stripePrice.recurring?.usage_type;
  const isSeatBased =
    (stripePrice.billing_scheme === 'per_unit' ||
      stripePrice.billing_scheme === 'tiered') &&
    usageType !== 'metered';

  const nextQuantity = isSeatBased
    ? typeof quantity === 'number'
      ? quantity
      : subscription.quantity ?? subscriptionItem.quantity ?? 1
    : undefined;

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
      proration_behavior: 'create_prorations',
    }
  );

  res.json({ data: updatedSubscription });
};
