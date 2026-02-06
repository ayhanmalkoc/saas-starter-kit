import type { NextApiResponse } from 'next';

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: {
    teamFeatures: {
      sso: false,
      dsync: false,
    },
  },
}));

jest.mock('@/lib/jackson', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/lib/jackson/dsyncEvents', () => ({
  __esModule: true,
  handleEvents: jest.fn(),
}));

import jackson from '@/lib/jackson';
import oauthAuthorizeHandler from '@/pages/api/oauth/authorize';
import scimDirectoryHandler from '@/pages/api/scim/v2.0/[...directory]';

const jacksonMock = jackson as jest.Mock;

const createRes = () => {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status: jest.fn(function (this: NextApiResponse, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function (this: NextApiResponse, payload: unknown) {
      this.body = payload;
      return this;
    }),
  } as unknown as NextApiResponse;

  return res;
};

describe('API feature flags early return', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 and does not call jackson in /api/oauth/authorize when SSO is disabled', async () => {
    const req = {
      method: 'GET',
      query: {},
      body: {},
    } as any;
    const res = createRes();

    await oauthAuthorizeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Not Found' } });
    expect(jacksonMock).not.toHaveBeenCalled();
  });

  it('returns 404 and does not call jackson in /api/scim/v2.0/[...directory] when DSync is disabled', async () => {
    const req = {
      method: 'GET',
      query: { directory: ['directory-id', 'Users'] },
      body: null,
      headers: {},
    } as any;
    const res = createRes();

    await scimDirectoryHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Not Found' } });
    expect(jacksonMock).not.toHaveBeenCalled();
  });
});
