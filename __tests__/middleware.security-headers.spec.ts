jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}));

jest.mock('next/server', () => {
  class MockNextResponse {
    headers: Headers;

    constructor() {
      this.headers = new Headers();
    }

    static next() {
      return new MockNextResponse();
    }

    static redirect(url: URL) {
      const response = new MockNextResponse();
      response.headers.set('location', url.toString());
      return response;
    }
  }

  return {
    NextResponse: MockNextResponse,
  };
});

describe('middleware security headers flag', () => {
  const baseRequest = {
    nextUrl: { pathname: '/dashboard' },
    url: 'https://example.com/dashboard',
    headers: new Headers(),
  } as any;

  const loadMiddleware = (securityHeadersEnabled?: string) => {
    if (securityHeadersEnabled === undefined) {
      delete process.env.SECURITY_HEADERS_ENABLED;
    } else {
      process.env.SECURITY_HEADERS_ENABLED = securityHeadersEnabled;
    }

    process.env.NEXTAUTH_SESSION_STRATEGY = 'jwt';

    let middleware: typeof import('../middleware').default;

    jest.isolateModules(() => {
      const jwt = require('next-auth/jwt');
      jwt.getToken.mockResolvedValue({ sub: 'user-id' });
      middleware = require('../middleware').default;
    });

    return middleware!;
  };

  afterEach(() => {
    delete process.env.SECURITY_HEADERS_ENABLED;
    delete process.env.NEXTAUTH_SESSION_STRATEGY;
    jest.clearAllMocks();
  });

  it('does not set optional security headers when env is undefined', async () => {
    const middleware = loadMiddleware(undefined);
    const response = await middleware(baseRequest);

    expect(response.headers.get('Referrer-Policy')).toBeNull();
    expect(response.headers.get('Content-Security-Policy')).toBeNull();
  });

  it('sets security headers when env is "true"', async () => {
    const middleware = loadMiddleware('true');
    const response = await middleware(baseRequest);

    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'"
    );
  });

  it('does not set optional security headers when env is "false"', async () => {
    const middleware = loadMiddleware('false');
    const response = await middleware(baseRequest);

    expect(response.headers.get('Referrer-Policy')).toBeNull();
    expect(response.headers.get('Content-Security-Policy')).toBeNull();
  });

  it('does not set optional security headers for unexpected env values', async () => {
    const middleware = loadMiddleware('enabled');
    const response = await middleware(baseRequest);

    expect(response.headers.get('Referrer-Policy')).toBeNull();
    expect(response.headers.get('Content-Security-Policy')).toBeNull();
  });
});
