import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: {
    teamFeatures: {
      webhook: true,
    },
  },
}));

jest.mock('models/team', () => ({
  throwIfNoTeamAccess: jest.fn(),
}));

jest.mock('@/lib/billing/entitlements', () => ({
  requireTeamEntitlement: jest.fn(),
}));

jest.mock('models/user', () => ({
  throwIfNotAllowed: jest.fn(),
}));

jest.mock('@/lib/zod', () => ({
  getWebhookSchema: {},
  updateWebhookEndpointSchema: {},
  validateWithSchema: jest.fn((_: unknown, payload: any) => payload),
}));

jest.mock('@/lib/svix', () => ({
  findOrCreateApp: jest.fn(),
  findWebhook: jest.fn(),
  updateWebhook: jest.fn(),
}));

jest.mock('@/lib/retraced', () => ({
  sendAudit: jest.fn(),
}));

jest.mock('@/lib/metrics', () => ({
  recordMetric: jest.fn(),
}));

import handler from '@/pages/api/teams/[slug]/webhooks/[endpointId]';
import { throwIfNoTeamAccess } from 'models/team';
import { findOrCreateApp } from '@/lib/svix';

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

const teamMember = {
  teamId: 'team-1',
  team: { id: 'team-1', name: 'Team One' },
  user: { id: 'user-1' },
};

describe('/api/teams/[slug]/webhooks/[endpointId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (throwIfNoTeamAccess as jest.Mock).mockResolvedValue(teamMember);
  });

  it('returns 400 for GET when app is not available', async () => {
    (findOrCreateApp as jest.Mock).mockResolvedValueOnce(null);

    const req = {
      method: 'GET',
      query: { endpointId: 'ep_123' },
      body: {},
    } as unknown as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.statusCode).not.toBeLessThan(300);
    expect(res.body).toEqual({ error: { message: 'Bad request.' } });
  });

  it('returns 400 for PUT when app is not available', async () => {
    (findOrCreateApp as jest.Mock).mockResolvedValueOnce(null);

    const req = {
      method: 'PUT',
      query: { endpointId: 'ep_123' },
      body: {
        name: 'Orders',
        url: 'https://example.com/webhooks',
        eventTypes: ['order.created'],
      },
    } as unknown as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.statusCode).not.toBeLessThan(300);
    expect(res.body).toEqual({ error: { message: 'Bad request.' } });
  });

  it('returns 500 when non-HTTP err.code is provided', async () => {
    (throwIfNoTeamAccess as jest.Mock).mockRejectedValueOnce({
      code: 'P2002',
      message: 'Unique constraint failed',
    });

    const req = {
      method: 'GET',
      query: { endpointId: 'ep_123' },
      body: {},
    } as unknown as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.statusCode).not.toBeLessThan(300);
    expect(res.body).toEqual({
      error: { message: 'Unique constraint failed' },
    });
  });
});
