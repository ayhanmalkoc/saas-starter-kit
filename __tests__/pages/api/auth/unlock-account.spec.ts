import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('models/user', () => ({
  getUser: jest.fn(),
}));

jest.mock('models/verificationToken', () => ({
  deleteVerificationToken: jest.fn(),
}));

jest.mock('@/lib/accountLock', () => ({
  isAccountLocked: jest.fn(() => true),
  sendLockoutEmail: jest.fn(),
}));

jest.mock('@/lib/zod', () => ({
  resendLinkRequestSchema: {},
  validateWithSchema: jest.fn((_schema: unknown, body: unknown) => body),
}));

import handler from '@/pages/api/auth/unlock-account';
import { getUser } from 'models/user';
import { deleteVerificationToken } from 'models/verificationToken';
import { isAccountLocked, sendLockoutEmail } from '@/lib/accountLock';
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
    end: jest.fn(),
  } as unknown as NextApiResponse;

  return res;
};

describe('POST /api/auth/unlock-account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUser as jest.Mock).mockResolvedValue({ id: 'user-1', email: 'locked@example.com' });
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
      throw { status: 422, message: 'Invalid payload' };
    });

    const req = { method: 'POST', body: {} } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
  });

  it('deletes token and sends lockout mail on success', async () => {
    const req = {
      method: 'POST',
      body: { email: 'locked@example.com', expiredToken: 'old-token' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(204);
    expect(deleteVerificationToken).toHaveBeenCalledWith('old-token');
    expect(sendLockoutEmail).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      true
    );
  });

  it('returns error when user is not found', async () => {
    (getUser as jest.Mock).mockResolvedValueOnce(null);

    const req = {
      method: 'POST',
      body: { email: 'missing@example.com', expiredToken: 'token' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(deleteVerificationToken).not.toHaveBeenCalled();
  });

  it('returns error when account is already active', async () => {
    (isAccountLocked as jest.Mock).mockReturnValueOnce(false);

    const req = {
      method: 'POST',
      body: { email: 'active@example.com', expiredToken: 'token' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(sendLockoutEmail).not.toHaveBeenCalled();
  });
});
