interface PlanChangeParams {
  teamSlug: string;
  priceId: string;
  quantity?: number;
  subscriptionId?: string | null;
  apiBasePath?: string;
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

const parseResponsePayload = async (response: Response) => {
  try {
    return await response.clone().json();
  } catch (jsonError) {
    console.error('Failed to parse billing response as JSON', jsonError);

    const payloadText = await response
      .text()
      .then((text) => text.trim())
      .catch(() => '');

    if (payloadText) {
      return {
        error: {
          message: payloadText,
        },
      };
    }

    return null;
  }
};

const sendPlanChangeRequest = async ({
  apiBasePath,
  endpoint,
  body,
}: {
  apiBasePath?: string;
  endpoint: 'create-checkout-session' | 'update-subscription';
  body: Record<string, unknown>;
}) => {
  if (!apiBasePath) {
    throw new Error('Workspace billing API base path is missing.');
  }

  const basePath = apiBasePath;
  const response = await fetch(`${basePath}/payments/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await parseResponsePayload(response);
  return { response, payload };
};

export const handlePlanChange = async ({
  teamSlug,
  priceId,
  quantity,
  subscriptionId,
  apiBasePath,
}: PlanChangeParams) => {
  if (!apiBasePath) {
    return {
      error: {
        message: `Could not resolve billing endpoint for team "${teamSlug}".`,
      },
    };
  }

  const requestBody = buildRequestBody({ priceId, quantity, subscriptionId });
  const endpoint = subscriptionId
    ? 'update-subscription'
    : 'create-checkout-session';

  const primary = await sendPlanChangeRequest({
    apiBasePath,
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
      apiBasePath,
      endpoint: 'update-subscription',
      body: buildRequestBody({
        priceId,
        quantity,
        subscriptionId: primary.payload.data.subscriptionId,
      }),
    });

    if (!fallback.response.ok) {
      return (
        fallback.payload || {
          error: {
            message: 'Plan update request failed.',
          },
        }
      );
    }

    return fallback.payload;
  }

  if (!primary.response.ok || !primary.payload) {
    return (
      primary.payload || {
        error: {
          message: 'Plan change request failed.',
        },
      }
    );
  }

  return primary.payload;
};
