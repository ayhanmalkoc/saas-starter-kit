import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
}));

jest.mock('models/team', () => ({
  throwIfNoTeamAccess: jest.fn(),
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn(),
    },
    prices: {
      retrieve: jest.fn(),
    },
  },
}));

jest.mock('@/lib/zod', () => ({
  updateSubscriptionSchema: {},
  validateWithSchema: jest.fn((_: unknown, payload: unknown) => payload),
}));

jest.mock('models/subscription', () => ({
  getBySubscriptionId: jest.fn(),
}));

import handler from '@/pages/api/teams/[slug]/payments/update-subscription';
import { getSession } from '@/lib/session';
import { throwIfNoTeamAccess } from 'models/team';
import { stripe } from '@/lib/stripe';
import { getBySubscriptionId } from 'models/subscription';

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

describe('POST /api/teams/[slug]/payments/update-subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (throwIfNoTeamAccess as jest.Mock).mockResolvedValue({ teamId: 'team-1' });
    (getBySubscriptionId as jest.Mock).mockResolvedValue({
      id: 'sub_1',
      teamId: 'team-1',
      quantity: 5,
    });

    (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue({
      items: {
        data: [{ id: 'si_1', quantity: 1, price: { id: 'price_current' } }],
      },
    });

    (stripe.prices.retrieve as jest.Mock).mockImplementation((priceId) => {
      if (priceId === 'price_current') {
        return Promise.resolve({
          id: 'price_current',
          unit_amount: 900,
          billing_scheme: 'per_unit',
          recurring: {
            usage_type: 'licensed',
            interval: 'month',
            interval_count: 1,
          },
        });
      }

      if (priceId === 'price_metered') {
        return Promise.resolve({
          id: 'price_metered',
          unit_amount: 900,
          billing_scheme: 'per_unit',
          recurring: {
            usage_type: 'metered',
            interval: 'month',
            interval_count: 1,
          },
        });
      }

      if (priceId === 'price_downgrade') {
        return Promise.resolve({
          id: 'price_downgrade',
          unit_amount: 400,
          billing_scheme: 'per_unit',
          recurring: {
            usage_type: 'licensed',
            interval: 'month',
            interval_count: 1,
          },
        });
      }

      return Promise.resolve({
        id: 'price_2',
        unit_amount: 1900,
        billing_scheme: 'per_unit',
        recurring: {
          usage_type: 'licensed',
          interval: 'month',
          interval_count: 1,
        },
      });
    });

    (stripe.subscriptions.update as jest.Mock).mockResolvedValue({
      id: 'sub_1',
      status: 'active',
    });
  });

  it('updates a seat-based subscription and forwards quantity', async () => {
    const req = {
      method: 'POST',
      body: { subscriptionId: 'sub_1', price: 'price_2', quantity: 12 },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_1', price: 'price_2', quantity: 12 }],
      billing_cycle_anchor: 'unchanged',
      proration_behavior: 'always_invoice',
    });
    expect(res.body).toEqual(
      expect.objectContaining({
        changeType: 'upgrade',
        prorationBehavior: 'always_invoice',
      })
    );
  });

  it('omits quantity for metered pricing updates', async () => {
    const req = {
      method: 'POST',
      body: { subscriptionId: 'sub_1', price: 'price_metered', quantity: 12 },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_1', price: 'price_metered' }],
      billing_cycle_anchor: 'unchanged',
      proration_behavior: 'create_prorations',
    });
  });

  it('sets no proration when plan change is a downgrade', async () => {
    const req = {
      method: 'POST',
      body: { subscriptionId: 'sub_1', price: 'price_downgrade', quantity: 1 },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_1', price: 'price_downgrade', quantity: 1 }],
      billing_cycle_anchor: 'unchanged',
      proration_behavior: 'none',
    });
    expect(res.body).toEqual(
      expect.objectContaining({
        changeType: 'downgrade',
        prorationBehavior: 'none',
      })
    );
  });

  it('returns not found for subscription owned by another team', async () => {
    (getBySubscriptionId as jest.Mock).mockResolvedValueOnce({
      id: 'sub_1',
      teamId: 'team-other',
    });

    const req = {
      method: 'POST',
      body: { subscriptionId: 'sub_1', price: 'price_2' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: { message: 'Subscription not found' } });
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it('returns 422 when stripe subscription has no item', async () => {
    (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValueOnce({
      items: { data: [] },
    });

    const req = {
      method: 'POST',
      body: { subscriptionId: 'sub_1', price: 'price_2' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      error: { message: 'Subscription item not found' },
    });
  });

  it('returns team entitlement errors and blocks Stripe calls', async () => {
    (throwIfNoTeamAccess as jest.Mock).mockRejectedValueOnce({
      status: 403,
      message: 'Entitlement denied',
    });

    const req = {
      method: 'POST',
      body: { subscriptionId: 'sub_1', price: 'price_2' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: { message: 'Entitlement denied' } });
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});
