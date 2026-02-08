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
    nextUrl: { pathname: '/dashboard', origin: 'https://example.com' },
    url: 'https://example.com/dashboard',
    headers: new Headers(),
  } as any;

  const unauthenticatedRequest = {
    nextUrl: { pathname: '/auth/login', origin: 'https://example.com' },
    url: 'https://example.com/auth/login',
    headers: new Headers(),
  } as any;

  const loadMiddleware = ({
    securityHeadersEnabled,
    nodeEnv,
  }: {
    securityHeadersEnabled?: string;
    nodeEnv?: string;
  }) => {
    if (securityHeadersEnabled === undefined) {
      delete process.env.SECURITY_HEADERS_ENABLED;
    } else {
      process.env.SECURITY_HEADERS_ENABLED = securityHeadersEnabled;
    }

    if (nodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnv;
    }

    process.env.DATABASE_URL = 'postgres://localhost:5432/app';
    process.env.APP_URL = 'https://example.com';
    process.env.NEXTAUTH_SECRET = 'test-secret';
    process.env.NEXTAUTH_SESSION_STRATEGY = 'jwt';

    let middleware: typeof import('../middleware').default;

    jest.isolateModules(() => {
      const jwt = jest.requireMock('next-auth/jwt');
      jwt.getToken.mockResolvedValue({ sub: 'user-id' });
      middleware = jest.requireActual('../middleware').default;
    });

    return middleware!;
  };

  afterEach(() => {
    delete process.env.SECURITY_HEADERS_ENABLED;
    delete process.env.DATABASE_URL;
    delete process.env.APP_URL;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_SESSION_STRATEGY;
    delete process.env.NODE_ENV;
    jest.clearAllMocks();
  });

  it('sets critical security headers in production when env is undefined', async () => {
    const middleware = loadMiddleware({
      securityHeadersEnabled: undefined,
      nodeEnv: 'production',
    });
    const response = await middleware(baseRequest);

    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'"
    );
  });

  it('always sets CSP and report headers in production', async () => {
    const middleware = loadMiddleware({
      securityHeadersEnabled: 'false',
      nodeEnv: 'production',
    });
    const response = await middleware(baseRequest);

    expect(response.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'"
    );
    expect(response.headers.get('Report-To')).toContain('csp-endpoint');
  });

  it('sets security headers with nonce-based CSP when enabled', async () => {
    const middleware = loadMiddleware({
      securityHeadersEnabled: 'true',
      nodeEnv: 'production',
    });
    const response = await middleware(baseRequest);
    const csp = response.headers.get('Content-Security-Policy')!;

    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain('report-uri /api/security/csp-report');
    expect(response.headers.get('Report-To')).toContain('csp-endpoint');
    expect(response.headers.get('x-nonce')).toBeNull();
  });

  it('keeps unsafe-eval only in development mode', async () => {
    const middleware = loadMiddleware({
      securityHeadersEnabled: 'true',
      nodeEnv: 'development',
    });
    const response = await middleware(baseRequest);

    expect(response.headers.get('Content-Security-Policy')).toContain(
      "'unsafe-eval'"
    );
  });

  it('sets CSP headers for unauthenticated routes too when enabled', async () => {
    const middleware = loadMiddleware({
      securityHeadersEnabled: 'true',
      nodeEnv: 'production',
    });

    const response = await middleware(unauthenticatedRequest);

    expect(response.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'"
    );
    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin'
    );
  });

  it('still sets critical security headers in production when env is "false"', async () => {
    const middleware = loadMiddleware({
      securityHeadersEnabled: 'false',
      nodeEnv: 'production',
    });
    const response = await middleware(baseRequest);

    expect(response.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'"
    );
  });

  it('does not set optional security headers in development for unexpected env values', async () => {
    const middleware = loadMiddleware({
      securityHeadersEnabled: 'enabled',
      nodeEnv: 'development',
    });
    const response = await middleware(baseRequest);

    expect(response.headers.get('Referrer-Policy')).toBeNull();
    expect(response.headers.get('Content-Security-Policy')).toBeNull();
  });
});
