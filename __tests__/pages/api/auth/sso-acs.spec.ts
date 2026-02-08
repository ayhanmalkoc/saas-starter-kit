import type { NextApiRequest, NextApiResponse } from 'next';

const proxyHandler = jest.fn();

jest.mock('@/pages/api/oauth/saml', () => ({
  __esModule: true,
  default: (...args: unknown[]) => proxyHandler(...args),
}));

import handler from '@/pages/api/auth/sso/acs';

const createRes = () => {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as unknown as NextApiResponse;

  return res;
};

describe('/api/auth/sso/acs proxy handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards GET requests to legacy proxy target', async () => {
    const req = { method: 'GET' } as NextApiRequest;
    const res = createRes();
    proxyHandler.mockResolvedValueOnce(undefined);

    await handler(req, res);

    expect(proxyHandler).toHaveBeenCalledWith(req, res);
  });

  it('forwards POST requests and allows downstream validation', async () => {
    const req = {
      method: 'POST',
      body: { SAMLResponse: 'saml' },
    } as NextApiRequest;
    const res = createRes();
    proxyHandler.mockImplementationOnce(async (_req, response) => {
      response.status(400).json({ error: 'Invalid token' });
    });

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid token' });
  });

  it('returns success when downstream SSO ACS flow succeeds', async () => {
    const req = {
      method: 'POST',
      body: { SAMLResponse: 'valid' },
    } as NextApiRequest;
    const res = createRes();
    proxyHandler.mockImplementationOnce(async (_req, response) => {
      response.status(200).json({ success: true });
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});
