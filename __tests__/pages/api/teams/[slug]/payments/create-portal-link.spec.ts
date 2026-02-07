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

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: {
    appUrl: 'https://app.example.com',
  },
}));

import handler from '@/pages/api/teams/[slug]/payments/create-portal-link';
import { getSession } from '@/lib/session';
import { throwIfNoTeamAccess } from 'models/team';
import { getBillingProvider } from '@/lib/billing/provider';

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

describe('POST /api/teams/[slug]/payments/create-portal-link', () => {
  const teamMember = {
    teamId: 'team-1',
    team: { slug: 'acme', billingProvider: 'stripe' },
  };

  const billingProvider = {
    getCustomerId: jest.fn(),
    createPortalSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (throwIfNoTeamAccess as jest.Mock).mockResolvedValue(teamMember);
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (getBillingProvider as jest.Mock).mockReturnValue(billingProvider);
    billingProvider.getCustomerId.mockResolvedValue('cus_123');
    billingProvider.createPortalSession.mockResolvedValue({
      url: 'https://billing.example.com/session',
    });
  });

  it('creates a portal session URL for valid requests', async () => {
    const req = { method: 'POST', body: {} } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: { url: 'https://billing.example.com/session' },
    });
    expect(billingProvider.createPortalSession).toHaveBeenCalledWith({
      customerId: 'cus_123',
      returnUrl: 'https://app.example.com/teams/acme/billing',
    });
  });

  it('returns denied response when team access is blocked', async () => {
    (throwIfNoTeamAccess as jest.Mock).mockRejectedValueOnce({
      status: 403,
      message: 'Team entitlement required',
    });

    const req = { method: 'POST', body: {} } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: { message: 'Team entitlement required' },
    });
    expect(billingProvider.createPortalSession).not.toHaveBeenCalled();
  });

  it('returns provider errors from Stripe portal call', async () => {
    billingProvider.createPortalSession.mockRejectedValueOnce(
      new Error('Stripe portal failed')
    );

    const req = { method: 'POST', body: {} } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Stripe portal failed' } });
  });
});
