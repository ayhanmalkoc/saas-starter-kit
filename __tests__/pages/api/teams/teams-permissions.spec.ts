import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('models/team', () => ({ throwIfNoTeamAccess: jest.fn() }));

import handler from '@/pages/api/teams/[slug]/permissions';
import { throwIfNoTeamAccess } from 'models/team';
import { permissions } from '@/lib/permissions';

const createRes = () => ({
  statusCode: 200,
  body: null as unknown,
  headers: {} as Record<string, string>,
  status(code: number) { this.statusCode = code; return this; },
  json(payload: unknown) { this.body = payload; return this; },
  setHeader(key: string, value: string) { this.headers[key] = value; return this; },
}) as unknown as NextApiResponse;

describe('/api/teams/[slug]/permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns team access errors', async () => {
    (throwIfNoTeamAccess as jest.Mock).mockRejectedValueOnce({ status: 401, message: 'Unauthorized' });
    const res = createRes();
    await handler({ method: 'GET' } as NextApiRequest, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns permissions for current role', async () => {
    (throwIfNoTeamAccess as jest.Mock).mockResolvedValueOnce({ role: 'ADMIN' });
    const res = createRes();
    await handler({ method: 'GET' } as NextApiRequest, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: permissions.ADMIN });
  });
});
