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

jest.mock('models/project', () => ({
  getProjectBySlug: jest.fn(),
  getProjectsByUserId: jest.fn(),
}));

jest.mock('models/user', () => ({
  getUser: jest.fn(),
}));

import handler from '@/pages/api/auth/sso/verify';
import { validateWithSchema } from '@/lib/zod';
import { getProjectBySlug, getProjectsByUserId } from 'models/project';
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

  it('returns validation error for invalid payload', async () => {
    (validateWithSchema as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Invalid payload');
    });

    const req = { method: 'POST', body: JSON.stringify({}) } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { message: 'Invalid payload' } });
  });

  it('returns projectId when slug-based verification succeeds', async () => {
    (getProjectBySlug as jest.Mock).mockResolvedValueOnce({
      id: 'project-1',
      slug: 'acme',
    });

    const req = {
      method: 'POST',
      body: JSON.stringify({ projectSlug: 'acme' }),
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(ssoMock.getConnections).toHaveBeenCalledWith({
      tenant: 'project-1',
      product: 'product-1',
    });
    expect(res.body).toEqual({ data: { projectId: 'project-1' } });
  });

  it('returns useProjectSlug=true when multiple projects have SSO configured', async () => {
    (getUser as jest.Mock).mockResolvedValueOnce({ id: 'user-1' });
    (getProjectsByUserId as jest.Mock).mockResolvedValueOnce([
      { id: 'project-1', slug: 'one' },
      { id: 'project-2', slug: 'two' },
    ]);

    const req = {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com' }),
    } as NextApiRequest;
    const res = createRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: { useProjectSlug: true } });
  });
});
