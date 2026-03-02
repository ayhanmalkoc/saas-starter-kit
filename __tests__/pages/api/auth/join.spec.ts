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

jest.mock('models/organization', () => ({
  createOrganizationWithDefaultProject: jest.fn(),
  getOrganizationBySlug: jest.fn(),
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
  validateWithSchema: jest.fn((_schema: unknown, payload: unknown) => payload),
}));

import handler from '@/pages/api/auth/join';
import {
  createOrganizationWithDefaultProject,
  getOrganizationBySlug,
} from 'models/organization';
import { createUser, getUser } from 'models/user';
import { createVerificationToken } from 'models/verificationToken';
import { sendVerificationEmail } from '@/lib/email/sendVerificationEmail';
import { recordMetric } from '@/lib/metrics';
import { getInvitation, isInvitationExpired } from 'models/invitation';

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
    (createOrganizationWithDefaultProject as jest.Mock).mockResolvedValue({
      organization: {
        id: 'org-1',
        name: 'Acme',
        slug: 'acme',
      },
      project: {
        id: 'project-1',
        slug: 'default',
      },
    });
    (createVerificationToken as jest.Mock).mockResolvedValue({
      token: 'verify-token',
    });
    (getInvitation as jest.Mock).mockResolvedValue(null);
    (getOrganizationBySlug as jest.Mock).mockResolvedValue(null);
  });

  it('returns 405 for method mismatch', async () => {
    const req = { method: 'GET' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('POST');
  });

  it('returns 400 when organization name is missing for direct signup', async () => {
    const req = {
      method: 'POST',
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
        recaptchaToken: 'captcha-token',
      },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: { message: 'An organization name is required.' },
    });
  });

  it('creates user + organization/project and sends verification email', async () => {
    const req = {
      method: 'POST',
      body: {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
        organizationName: 'Acme',
        recaptchaToken: 'captcha-token',
      },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(createOrganizationWithDefaultProject).toHaveBeenCalledWith({
      ownerUserId: 'user-1',
      organizationName: 'Acme',
      organizationSlug: 'acme',
    });
    expect(createVerificationToken).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'john@example.com' })
    );
    expect(sendVerificationEmail).toHaveBeenCalled();
    expect(recordMetric).toHaveBeenCalledWith('user.signup');
    expect(alertMock).toHaveBeenCalled();
  });

  it('returns 400 when invitation token is expired', async () => {
    (getInvitation as jest.Mock).mockResolvedValueOnce({
      token: 'invite-token',
      expires: new Date(),
      sentViaEmail: true,
      email: 'invited@example.com',
      project: {
        organization: {
          name: 'Invited Org',
        },
      },
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
});
