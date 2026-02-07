import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/auth', () => ({
  hashPassword: jest.fn(async (password: string) => `hashed-${password}`),
}));

jest.mock('@/lib/server-common', () => ({
  slugify: jest.fn((value: string) => value.toLowerCase().replace(/\s+/g, '-')),
}));

jest.mock('@/lib/email/sendVerificationEmail', () => ({
  sendVerificationEmail: jest.fn(),
}));

jest.mock('@/lib/email/utils', () => ({
  isEmailAllowed: jest.fn(() => true),
}));

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: {
    confirmEmail: true,
  },
}));

jest.mock('models/team', () => ({
  createTeam: jest.fn(),
  getTeam: jest.fn(),
  isTeamExists: jest.fn(() => 0),
}));

jest.mock('models/user', () => ({
  createUser: jest.fn(),
  getUser: jest.fn(),
}));

jest.mock('@/lib/metrics', () => ({
  recordMetric: jest.fn(),
}));

jest.mock('models/invitation', () => ({
  getInvitation: jest.fn(),
  isInvitationExpired: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/lib/recaptcha', () => ({
  validateRecaptcha: jest.fn(),
}));

const alertMock = jest.fn();
jest.mock('@/lib/slack', () => ({
  slackNotify: jest.fn(() => ({ alert: alertMock })),
}));

jest.mock('models/verificationToken', () => ({
  createVerificationToken: jest.fn(),
}));

jest.mock('@/lib/zod', () => ({
  userJoinSchema: {},
  validateWithSchema: jest.fn((_schema: unknown, body: unknown) => body),
}));

import handler from '@/pages/api/auth/join';
import { createTeam } from 'models/team';
import { createUser, getUser } from 'models/user';
import { createVerificationToken } from 'models/verificationToken';
import { sendVerificationEmail } from '@/lib/email/sendVerificationEmail';
import { recordMetric } from '@/lib/metrics';
import { getInvitation, isInvitationExpired } from 'models/invitation';
import { validateWithSchema } from '@/lib/zod';

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

describe('POST /api/auth/join', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUser as jest.Mock).mockResolvedValue(null);
    (createUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
      emailVerified: null,
    });
    (createTeam as jest.Mock).mockResolvedValue({ id: 'team-1', name: 'Acme' });
    (createVerificationToken as jest.Mock).mockResolvedValue({ token: 'verify-token' });
    (getInvitation as jest.Mock).mockResolvedValue(null);
  });

  it('returns 405 for method mismatch', async () => {
    const req = { method: 'GET' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('POST');
  });

  it('returns validation error for invalid payload', async () => {
    (validateWithSchema as jest.Mock).mockImplementationOnce(() => {
      throw { status: 422, message: 'Invalid input' };
    });

    const req = {
      method: 'POST',
      body: { name: '', email: 'not-email' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: { message: 'Invalid input' } });
  });

  it('creates user/team and sends verification email on success', async () => {
    const req = {
      method: 'POST',
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
        team: 'Acme',
        recaptchaToken: 'captcha-token',
      },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'john@example.com', name: 'John Doe' })
    );
    expect(createTeam).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Acme',
      slug: 'acme',
    });
    expect(createVerificationToken).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'john@example.com' })
    );
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-1' }),
      })
    );
    expect(recordMetric).toHaveBeenCalledWith('user.signup');
    expect(alertMock).toHaveBeenCalled();
  });

  it('returns error when invitation token is expired', async () => {
    (getInvitation as jest.Mock).mockResolvedValueOnce({
      token: 'invite-token',
      expires: new Date(),
      sentViaEmail: true,
      email: 'invited@example.com',
      team: { slug: 'inv-team' },
    });
    (isInvitationExpired as jest.Mock).mockResolvedValueOnce(true);

    const req = {
      method: 'POST',
      body: {
        name: 'Invitee',
        email: 'invited@example.com',
        password: 'secret123',
        inviteToken: 'invite-token',
        recaptchaToken: 'captcha-token',
      },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: { message: 'Invitation expired. Please request a new one.' },
    });
  });

  it('returns error when user already exists', async () => {
    (getUser as jest.Mock).mockResolvedValueOnce({ id: 'existing-user' });

    const req = {
      method: 'POST',
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
        team: 'Acme',
        recaptchaToken: 'captcha-token',
      },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});
