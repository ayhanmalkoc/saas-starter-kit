import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/nextAuth', () => ({
  getAuthOptions: jest.fn(() => ({})),
  sessionTokenCookieName: 'next-auth.session-token',
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    session: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('cookies-next', () => ({
  getCookie: jest.fn(),
}));

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: {
    nextAuth: {
      sessionStrategy: 'database',
    },
  },
}));

jest.mock('models/session', () => ({
  deleteSession: jest.fn(),
}));

import handler from '@/pages/api/auth/custom-signout';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { getCookie } from 'cookies-next';
import { deleteSession } from 'models/session';

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

describe('POST /api/auth/custom-signout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });
    (getCookie as jest.Mock).mockResolvedValue('session-token');
    (prisma.session.findFirst as jest.Mock).mockResolvedValue({
      sessionToken: 'session-token',
    });
  });

  it('returns 405 for method mismatch', async () => {
    const req = { method: 'GET' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
  });

  it('returns 401 when user is not authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce(null);

    const req = { method: 'POST' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('deletes database session and clears cookie on success', async () => {
    const req = { method: 'POST' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(prisma.session.findFirst).toHaveBeenCalledWith({
      where: { sessionToken: 'session-token' },
    });
    expect(deleteSession).toHaveBeenCalledWith({
      where: { sessionToken: 'session-token' },
    });
    expect(res.headers['Set-Cookie']).toContain('next-auth.session-token=;');
  });

  it('handles invalid/non-existing session token without deletion', async () => {
    (prisma.session.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const req = { method: 'POST' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(deleteSession).not.toHaveBeenCalled();
  });
});
