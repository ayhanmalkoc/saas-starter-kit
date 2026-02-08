import type { NextApiResponse } from 'next';

const mockScimHandle = jest.fn();

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: {
    teamFeatures: {
      dsync: true,
    },
  },
}));

jest.mock('@/lib/jackson', () => ({
  __esModule: true,
  default: jest.fn(async () => ({
    directorySync: {
      requests: {
        handle: mockScimHandle,
      },
    },
  })),
}));

jest.mock('@/lib/jackson/dsyncEvents', () => ({
  __esModule: true,
  handleEvents: jest.fn(),
}));

import handler from '@/pages/api/scim/v2.0/[...directory]';
import jackson from '@/lib/jackson';
import env from '@/lib/env';

const jacksonMock = jackson as jest.Mock;

const createRes = () => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
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

describe('/api/scim/v2.0/[...directory]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (env as any).teamFeatures.dsync = true;

    mockScimHandle.mockImplementation(async (request) => {
      if (!request.apiSecret) {
        return { status: 401, data: { error: { message: 'Unauthorized' } } };
      }

      if (request.apiSecret !== 'valid-token') {
        return { status: 401, data: { error: { message: 'Invalid token' } } };
      }

      return {
        status: 200,
        data: {
          ok: true,
          directoryId: request.directoryId,
          resourceType: request.resourceType,
          resourceId: request.resourceId,
        },
      };
    });
  });

  it('returns 404 and skips jackson when DSync feature is disabled', async () => {
    (env as any).teamFeatures.dsync = false;

    const req = {
      method: 'GET',
      query: { directory: ['dir-1', 'Users'] },
      body: undefined,
      headers: {},
    } as any;
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Not Found' } });
    expect(jacksonMock).not.toHaveBeenCalled();
  });

  it('parses directory path and forwards expected request params to jackson', async () => {
    const req = {
      method: 'PATCH',
      query: {
        directory: ['directory-1', 'Users', 'user-1'],
        count: '10',
        startIndex: '3',
        filter: 'userName eq "alice@example.com"',
      },
      body: JSON.stringify({ active: true }),
      headers: { authorization: 'Bearer valid-token' },
    } as any;
    const res = createRes();

    await handler(req, res);

    expect(mockScimHandle).toHaveBeenCalledWith(
      {
        method: 'PATCH',
        body: { active: true },
        directoryId: 'directory-1',
        resourceId: 'user-1',
        resourceType: 'users',
        apiSecret: 'valid-token',
        query: {
          count: 10,
          startIndex: 3,
          filter: 'userName eq "alice@example.com"',
        },
      },
      expect.any(Function)
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      directoryId: 'directory-1',
      resourceType: 'users',
      resourceId: 'user-1',
    });
  });

  it('returns expected 401 contract when auth token is missing', async () => {
    const req = {
      method: 'GET',
      query: { directory: ['directory-2', 'Groups'] },
      body: undefined,
      headers: {},
    } as any;
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Unauthorized' },
    });
  });

  it('returns expected 401 contract when auth token is invalid', async () => {
    const req = {
      method: 'GET',
      query: { directory: ['directory-3', 'Groups', 'group-9'] },
      body: undefined,
      headers: { authorization: 'Bearer invalid-token' },
    } as any;
    const res = createRes();

    await handler(req, res);

    expect(mockScimHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        directoryId: 'directory-3',
        resourceType: 'groups',
        resourceId: 'group-9',
        apiSecret: 'invalid-token',
      }),
      expect.any(Function)
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Invalid token' },
    });
  });
});
