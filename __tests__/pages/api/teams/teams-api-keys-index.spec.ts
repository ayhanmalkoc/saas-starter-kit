import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: { teamFeatures: { apiKey: true } },
}));

jest.mock('models/team', () => ({ throwIfNoTeamAccess: jest.fn() }));
jest.mock('models/user', () => ({ throwIfNotAllowed: jest.fn() }));
jest.mock('models/apiKey', () => ({
  createApiKey: jest.fn(),
  fetchApiKeys: jest.fn(),
}));
jest.mock('@/lib/billing/entitlements', () => ({
  requireTeamEntitlement: jest.fn(),
}));
jest.mock('@/lib/metrics', () => ({ recordMetric: jest.fn() }));
jest.mock('@/lib/zod', () => ({
  createApiKeySchema: {},
  validateWithSchema: jest.fn((_: unknown, payload: any) => payload),
}));

import handler from '@/pages/api/teams/[slug]/api-keys';
import { throwIfNoTeamAccess } from 'models/team';
import { throwIfNotAllowed } from 'models/user';
import { createApiKey, fetchApiKeys } from 'models/apiKey';
import { requireTeamEntitlement } from '@/lib/billing/entitlements';
import { recordMetric } from '@/lib/metrics';

const createRes = () =>
  ({
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
  }) as unknown as NextApiResponse;

const teamMember = { teamId: 'team-1', team: { id: 'team-1' }, role: 'OWNER' };

describe('/api/teams/[slug]/api-keys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (throwIfNoTeamAccess as jest.Mock).mockResolvedValue(teamMember);
    (requireTeamEntitlement as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns throwIfNoTeamAccess and forbidden errors', async () => {
    (throwIfNoTeamAccess as jest.Mock).mockRejectedValueOnce({
      status: 404,
      message: 'Team not found',
    });
    const res1 = createRes();
    await handler({ method: 'GET' } as NextApiRequest, res1);
    expect(res1.statusCode).toBe(404);

    (throwIfNotAllowed as jest.Mock).mockImplementationOnce(() => {
      throw { status: 403, message: 'Forbidden' };
    });
    const res2 = createRes();
    await handler({ method: 'GET' } as NextApiRequest, res2);
    expect(res2.statusCode).toBe(403);
  });

  it('GET returns api keys', async () => {
    (fetchApiKeys as jest.Mock).mockResolvedValueOnce([{ id: 'key-1' }]);
    const res = createRes();
    await handler({ method: 'GET' } as NextApiRequest, res);
    expect(res.body).toEqual({ data: [{ id: 'key-1' }] });
    expect(recordMetric).toHaveBeenCalledWith('apikey.fetched');
  });

  it('POST creates key and returns response shape', async () => {
    (createApiKey as jest.Mock).mockResolvedValueOnce({
      id: 'key-1',
      name: 'Backend',
    });
    const res = createRes();
    await handler({ method: 'POST', body: { name: 'Backend' } } as any, res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      data: { apiKey: { id: 'key-1', name: 'Backend' } },
    });
    expect(recordMetric).toHaveBeenCalledWith('apikey.created');
  });
});
