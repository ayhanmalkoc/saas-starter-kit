import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('next/dist/server/api-utils', () => ({
  ApiError: class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

jest.mock('@/lib/auth', () => ({
  hashPassword: jest.fn(async (password: string) => `hashed-${password}`),
}));

jest.mock('@/lib/metrics', () => ({
  recordMetric: jest.fn(),
}));

jest.mock('@/lib/accountLock', () => ({
  unlockAccount: jest.fn(),
}));

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: {
    nextAuth: {
      sessionStrategy: 'database',
    },
  },
}));

jest.mock('models/user', () => ({
  updateUser: jest.fn(),
}));

jest.mock('models/passwordReset', () => ({
  deletePasswordReset: jest.fn(),
  getPasswordReset: jest.fn(),
}));

jest.mock('models/session', () => ({
  deleteManySessions: jest.fn(),
}));

jest.mock('@/lib/zod', () => ({
  resetPasswordSchema: {},
  validateWithSchema: jest.fn((_schema: unknown, body: unknown) => body),
}));

import handler from '@/pages/api/auth/reset-password';
import { getPasswordReset, deletePasswordReset } from 'models/passwordReset';
import { updateUser } from 'models/user';
import { deleteManySessions } from 'models/session';
import { unlockAccount } from '@/lib/accountLock';
import { recordMetric } from '@/lib/metrics';
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

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getPasswordReset as jest.Mock).mockResolvedValue({
      token: 'token-1',
      email: 'user@example.com',
      expiresAt: new Date(Date.now() + 1000 * 60),
    });
    (updateUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });
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

    const req = { method: 'POST', body: { token: '' } } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: { message: 'Invalid payload' } });
  });

  it('updates password and clears side effects on success', async () => {
    const req = {
      method: 'POST',
      body: { token: 'token-1', password: 'new-password' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
      data: { password: 'hashed-new-password' },
    });
    expect(unlockAccount).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' })
    );
    expect(deleteManySessions).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(deletePasswordReset).toHaveBeenCalledWith('token-1');
    expect(recordMetric).toHaveBeenCalledWith('user.password.reset');
  });

  it('returns error for invalid/reused token', async () => {
    (getPasswordReset as jest.Mock).mockResolvedValueOnce(null);

    const req = {
      method: 'POST',
      body: { token: 'invalid-token', password: 'new-password' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(deletePasswordReset).not.toHaveBeenCalled();
  });

  it('returns error for expired token', async () => {
    (getPasswordReset as jest.Mock).mockResolvedValueOnce({
      token: 'expired-token',
      email: 'user@example.com',
      expiresAt: new Date(Date.now() - 1000),
    });

    const req = {
      method: 'POST',
      body: { token: 'expired-token', password: 'new-password' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('returns error when user update fails', async () => {
    (updateUser as jest.Mock).mockResolvedValueOnce(null);

    const req = {
      method: 'POST',
      body: { token: 'token-1', password: 'new-password' },
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(deletePasswordReset).not.toHaveBeenCalled();
  });
});
