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
  deleteWebhookSchema: {},
  webhookEndpointSchema: {},
  validateWithSchema: jest.fn((_: unknown, payload: any) => payload),
}));

jest.mock('@/lib/svix', () => ({
  createWebhook: jest.fn(),
  deleteWebhook: jest.fn(),
  findOrCreateApp: jest.fn(),
  createEventType: jest.fn(),
  listWebhooks: jest.fn(),
}));

jest.mock('@/lib/retraced', () => ({
  sendAudit: jest.fn(),
}));

jest.mock('@/lib/metrics', () => ({
  recordMetric: jest.fn(),
}));

import handler from '@/pages/api/teams/[slug]/webhooks';
import { throwIfNoTeamAccess } from 'models/team';
import { createWebhook, findOrCreateApp } from '@/lib/svix';

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

describe('/api/teams/[slug]/webhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (throwIfNoTeamAccess as jest.Mock).mockResolvedValue(teamMember);
    (findOrCreateApp as jest.Mock).mockResolvedValue({ id: 'app_123' });
  });

  it('returns 400 for POST when webhook URL protocol is http', async () => {
    const req = {
      method: 'POST',
      body: {
        name: 'Orders',
        url: 'http://example.com/webhooks',
        eventTypes: ['order.created'],
      },
      query: {},
    } as unknown as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: { message: 'Webhook URL must use HTTPS protocol.' },
    });
    expect(createWebhook).not.toHaveBeenCalled();
  });

  it('returns 200 for POST when webhook URL protocol is https', async () => {
    (createWebhook as jest.Mock).mockResolvedValue({ id: 'ep_123' });

    const req = {
      method: 'POST',
      body: {
        name: 'Orders',
        url: 'https://example.com/webhooks',
        eventTypes: ['order.created'],
      },
      query: {},
    } as unknown as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: { id: 'ep_123' } });
    expect(createWebhook).toHaveBeenCalled();
  });
});
