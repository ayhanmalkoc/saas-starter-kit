import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: { teamFeatures: { deleteTeam: true } },
}));

jest.mock('models/team', () => ({
  throwIfNoTeamAccess: jest.fn(),
  getCurrentUserWithTeam: jest.fn(),
  getTeam: jest.fn(),
  updateTeam: jest.fn(),
  deleteTeam: jest.fn(),
}));

jest.mock('models/user', () => ({
  throwIfNotAllowed: jest.fn(),
}));

jest.mock('@/lib/retraced', () => ({ sendAudit: jest.fn() }));
jest.mock('@/lib/metrics', () => ({ recordMetric: jest.fn() }));
jest.mock('@/lib/zod', () => ({
  updateTeamSchema: {},
  validateWithSchema: jest.fn((_: unknown, payload: any) => payload),
}));

import handler from '@/pages/api/teams/[slug]';
import { deleteTeam, getCurrentUserWithTeam, getTeam, throwIfNoTeamAccess, updateTeam } from 'models/team';
import { throwIfNotAllowed } from 'models/user';
import { recordMetric } from '@/lib/metrics';
import { sendAudit } from '@/lib/retraced';

const createRes = () => ({
  statusCode: 200,
  body: null as unknown,
  headers: {} as Record<string, string>,
  ended: false,
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
  end() {
    this.ended = true;
    return this;
  },
}) as unknown as NextApiResponse;

const userWithTeam = {
  id: 'member-1',
  role: 'OWNER',
  user: { id: 'user-1' },
  team: { id: 'team-1', slug: 'alpha' },
};

describe('/api/teams/[slug]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (throwIfNoTeamAccess as jest.Mock).mockResolvedValue(userWithTeam);
    (getCurrentUserWithTeam as jest.Mock).mockResolvedValue(userWithTeam);
  });

  it('returns team access error from throwIfNoTeamAccess', async () => {
    (throwIfNoTeamAccess as jest.Mock).mockRejectedValueOnce({ status: 404, message: 'Team not found' });
    const res = createRes();

    await handler({ method: 'GET' } as NextApiRequest, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: { message: 'Team not found' } });
  });

  it('returns forbidden for unauthorized role', async () => {
    (throwIfNotAllowed as jest.Mock).mockImplementationOnce(() => {
      throw { status: 403, message: 'Forbidden' };
    });

    const res = createRes();
    await handler({ method: 'GET' } as NextApiRequest, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: { message: 'Forbidden' } });
  });

  it('GET returns team with metric', async () => {
    (getTeam as jest.Mock).mockResolvedValueOnce({ id: 'team-1', slug: 'alpha' });

    const res = createRes();
    await handler({ method: 'GET' } as NextApiRequest, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: { id: 'team-1', slug: 'alpha' } });
    expect(recordMetric).toHaveBeenCalledWith('team.fetched');
  });

  it('PUT updates team and sends audit', async () => {
    (updateTeam as jest.Mock).mockResolvedValueOnce({ id: 'team-1', slug: 'beta' });

    const req = { method: 'PUT', body: { name: 'Beta', slug: 'beta', domain: 'beta.com' } } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: { id: 'team-1', slug: 'beta' } });
    expect(sendAudit).toHaveBeenCalled();
    expect(recordMetric).toHaveBeenCalledWith('team.updated');
  });

  it('DELETE removes team and returns 204', async () => {
    const res = createRes();

    await handler({ method: 'DELETE' } as NextApiRequest, res);

    expect(deleteTeam).toHaveBeenCalledWith({ id: 'team-1' });
    expect(res.statusCode).toBe(204);
    expect((res as any).ended).toBe(true);
    expect(sendAudit).toHaveBeenCalled();
    expect(recordMetric).toHaveBeenCalledWith('team.removed');
  });
});
