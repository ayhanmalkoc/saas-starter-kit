import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: {
    jackson: {
      productId: 'product-1',
    },
  },
}));

jest.mock('@/lib/jackson/sso', () => {
  const getConnections = jest.fn();

  return {
    ssoManager: jest.fn(() => ({
      getConnections,
    })),
    __mock: {
      getConnections,
    },
  };
});

jest.mock('@/lib/zod', () => ({
  ssoVerifySchema: {},
  validateWithSchema: jest.fn((_schema: unknown, body: unknown) => body),
}));

jest.mock('models/team', () => ({
  getTeam: jest.fn(),
  getTeams: jest.fn(),
}));

jest.mock('models/user', () => ({
  getUser: jest.fn(),
}));

import handler from '@/pages/api/auth/sso/verify';
import { validateWithSchema } from '@/lib/zod';
import { getTeam, getTeams } from 'models/team';
import { getUser } from 'models/user';
import { __mock as ssoMock } from '@/lib/jackson/sso';

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

describe('POST /api/auth/sso/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ssoMock.getConnections.mockResolvedValue([{ id: 'conn-1' }]);
  });

  it('returns 405 for method mismatch', async () => {
    const req = { method: 'GET' } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('POST');
  });

  it('returns zod validation error for invalid payload', async () => {
    (validateWithSchema as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Invalid payload');
    });

    const req = { method: 'POST', body: JSON.stringify({}) } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { message: 'Invalid payload' } });
  });

  it('returns teamId when slug-based verification succeeds', async () => {
    (getTeam as jest.Mock).mockResolvedValueOnce({ id: 'team-1', slug: 'acme' });

    const req = {
      method: 'POST',
      body: JSON.stringify({ slug: 'acme' }),
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(ssoMock.getConnections).toHaveBeenCalledWith({
      tenant: 'team-1',
      product: 'product-1',
    });
    expect(res.body).toEqual({ data: { teamId: 'team-1' } });
  });

  it('returns error when token/email based user is not found', async () => {
    (getUser as jest.Mock).mockResolvedValueOnce(null);

    const req = {
      method: 'POST',
      body: JSON.stringify({ email: 'missing@example.com' }),
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { message: 'User not found.' } });
  });

  it('returns useSlug=true when multiple teams have SSO configured', async () => {
    (getUser as jest.Mock).mockResolvedValueOnce({ id: 'user-1' });
    (getTeams as jest.Mock).mockResolvedValueOnce([
      { id: 'team-1', slug: 'one' },
      { id: 'team-2', slug: 'two' },
    ]);
    ssoMock.getConnections.mockResolvedValue([{ id: 'conn-1' }]);

    const req = {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com' }),
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: { useSlug: true } });
  });

  it('returns error when no SSO connections exist (invalid/expired link state)', async () => {
    (getTeam as jest.Mock).mockResolvedValueOnce({ id: 'team-1', slug: 'acme' });
    ssoMock.getConnections.mockResolvedValueOnce([]);

    const req = {
      method: 'POST',
      body: JSON.stringify({ slug: 'acme' }),
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: { message: 'No SSO connections found for this team.' },
    });
  });
});
