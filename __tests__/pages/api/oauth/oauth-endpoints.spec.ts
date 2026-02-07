import type { NextApiResponse } from 'next';

const authorizeMock = jest.fn();
const tokenMock = jest.fn();
const userInfoMock = jest.fn();
const samlResponseMock = jest.fn();

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: {
    teamFeatures: {
      sso: true,
    },
  },
}));


jest.mock('@/lib/jackson', () => ({
  __esModule: true,
  default: jest.fn(async () => ({
    oauthController: {
      authorize: authorizeMock,
      token: tokenMock,
      userInfo: userInfoMock,
      samlResponse: samlResponseMock,
    },
  })),
}));

import authorizeHandler from '@/pages/api/oauth/authorize';
import tokenHandler from '@/pages/api/oauth/token';
import userinfoHandler from '@/pages/api/oauth/userinfo';
import samlHandler from '@/pages/api/oauth/saml';
import jackson from '@/lib/jackson';
import env from '@/lib/env';

const jacksonMock = jackson as jest.Mock;

const createRes = () => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    redirectedTo: undefined as string | undefined,
    status: jest.fn(function (this: NextApiResponse, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function (this: NextApiResponse, payload: unknown) {
      this.body = payload;
      return this;
    }),
    setHeader: jest.fn(function (
      this: NextApiResponse,
      key: string,
      value: string
    ) {
      (this as any).headers[key] = value;
      return this;
    }),
    send: jest.fn(function (this: NextApiResponse, payload: unknown) {
      this.body = payload;
      return this;
    }),
    redirect: jest.fn(function (
      this: NextApiResponse,
      code: number,
      destination: string
    ) {
      this.statusCode = code;
      (this as any).redirectedTo = destination;
      return this;
    }),
  } as unknown as NextApiResponse;

  return res;
};

describe('OAuth API endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (env as any).teamFeatures.sso = true;
  });

  it('returns 404 for /api/oauth/authorize when team feature is disabled', async () => {
    (env as any).teamFeatures.sso = false;
    const req = { method: 'GET', query: {}, body: {} } as any;
    const res = createRes();

    await authorizeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Not Found' } });
    expect(jacksonMock).not.toHaveBeenCalled();
  });

  it('forwards GET query params to oauthController.authorize', async () => {
    authorizeMock.mockResolvedValueOnce({
      redirect_url: 'https://app.example/callback',
    });

    const req = {
      method: 'GET',
      query: { client_id: 'client-1', scope: 'openid profile' },
      body: {},
    } as any;
    const res = createRes();

    await authorizeHandler(req, res);

    expect(authorizeMock).toHaveBeenCalledWith({
      client_id: 'client-1',
      scope: 'openid profile',
    });
    expect(res.redirect).toHaveBeenCalledWith(302, 'https://app.example/callback');
  });

  it('forwards POST body to oauthController.authorize and sends form response', async () => {
    authorizeMock.mockResolvedValueOnce({
      authorize_form: '<html>authorize</html>',
    });

    const req = {
      method: 'POST',
      body: { client_id: 'client-2', redirect_uri: 'https://app/cb' },
      query: {},
    } as any;
    const res = createRes();

    await authorizeHandler(req, res);

    expect(authorizeMock).toHaveBeenCalledWith({
      client_id: 'client-2',
      redirect_uri: 'https://app/cb',
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/html; charset=utf-8'
    );
    expect(res.send).toHaveBeenCalledWith('<html>authorize</html>');
  });

  it('forwards POST body to oauthController.token and returns token json', async () => {
    tokenMock.mockResolvedValueOnce({ access_token: 'token-1', token_type: 'bearer' });

    const req = { method: 'POST', body: { code: 'auth-code' } } as any;
    const res = createRes();

    await tokenHandler(req, res);

    expect(tokenMock).toHaveBeenCalledWith({ code: 'auth-code' });
    expect(res.json).toHaveBeenCalledWith({
      access_token: 'token-1',
      token_type: 'bearer',
    });
  });

  it('returns expected 401 contract for /api/oauth/userinfo when token is missing', async () => {
    const req = { method: 'GET', headers: {}, query: {} } as any;
    const res = createRes();

    await userinfoHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Unauthorized' } });
    expect(userInfoMock).not.toHaveBeenCalled();
  });

  it('uses bearer token from authorization header for oauthController.userInfo', async () => {
    userInfoMock.mockResolvedValueOnce({ sub: 'user-1' });

    const req = {
      method: 'GET',
      headers: { authorization: 'Bearer header-token' },
      query: { access_token: 'query-token' },
    } as any;
    const res = createRes();

    await userinfoHandler(req, res);

    expect(userInfoMock).toHaveBeenCalledWith('header-token');
    expect(res.json).toHaveBeenCalledWith({ sub: 'user-1' });
  });

  it('falls back to access_token query for oauthController.userInfo', async () => {
    userInfoMock.mockResolvedValueOnce({ sub: 'user-2' });

    const req = {
      method: 'GET',
      headers: {},
      query: { access_token: 'query-token' },
    } as any;
    const res = createRes();

    await userinfoHandler(req, res);

    expect(userInfoMock).toHaveBeenCalledWith('query-token');
    expect(res.json).toHaveBeenCalledWith({ sub: 'user-2' });
  });

  it('forwards RelayState and SAMLResponse to oauthController.samlResponse', async () => {
    samlResponseMock.mockResolvedValueOnce({
      redirect_url: 'https://app.example/post-saml',
    });

    const req = {
      method: 'POST',
      body: { RelayState: 'relay-1', SAMLResponse: 'encoded-saml' },
    } as any;
    const res = createRes();

    await samlHandler(req, res);

    expect(samlResponseMock).toHaveBeenCalledWith({
      RelayState: 'relay-1',
      SAMLResponse: 'encoded-saml',
    });
    expect(res.redirect).toHaveBeenCalledWith(302, 'https://app.example/post-saml');
  });

  it('returns expected error contract when SAML redirect is missing', async () => {
    samlResponseMock.mockResolvedValueOnce({ redirect_url: '' });

    const req = {
      method: 'POST',
      body: { RelayState: 'relay-2', SAMLResponse: 'encoded-saml' },
    } as any;
    const res = createRes();

    await samlHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'No redirect URL found.' },
    });
  });
});
