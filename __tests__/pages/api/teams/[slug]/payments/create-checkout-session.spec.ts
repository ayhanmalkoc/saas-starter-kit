import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
}));

jest.mock('models/team', () => ({
  throwIfNoTeamAccess: jest.fn(),
}));

jest.mock('@/lib/billing/provider', () => ({
  getBillingProvider: jest.fn(),
}));

jest.mock('@/lib/zod', () => ({
  checkoutSessionSchema: {},
  validateWithSchema: jest.fn((_: unknown, payload: unknown) => payload),
}));

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: {
    appUrl: 'https://app.example.com',
  },
}));

import handler from '@/pages/api/teams/[slug]/payments/create-checkout-session';
import { getSession } from '@/lib/session';
import { throwIfNoTeamAccess } from 'models/team';
import { getBillingProvider } from '@/lib/billing/provider';

const createRes = () => {
  const res = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
  } as unknown as NextApiResponse;

  return res;
};

describe('POST /api/teams/[slug]/payments/create-checkout-session', () => {
  const teamMember = {
    teamId: 'team-1',
    team: { slug: 'acme', billingProvider: 'stripe' },
  };

  const billingProvider = {
    getCustomerId: jest.fn(),
    createCheckoutSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (throwIfNoTeamAccess as jest.Mock).mockResolvedValue(teamMember);
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (getBillingProvider as jest.Mock).mockReturnValue(billingProvider);
    billingProvider.getCustomerId.mockResolvedValue('cus_123');
    billingProvider.createCheckoutSession.mockResolvedValue({ id: 'cs_123' });
  });

  it('creates a checkout session when access is allowed', async () => {
    const req = {
      method: 'POST',
      body: { price: 'price_123', quantity: 3 },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: { id: 'cs_123' } });
    expect(billingProvider.getCustomerId).toHaveBeenCalledWith(
      teamMember,
      expect.objectContaining({ user: { id: 'user-1' } })
    );
    expect(billingProvider.createCheckoutSession).toHaveBeenCalledWith({
      customerId: 'cus_123',
      price: 'price_123',
      quantity: 3,
      successUrl: 'https://app.example.com/teams/acme/billing',
      cancelUrl: 'https://app.example.com/teams/acme/billing',
    });
  });

  it('returns team access errors when membership check fails', async () => {
    (throwIfNoTeamAccess as jest.Mock).mockRejectedValueOnce({
      status: 403,
      message: 'Entitlement denied',
    });

    const req = {
      method: 'POST',
      body: { price: 'price_123' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: { message: 'Entitlement denied' } });
    expect(billingProvider.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns 500 when billing provider checkout call fails', async () => {
    billingProvider.createCheckoutSession.mockRejectedValueOnce(
      new Error('Stripe create failed')
    );

    const req = {
      method: 'POST',
      body: { price: 'price_123' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Stripe create failed' } });
  });
});
