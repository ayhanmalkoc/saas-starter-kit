import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
}));

jest.mock('models/team', () => ({
  throwIfNoTeamAccess: jest.fn(),
}));

jest.mock('models/service', () => ({
  getAllServices: jest.fn(),
}));

jest.mock('models/price', () => ({
  getAllPrices: jest.fn(),
}));

jest.mock('models/subscription', () => ({
  getByTeamId: jest.fn(),
}));

jest.mock('models/invoice', () => ({
  getByTeamId: jest.fn(),
}));

import handler from '@/pages/api/teams/[slug]/payments/products';
import { getSession } from '@/lib/session';
import { throwIfNoTeamAccess } from 'models/team';
import { getAllServices } from 'models/service';
import { getAllPrices } from 'models/price';
import { getByTeamId as getSubscriptionsByTeamId } from 'models/subscription';
import { getByTeamId as getInvoicesByTeamId } from 'models/invoice';

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

describe('GET /api/teams/[slug]/payments/products', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (throwIfNoTeamAccess as jest.Mock).mockResolvedValue({ teamId: 'team-1' });
    (getAllServices as jest.Mock).mockResolvedValue([
      { id: 'prod_1', name: 'Starter' },
      { id: 'prod_2', name: 'Pro' },
    ]);
    (getAllPrices as jest.Mock).mockResolvedValue([
      { id: 'price_1', serviceId: 'prod_1' },
      { id: 'price_2', serviceId: 'prod_2' },
    ]);
    (getSubscriptionsByTeamId as jest.Mock).mockResolvedValue([
      { id: 'sub_1', teamId: 'team-1', priceId: 'price_2' },
      { id: 'sub_2', teamId: 'team-1', priceId: 'price_missing' },
    ]);
    (getInvoicesByTeamId as jest.Mock).mockResolvedValue([{ id: 'inv_1' }]);
  });

  it('maps products with prices and active subscriptions', async () => {
    const req = { method: 'GET', body: {} } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(getSubscriptionsByTeamId).toHaveBeenCalledWith('team-1');
    expect(getAllPrices).toHaveBeenCalledTimes(1);

    expect(res.body).toEqual({
      data: {
        products: [
          {
            id: 'prod_1',
            name: 'Starter',
            prices: [{ id: 'price_1', serviceId: 'prod_1' }],
          },
          {
            id: 'prod_2',
            name: 'Pro',
            prices: [{ id: 'price_2', serviceId: 'prod_2' }],
          },
        ],
        subscriptions: [
          {
            id: 'sub_1',
            teamId: 'team-1',
            priceId: 'price_2',
            price: { id: 'price_2', serviceId: 'prod_2' },
            product: {
              id: 'prod_2',
              name: 'Pro',
              prices: [{ id: 'price_2', serviceId: 'prod_2' }],
            },
          },
        ],
        invoices: [{ id: 'inv_1' }],
      },
    });
  });

  it('returns 500 when session does not include user', async () => {
    (getSession as jest.Mock).mockResolvedValueOnce({ user: null });

    const req = { method: 'GET', body: {} } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Could not get user' } });
  });

  it('returns team-access errors and blocks model reads', async () => {
    (throwIfNoTeamAccess as jest.Mock).mockRejectedValueOnce({
      status: 403,
      message: 'Entitlement denied',
    });

    const req = { method: 'GET', body: {} } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: { message: 'Entitlement denied' } });
    expect(getSubscriptionsByTeamId).not.toHaveBeenCalled();
    expect(getAllPrices).not.toHaveBeenCalled();
  });
});
