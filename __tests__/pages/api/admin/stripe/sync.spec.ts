import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    products: {
      list: jest.fn(() => ({
        autoPagingToArray: jest.fn(),
      })),
    },
    prices: {
      list: jest.fn(() => ({
        autoPagingToArray: jest.fn(),
      })),
    },
  },
}));

jest.mock('models/service', () => ({
  buildServiceUpsert: jest.fn(() => ({})),
}));

jest.mock('models/price', () => ({
  buildPriceUpsert: jest.fn(() => ({})),
}));

import handler from '@/pages/api/admin/stripe/sync';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

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
  } as NextApiResponse;

  return res;
};

describe('POST /api/admin/stripe/sync', () => {
  const originalSecret = process.env.STRIPE_SYNC_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.STRIPE_SYNC_SECRET;

    const productsList = stripe.products.list as jest.Mock;
    const pricesList = stripe.prices.list as jest.Mock;

    productsList.mockReturnValue({
      autoPagingToArray: jest.fn().mockResolvedValue([]),
    });
    pricesList.mockReturnValue({
      autoPagingToArray: jest.fn().mockResolvedValue([]),
    });
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.STRIPE_SYNC_SECRET;
      return;
    }

    process.env.STRIPE_SYNC_SECRET = originalSecret;
  });

  it('returns 503 when sync secret is missing', async () => {
    const req = { method: 'POST', headers: {} } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'Service unavailable' });
  });

  it('returns 401 when provided secret is invalid', async () => {
    process.env.STRIPE_SYNC_SECRET = 'expected-secret';

    const req = {
      method: 'POST',
      headers: { 'x-stripe-sync-secret': ['invalid-secret'] },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 200 when provided secret is valid', async () => {
    process.env.STRIPE_SYNC_SECRET = 'expected-secret';

    const req = {
      method: 'POST',
      headers: { 'x-stripe-sync-secret': ['expected-secret'] },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ synced: true, products: 0, prices: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
