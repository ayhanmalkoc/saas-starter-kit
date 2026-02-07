import type { NextApiRequest, NextApiResponse } from 'next';

const samlHandlerMock = jest.fn();

jest.mock('@/pages/api/oauth/saml', () => ({
  __esModule: true,
  default: (...args: unknown[]) => samlHandlerMock(...args),
}));

import handler from '@/pages/api/auth/sso/acs';

const createRes = () => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
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

describe('/api/auth/sso/acs legacy proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards RelayState and SAMLResponse payload to /api/oauth/saml', async () => {
    const req = {
      method: 'POST',
      body: { RelayState: 'relay-state', SAMLResponse: 'saml-response' },
    } as NextApiRequest;
    const res = createRes();

    samlHandlerMock.mockResolvedValueOnce(undefined);

    await handler(req, res);

    expect(samlHandlerMock).toHaveBeenCalledWith(req, res);
    expect((samlHandlerMock.mock.calls[0][0] as NextApiRequest).body).toEqual({
      RelayState: 'relay-state',
      SAMLResponse: 'saml-response',
    });
  });

  it('preserves downstream error status and message contract', async () => {
    const req = { method: 'POST', body: { SAMLResponse: 'invalid' } } as NextApiRequest;
    const res = createRes();

    samlHandlerMock.mockImplementationOnce(async (_req, response: NextApiResponse) => {
      response.status(400).json({ error: { message: 'Invalid SAML response' } });
    });

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { message: 'Invalid SAML response' } });
  });
});
