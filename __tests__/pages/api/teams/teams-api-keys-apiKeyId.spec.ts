import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: { teamFeatures: { apiKey: true } },
}));

jest.mock('models/team', () => ({ throwIfNoTeamAccess: jest.fn(), getCurrentUserWithTeam: jest.fn() }));
jest.mock('models/user', () => ({ throwIfNotAllowed: jest.fn() }));
jest.mock('models/apiKey', () => ({ deleteApiKey: jest.fn() }));
jest.mock('@/lib/guards/team-api-key', () => ({ throwIfNoAccessToApiKey: jest.fn() }));
jest.mock('@/lib/billing/entitlements', () => ({ requireTeamEntitlement: jest.fn() }));
jest.mock('@/lib/metrics', () => ({ recordMetric: jest.fn() }));
jest.mock('@/lib/zod', () => ({
  deleteApiKeySchema: {},
  validateWithSchema: jest.fn((_: unknown, payload: any) => payload),
}));

import handler from '@/pages/api/teams/[slug]/api-keys/[apiKeyId]';
import { getCurrentUserWithTeam, throwIfNoTeamAccess } from 'models/team';
import { throwIfNotAllowed } from 'models/user';
import { deleteApiKey } from 'models/apiKey';
import { throwIfNoAccessToApiKey } from '@/lib/guards/team-api-key';
import { requireTeamEntitlement } from '@/lib/billing/entitlements';
import { recordMetric } from '@/lib/metrics';

const createRes = () => ({
  statusCode: 200,
  body: null as unknown,
  headers: {} as Record<string, string>,
  ended: false,
  status(code: number) { this.statusCode = code; return this; },
  json(payload: unknown) { this.body = payload; return this; },
  setHeader(key: string, value: string) { this.headers[key] = value; return this; },
  end() { this.ended = true; return this; },
}) as unknown as NextApiResponse;

const teamMember = { teamId: 'team-1', team: { id: 'team-1' }, user: { id: 'user-1' } };

describe('/api/teams/[slug]/api-keys/[apiKeyId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (throwIfNoTeamAccess as jest.Mock).mockResolvedValue(teamMember);
    (getCurrentUserWithTeam as jest.Mock).mockResolvedValue({ team: { id: 'team-1' } });
    (requireTeamEntitlement as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns access and role errors', async () => {
    (throwIfNoTeamAccess as jest.Mock).mockRejectedValueOnce({ status: 401, message: 'Unauthorized' });
    const res1 = createRes();
    await handler({ method: 'DELETE', query: { apiKeyId: 'key-1' } } as any, res1);
    expect(res1.statusCode).toBe(401);

    (throwIfNotAllowed as jest.Mock).mockImplementationOnce(() => { throw { status: 403, message: 'Forbidden' }; });
    const res2 = createRes();
    await handler({ method: 'DELETE', query: { apiKeyId: 'key-1' } } as any, res2);
    expect(res2.statusCode).toBe(403);
  });

  it('returns api key access guard errors', async () => {
    (throwIfNoAccessToApiKey as jest.Mock).mockRejectedValueOnce({ status: 404, message: 'API key not found' });
    const res = createRes();
    await handler({ method: 'DELETE', query: { apiKeyId: 'key-404' } } as any, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: { message: 'API key not found' } });
  });

  it('deletes api key and records metric', async () => {
    const res = createRes();
    await handler({ method: 'DELETE', query: { apiKeyId: 'key-1' } } as any, res);
    expect(deleteApiKey).toHaveBeenCalledWith('key-1');
    expect(res.statusCode).toBe(204);
    expect((res as any).ended).toBe(true);
    expect(recordMetric).toHaveBeenCalledWith('apikey.removed');
  });
});
