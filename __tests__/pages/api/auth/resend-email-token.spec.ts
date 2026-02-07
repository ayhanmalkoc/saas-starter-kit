import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/email/sendVerificationEmail', () => ({
  sendVerificationEmail: jest.fn(),
}));

jest.mock('models/user', () => ({
  getUser: jest.fn(),
}));

jest.mock('models/verificationToken', () => ({
  createVerificationToken: jest.fn(),
}));

jest.mock('@/lib/zod', () => ({
  resendEmailToken: {},
  validateWithSchema: jest.fn((_schema: unknown, body: unknown) => body),
}));

import handler from '@/pages/api/auth/resend-email-token';
import { getUser } from 'models/user';
import { createVerificationToken } from 'models/verificationToken';
import { sendVerificationEmail } from '@/lib/email/sendVerificationEmail';
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

describe('POST /api/auth/resend-email-token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'John',
    });
    (createVerificationToken as jest.Mock).mockResolvedValue({ token: 'new-token' });
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
      throw { status: 422, message: 'Invalid email' };
    });

    const req = { method: 'POST', body: { email: 'bad-email' } } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
  });

  it('creates token and sends verification email on success', async () => {
    const req = {
      method: 'POST',
      body: { email: 'user@example.com' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(createVerificationToken).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'user@example.com' })
    );
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      user: expect.objectContaining({ id: 'user-1' }),
      verificationToken: expect.objectContaining({ token: 'new-token' }),
    });
  });

  it('returns error when user is not found', async () => {
    (getUser as jest.Mock).mockResolvedValueOnce(null);

    const req = {
      method: 'POST',
      body: { email: 'missing@example.com' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(createVerificationToken).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});
