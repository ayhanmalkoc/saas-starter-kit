import type { NextApiRequest, NextApiResponse } from 'next';
import { Readable } from 'node:stream';

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: {
    stripe: {
      webhookSecret: 'whsec_test',
    },
  },
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
    subscriptions: {
      retrieve: jest.fn(),
    },
  },
}));

jest.mock('models/subscription', () => ({
  deleteStripeSubscription: jest.fn(),
  getBySubscriptionId: jest.fn(),
  upsertStripeSubscription: jest.fn(),
}));

jest.mock('models/organization', () => ({
  getOrganizationByCustomerId: jest.fn(),
  getOrganizationById: jest.fn(),
}));

jest.mock('models/webhookEvent', () => ({
  createWebhookEvent: jest.fn(),
  getWebhookEventById: jest.fn(),
}));

jest.mock('models/service', () => ({
  upsertServiceFromStripe: jest.fn(),
}));

jest.mock('models/price', () => ({
  upsertPriceFromStripe: jest.fn(),
}));

jest.mock('models/invoice', () => ({
  upsertInvoiceFromStripe: jest.fn(),
}));

import handler from '@/pages/api/webhooks/stripe';
import { stripe } from '@/lib/stripe';
import { upsertStripeSubscription } from 'models/subscription';
import { getOrganizationByCustomerId } from 'models/organization';
import { createWebhookEvent, getWebhookEventById } from 'models/webhookEvent';

const buildReq = (eventPayload: unknown, signature = 'valid-signature') => {
  const req = Readable.from([JSON.stringify(eventPayload)]) as NextApiRequest;
  req.method = 'POST';
  req.headers = {
    'stripe-signature': signature,
  };
  return req;
};

const createRes = () => {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as unknown as NextApiResponse;

  return res;
};

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getWebhookEventById as jest.Mock).mockResolvedValue(null);
  });

  it('returns 400 when webhook signature is invalid', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockImplementationOnce(() => {
      throw new Error('No signatures found matching the expected signature');
    });

    const req = buildReq({ bad: true }, 'invalid-signature');
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: { message: 'No signatures found matching the expected signature' },
    });
    expect(createWebhookEvent).not.toHaveBeenCalled();
  });

  it('returns 200 for non-relevant event types', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce({
      id: 'evt_non_relevant',
      type: 'charge.refunded',
      data: { object: {} },
    });

    const req = buildReq({});
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(createWebhookEvent).not.toHaveBeenCalled();
  });

  it('short-circuits when event was already processed', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce({
      id: 'evt_duplicate',
      type: 'price.updated',
      data: { object: { id: 'price_1' } },
    });
    (getWebhookEventById as jest.Mock).mockResolvedValueOnce({
      id: 'evt_duplicate',
    });

    const req = buildReq({});
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(createWebhookEvent).not.toHaveBeenCalled();
  });

  it('upserts subscription for customer.subscription.updated', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce({
      id: 'evt_sub_updated',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_new',
          customer: 'cus_123',
          status: 'active',
          current_period_start: 1700000000,
          current_period_end: 1700003600,
          cancel_at: null,
          cancel_at_period_end: false,
          trial_end: null,
          metadata: {},
          items: {
            data: [
              {
                quantity: 4,
                price: {
                  id: 'price_123',
                  product: 'prod_123',
                  currency: 'usd',
                },
              },
            ],
          },
        },
      },
    });
    (getOrganizationByCustomerId as jest.Mock).mockResolvedValue({
      id: 'org-1',
    });

    const req = buildReq({});
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(upsertStripeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sub_new',
        organizationId: 'org-1',
        customerId: 'cus_123',
        priceId: 'price_123',
        productId: 'prod_123',
        quantity: 4,
      })
    );
  });
});
