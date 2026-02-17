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
}: Omit<PlanChangeParams, 'teamSlug'>) => {
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

const sendPlanChangeRequest = async ({
  teamSlug,
  endpoint,
  body,
}: {
  teamSlug: string;
  endpoint: 'create-checkout-session' | 'update-subscription';
  body: Record<string, unknown>;
}) => {
  const response = await fetch(`/api/teams/${teamSlug}/payments/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  return { response, payload };
};

export const handlePlanChange = async ({
  teamSlug,
  priceId,
  quantity,
  subscriptionId,
}: PlanChangeParams) => {
  const requestBody = buildRequestBody({ priceId, quantity, subscriptionId });
  const endpoint = subscriptionId
    ? 'update-subscription'
    : 'create-checkout-session';

  const primary = await sendPlanChangeRequest({
    teamSlug,
    endpoint,
    body: requestBody,
  });

  if (
    endpoint === 'create-checkout-session' &&
    primary.response.status === 409 &&
    primary.payload?.error?.code === 'subscription_exists' &&
    primary.payload?.data?.subscriptionId
  ) {
    const fallback = await sendPlanChangeRequest({
      teamSlug,
      endpoint: 'update-subscription',
      body: buildRequestBody({
        priceId,
        quantity,
        subscriptionId: primary.payload.data.subscriptionId,
      }),
    });

    return fallback.payload;
  }

  return primary.payload;
};
