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
  },
}));

jest.mock('models/subscription', () => ({
  createStripeSubscription: jest.fn(),
  deleteStripeSubscription: jest.fn(),
  getBySubscriptionId: jest.fn(),
  updateStripeSubscription: jest.fn(),
}));

jest.mock('models/team', () => ({
  getByCustomerId: jest.fn(),
}));

jest.mock('models/webhookEvent', () => ({
  createWebhookEvent: jest.fn(),
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

jest.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      clientVersion?: string;
      constructor(
        message: string,
        options: {
          code: string;
          clientVersion?: string;
          [k: string]: any;
        }
      ) {
        super(message);
        this.code = options.code;
        this.clientVersion = options.clientVersion;
      }
    },
  },
}));

import handler from '@/pages/api/webhooks/stripe';
import { Prisma } from '@prisma/client';
import { stripe } from '@/lib/stripe';
import {
  createStripeSubscription,
  getBySubscriptionId,
  updateStripeSubscription,
} from 'models/subscription';
import { getByCustomerId } from 'models/team';
import { createWebhookEvent } from 'models/webhookEvent';
import { upsertPriceFromStripe } from 'models/price';

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

  it('short-circuits idempotently when event already processed', async () => {
    const duplicateError = new Prisma.PrismaClientKnownRequestError(
      'Unique failed',
      { code: 'P2002', clientVersion: '6.x.x' }
    );

    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce({
      id: 'evt_duplicate',
      type: 'price.updated',
      data: { object: { id: 'price_1' } },
    });
    (createWebhookEvent as jest.Mock).mockRejectedValueOnce(duplicateError);

    const req = buildReq({});
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(upsertPriceFromStripe).not.toHaveBeenCalled();
  });

  it('handles price.updated events and upserts mapped price data', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce({
      id: 'evt_price',
      type: 'price.updated',
      data: { object: { id: 'price_new', product: 'prod_1' } },
    });

    const req = buildReq({});
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(createWebhookEvent).toHaveBeenCalledWith(
      'evt_price',
      'price.updated'
    );
    expect(upsertPriceFromStripe).toHaveBeenCalledWith({
      id: 'price_new',
      product: 'prod_1',
    });
  });

  it('handles customer.subscription.updated with create fallback when record is missing', async () => {
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

    (getBySubscriptionId as jest.Mock).mockResolvedValueOnce(null);
    (getByCustomerId as jest.Mock).mockResolvedValue({ id: 'team-1' });

    const req = buildReq({});
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(createStripeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sub_new',
        teamId: 'team-1',
        priceId: 'price_123',
        productId: 'prod_123',
        quantity: 4,
      })
    );
    expect(updateStripeSubscription).not.toHaveBeenCalled();
  });

  it('handles customer.subscription.updated with existing record update', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValueOnce({
      id: 'evt_sub_existing',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_existing',
          customer: 'cus_123',
          status: 'past_due',
          current_period_start: 1700001000,
          current_period_end: 1700002000,
          cancel_at: null,
          cancel_at_period_end: false,
          trial_end: null,
          items: {
            data: [
              {
                quantity: 2,
                price: {
                  id: 'price_existing',
                  product: 'prod_existing',
                  currency: 'eur',
                },
              },
            ],
          },
        },
      },
    });

    (getBySubscriptionId as jest.Mock).mockResolvedValueOnce({
      id: 'sub_existing',
      teamId: 'team-1',
    });

    const req = buildReq({});
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(updateStripeSubscription).toHaveBeenCalledWith(
      'sub_existing',
      expect.objectContaining({
        status: 'past_due',
        quantity: 2,
        currency: 'eur',
        priceId: 'price_existing',
        productId: 'prod_existing',
      })
    );
  });
});
