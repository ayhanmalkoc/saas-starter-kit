interface PlanChangeParams {
  teamSlug: string;
  priceId: string;
  quantity?: number;
  subscriptionId?: string | null;
}

const buildRequestBody = ({
  priceId,
  quantity,
  subscriptionId,
}: PlanChangeParams) => {
  const payload: Record<string, unknown> = {
    price: priceId,
  };

  if (typeof quantity === 'number') {
    payload.quantity = quantity;
  }

  if (subscriptionId) {
    payload.subscriptionId = subscriptionId;
  }

  return payload;
};

export const handlePlanChange = async ({
  teamSlug,
  priceId,
  quantity,
  subscriptionId,
}: PlanChangeParams) => {
  const endpoint = subscriptionId
    ? 'update-subscription'
    : 'create-checkout-session';

  const response = await fetch(`/api/teams/${teamSlug}/payments/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildRequestBody({ priceId, quantity, subscriptionId })),
  });

  return response.json();
};
