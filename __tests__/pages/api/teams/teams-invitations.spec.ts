import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('models/team', () => ({
  throwIfNoTeamAccess: jest.fn(),
  addTeamMember: jest.fn(),
}));

jest.mock('models/user', () => ({ throwIfNotAllowed: jest.fn() }));
jest.mock('models/teamMember', () => ({ countTeamMembers: jest.fn() }));
jest.mock('models/invitation', () => ({
  createInvitation: jest.fn(),
  deleteInvitation: jest.fn(),
  getInvitation: jest.fn(),
  getInvitationCount: jest.fn(),
  getInvitations: jest.fn(),
  isInvitationExpired: jest.fn(),
}));

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/email/sendTeamInviteEmail', () => ({ sendTeamInviteEmail: jest.fn() }));
jest.mock('@/lib/email/utils', () => ({
  isEmailAllowed: jest.fn(() => true),
  extractEmailDomain: jest.fn((email: string) => email.split('@')[1]),
}));
jest.mock('@/lib/svix', () => ({ sendEvent: jest.fn() }));
jest.mock('@/lib/retraced', () => ({ sendAudit: jest.fn() }));
jest.mock('@/lib/metrics', () => ({ recordMetric: jest.fn() }));
jest.mock('@/lib/zod', () => ({
  inviteViaEmailSchema: {},
  getInvitationsSchema: {},
  deleteInvitationSchema: {},
  acceptInvitationSchema: {},
  validateWithSchema: jest.fn((_: unknown, payload: any) => payload),
}));

import handler from '@/pages/api/teams/[slug]/invitations';
import { addTeamMember, throwIfNoTeamAccess } from 'models/team';
import { throwIfNotAllowed } from 'models/user';
import { countTeamMembers } from 'models/teamMember';
import { createInvitation, deleteInvitation, getInvitation, getInvitationCount, getInvitations, isInvitationExpired } from 'models/invitation';
import { getSession } from '@/lib/session';
import { sendEvent } from '@/lib/svix';
import { sendAudit } from '@/lib/retraced';
import { recordMetric } from '@/lib/metrics';
import { extractEmailDomain } from '@/lib/email/utils';

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

const teamMember = { teamId: 'team-1', userId: 'user-1', user: { id: 'user-1' }, team: { id: 'team-1' } };

describe('/api/teams/[slug]/invitations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (throwIfNoTeamAccess as jest.Mock).mockResolvedValue(teamMember);
    (isInvitationExpired as jest.Mock).mockResolvedValue(false);
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'user-2', email: 'member@corp.com' } });
  });

  it('returns access errors and not-allowed errors', async () => {
    (throwIfNoTeamAccess as jest.Mock).mockRejectedValueOnce({ status: 404, message: 'Team not found' });
    const res1 = createRes();
    await handler({ method: 'GET', query: { sentViaEmail: 'true' } } as any, res1);
    expect(res1.statusCode).toBe(404);

    (throwIfNotAllowed as jest.Mock).mockImplementationOnce(() => { throw { status: 403, message: 'Forbidden' }; });
    const res2 = createRes();
    await handler({ method: 'GET', query: { sentViaEmail: 'true' } } as any, res2);
    expect(res2.statusCode).toBe(403);
  });

  it('GET returns invitations', async () => {
    (getInvitations as jest.Mock).mockResolvedValueOnce([{ id: 'inv-1' }]);
    const res = createRes();
    await handler({ method: 'GET', query: { sentViaEmail: 'true' } } as any, res);
    expect(res.body).toEqual({ data: [{ id: 'inv-1' }] });
    expect(recordMetric).toHaveBeenCalledWith('invitation.fetched');
  });

  it('POST rejects duplicate invitation', async () => {
    (countTeamMembers as jest.Mock).mockResolvedValueOnce(0);
    (getInvitationCount as jest.Mock).mockResolvedValueOnce(1);
    const res = createRes();
    await handler({ method: 'POST', body: { sentViaEmail: true, email: 'a@corp.com', role: 'ADMIN' } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { message: 'An invitation already exists for this email.' } });
  });

  it('POST creates invitation and records audit/event/metric', async () => {
    (countTeamMembers as jest.Mock).mockResolvedValueOnce(0);
    (getInvitationCount as jest.Mock).mockResolvedValueOnce(0);
    (createInvitation as jest.Mock).mockResolvedValueOnce({ id: 'inv-1', sentViaEmail: true });
    const res = createRes();
    await handler({ method: 'POST', body: { sentViaEmail: true, email: 'a@corp.com', role: 'ADMIN' } } as any, res);
    expect(res.statusCode).toBe(204);
    expect(sendEvent).toHaveBeenCalledWith('team-1', 'invitation.created', { id: 'inv-1', sentViaEmail: true });
    expect(sendAudit).toHaveBeenCalled();
    expect(recordMetric).toHaveBeenCalledWith('invitation.created');
  });

  it('DELETE removes invitation with proper checks', async () => {
    (getInvitation as jest.Mock).mockResolvedValueOnce({ id: 'inv-1', invitedBy: 'user-1', team: { id: 'team-1' } });
    const res = createRes();
    await handler({ method: 'DELETE', query: { id: 'inv-1' } } as any, res);
    expect(deleteInvitation).toHaveBeenCalledWith({ id: 'inv-1' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: {} });
    expect(sendAudit).toHaveBeenCalled();
    expect(recordMetric).toHaveBeenCalledWith('invitation.removed');
  });

  it('PUT returns 401 for unauthenticated accept invitation', async () => {
    (getInvitation as jest.Mock).mockResolvedValueOnce({
      token: 'tok',
      expires: new Date().toISOString(),
      sentViaEmail: false,
      allowedDomains: ['corp.com'],
      team: { id: 'team-1' },
      role: 'MEMBER',
    });
    (getSession as jest.Mock).mockResolvedValueOnce(null);
    const res = createRes();
    await handler({ method: 'PUT', body: { inviteToken: 'tok' } } as any, res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: { message: 'You must be logged in to accept this invitation.' } });
    expect(addTeamMember).not.toHaveBeenCalled();
  });

  it('PUT returns 401 for missing session user fields', async () => {
    (getInvitation as jest.Mock).mockResolvedValueOnce({
      token: 'tok',
      expires: new Date().toISOString(),
      sentViaEmail: false,
      allowedDomains: ['corp.com'],
      team: { id: 'team-1' },
      role: 'MEMBER',
    });
    (getSession as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-2' } });
    const res = createRes();
    await handler({ method: 'PUT', body: { inviteToken: 'tok' } } as any, res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: { message: 'You must be logged in to accept this invitation.' } });
    expect(extractEmailDomain).not.toHaveBeenCalled();
    expect(addTeamMember).not.toHaveBeenCalled();
  });


  it('PUT accepts invitation', async () => {
    (getInvitation as jest.Mock).mockResolvedValueOnce({
      token: 'tok',
      expires: new Date().toISOString(),
      sentViaEmail: false,
      allowedDomains: ['corp.com'],
      team: { id: 'team-1' },
      role: 'MEMBER',
    });
    (addTeamMember as jest.Mock).mockResolvedValueOnce({ id: 'tm-1' });
    const res = createRes();
    await handler({ method: 'PUT', body: { inviteToken: 'tok' } } as any, res);
    expect(res.statusCode).toBe(204);
    expect(sendEvent).toHaveBeenCalledWith('team-1', 'member.created', { id: 'tm-1' });
    expect(recordMetric).toHaveBeenCalledWith('member.created');
  });
});
