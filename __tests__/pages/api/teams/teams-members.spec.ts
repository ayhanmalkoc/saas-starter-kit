import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('models/team', () => ({
  throwIfNoTeamAccess: jest.fn(),
  getTeamMembers: jest.fn(),
  removeTeamMember: jest.fn(),
}));

jest.mock('models/user', () => ({ throwIfNotAllowed: jest.fn() }));
jest.mock('models/teamMember', () => ({
  countTeamMembers: jest.fn(),
  updateTeamMember: jest.fn(),
}));
jest.mock('@/lib/rbac', () => ({ validateMembershipOperation: jest.fn() }));
jest.mock('@/lib/retraced', () => ({ sendAudit: jest.fn() }));
jest.mock('@/lib/svix', () => ({ sendEvent: jest.fn() }));
jest.mock('@/lib/metrics', () => ({ recordMetric: jest.fn() }));
jest.mock('@/lib/zod', () => ({
  deleteMemberSchema: {},
  updateMemberSchema: {},
  validateWithSchema: jest.fn((_: unknown, payload: any) => payload),
}));

import handler from '@/pages/api/teams/[slug]/members';
import {
  getTeamMembers,
  removeTeamMember,
  throwIfNoTeamAccess,
} from 'models/team';
import { countTeamMembers, updateTeamMember } from 'models/teamMember';
import { throwIfNotAllowed } from 'models/user';
import { validateMembershipOperation } from '@/lib/rbac';
import { sendAudit } from '@/lib/retraced';
import { sendEvent } from '@/lib/svix';
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
    end: jest.fn(),
  }) as unknown as NextApiResponse;

const teamMember = {
  teamId: 'team-1',
  userId: 'user-1',
  role: 'OWNER',
  team: { id: 'team-1', slug: 'alpha' },
  user: { id: 'user-1' },
};

describe('/api/teams/[slug]/members', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (throwIfNoTeamAccess as jest.Mock).mockResolvedValue(teamMember);
  });

  it('returns throwIfNoTeamAccess errors', async () => {
    (throwIfNoTeamAccess as jest.Mock).mockRejectedValueOnce({
      status: 401,
      message: 'Unauthorized',
    });
    const res = createRes();
    await handler({ method: 'GET' } as NextApiRequest, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns forbidden for unauthorized role', async () => {
    (throwIfNotAllowed as jest.Mock).mockImplementationOnce(() => {
      throw { status: 403, message: 'Forbidden' };
    });
    const res = createRes();
    await handler({ method: 'GET' } as NextApiRequest, res);
    expect(res.statusCode).toBe(403);
  });

  it('GET returns members + metric', async () => {
    (getTeamMembers as jest.Mock).mockResolvedValueOnce([{ id: 'm1' }]);
    const res = createRes();
    await handler({ method: 'GET' } as NextApiRequest, res);
    expect(res.body).toEqual({ data: [{ id: 'm1' }] });
    expect(recordMetric).toHaveBeenCalledWith('member.fetched');
  });

  it('DELETE removes member, sends audit/event', async () => {
    (removeTeamMember as jest.Mock).mockResolvedValueOnce({ id: 'm2' });
    const res = createRes();
    await handler({ method: 'DELETE', query: { memberId: 'm2' } } as any, res);
    expect(validateMembershipOperation).toHaveBeenCalledWith('m2', teamMember);
    expect(sendEvent).toHaveBeenCalledWith('team-1', 'member.removed', {
      id: 'm2',
    });
    expect(sendAudit).toHaveBeenCalled();
    expect(recordMetric).toHaveBeenCalledWith('member.removed');
    expect(res.body).toEqual({ data: {} });
  });

  it('PUT blocks owner removal when last owner', async () => {
    (countTeamMembers as jest.Mock).mockResolvedValueOnce(1);
    const res = createRes();
    await handler({ method: 'PUT' } as NextApiRequest, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: { message: 'A team should have at least one owner.' },
    });
  });

  it('PATCH rejects invalid role change', async () => {
    (validateMembershipOperation as jest.Mock).mockRejectedValueOnce({
      status: 400,
      message: 'Invalid role change',
    });
    const res = createRes();
    await handler(
      { method: 'PATCH', body: { memberId: 'm2', role: 'OWNER' } } as any,
      res
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { message: 'Invalid role change' } });
  });

  it('PATCH updates member role and sends audit', async () => {
    (updateTeamMember as jest.Mock).mockResolvedValueOnce({
      id: 'm2',
      role: 'ADMIN',
    });
    const res = createRes();
    await handler(
      { method: 'PATCH', body: { memberId: 'm2', role: 'ADMIN' } } as any,
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: { id: 'm2', role: 'ADMIN' } });
    expect(sendAudit).toHaveBeenCalled();
    expect(recordMetric).toHaveBeenCalledWith('member.role.updated');
  });
});
