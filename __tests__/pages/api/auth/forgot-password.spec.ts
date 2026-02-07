import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/server-common', () => ({
  generateToken: jest.fn(() => 'mock-reset-token'),
  validateEmail: jest.fn(() => true),
}));

jest.mock('@/lib/email/sendPasswordResetEmail', () => ({
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock('@/lib/metrics', () => ({
  recordMetric: jest.fn(),
}));

jest.mock('@/lib/recaptcha', () => ({
  validateRecaptcha: jest.fn(),
}));

jest.mock('models/user', () => ({
  getUser: jest.fn(),
}));

jest.mock('models/passwordReset', () => ({
  createPasswordReset: jest.fn(),
}));

jest.mock('@/lib/zod', () => ({
  forgotPasswordSchema: {},
  validateWithSchema: jest.fn((_: unknown, body: unknown) => body),
}));

import handler from '@/pages/api/auth/forgot-password';
import { getUser } from 'models/user';
import { createPasswordReset } from 'models/passwordReset';
import { sendPasswordResetEmail } from '@/lib/email/sendPasswordResetEmail';

const SUCCESS_MESSAGE =
  'If an account exists for this e-mail, password reset instructions have been sent.';

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

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns same success response for existing and non-existing email', async () => {
    const req = {
      method: 'POST',
      body: { email: 'user@example.com', recaptchaToken: 'captcha-token' },
    } as NextApiRequest;

    (getUser as jest.Mock).mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
    });

    const resForExistingUser = createRes();
    await handler(req, resForExistingUser);

    (getUser as jest.Mock).mockResolvedValueOnce(null);

    const resForMissingUser = createRes();
    await handler(req, resForMissingUser);

    expect(resForExistingUser.statusCode).toBe(200);
    expect(resForExistingUser.body).toEqual({ message: SUCCESS_MESSAGE });
    expect(resForMissingUser.statusCode).toBe(200);
    expect(resForMissingUser.body).toEqual({ message: SUCCESS_MESSAGE });
  });

  it('does not create reset record or send email when user does not exist', async () => {
    const req = {
      method: 'POST',
      body: { email: 'missing@example.com', recaptchaToken: 'captcha-token' },
    } as NextApiRequest;

    (getUser as jest.Mock).mockResolvedValueOnce(null);

    const res = createRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: SUCCESS_MESSAGE });
    expect(createPasswordReset).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
