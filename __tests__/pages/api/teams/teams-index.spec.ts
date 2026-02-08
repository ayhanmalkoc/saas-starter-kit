import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/server-common', () => ({
  slugify: jest.fn((value: string) => value.toLowerCase().replace(/\s+/g, '-')),
}));

jest.mock('models/team', () => ({
  createTeam: jest.fn(),
  getTeams: jest.fn(),
  isTeamExists: jest.fn(),
}));

jest.mock('models/user', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/metrics', () => ({
  recordMetric: jest.fn(),
}));

jest.mock('@/lib/zod', () => ({
  createTeamSchema: {},
  validateWithSchema: jest.fn((_: unknown, payload: any) => payload),
}));

import handler from '@/pages/api/teams/index';
import { createTeam, getTeams, isTeamExists } from 'models/team';
import { getCurrentUser } from 'models/user';
import { recordMetric } from '@/lib/metrics';

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

describe('/api/teams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: 'user-1' });
  });

  it('returns 401 when user is unauthorized', async () => {
    (getCurrentUser as jest.Mock).mockRejectedValueOnce({
      status: 401,
      message: 'Unauthorized',
    });

    const req = { method: 'GET' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: { message: 'Unauthorized' } });
  });

  it('returns 403 when role-based service denial is raised', async () => {
    (getTeams as jest.Mock).mockRejectedValueOnce({
      status: 403,
      message: 'Forbidden',
    });

    const req = { method: 'GET' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: { message: 'Forbidden' } });
  });

  it('GET returns teams and records metric', async () => {
    (getTeams as jest.Mock).mockResolvedValueOnce([{ id: 'team-1' }]);

    const req = { method: 'GET' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: [{ id: 'team-1' }] });
    expect(recordMetric).toHaveBeenCalledWith('team.fetched');
  });

  it('POST returns duplicate slug validation error', async () => {
    (isTeamExists as jest.Mock).mockResolvedValueOnce(true);

    const req = { method: 'POST', body: { name: 'My Team' } } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: { message: 'A team with the slug already exists.' },
    });
  });

  it('POST creates a team and records metric', async () => {
    (isTeamExists as jest.Mock).mockResolvedValueOnce(false);
    (createTeam as jest.Mock).mockResolvedValueOnce({
      id: 'team-1',
      name: 'My Team',
      slug: 'my-team',
    });

    const req = { method: 'POST', body: { name: 'My Team' } } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(createTeam).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'My Team',
      slug: 'my-team',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      data: { id: 'team-1', name: 'My Team', slug: 'my-team' },
    });
    expect(recordMetric).toHaveBeenCalledWith('team.created');
  });
});
