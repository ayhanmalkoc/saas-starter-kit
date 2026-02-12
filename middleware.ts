import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import env from './lib/env';
import { isUnAuthenticatedRoute } from './lib/middleware/route-match';

// Constants for security headers
// Disabling COEP/COOP reduces cross-origin isolation protection.
// Commenting out Cross-Origin-Embedder-Policy and Cross-Origin-Opener-Policy removes protection against Spectre-like side-channel attacks. These headers together enable cross-origin isolation (window.crossOriginIsolated).
// If this is intentional (e.g., to allow third-party resources without CORP headers), please document the rationale in a code comment. If not needed for compatibility, consider re-enabling these headers.

const isDevelopment = process.env.NODE_ENV === 'development';
const enableStrictCSP = process.env.ENABLE_CSP_STRICT === 'true';
const enableCOEP = process.env.ENABLE_COEP === 'true';

const SECURITY_HEADERS = {
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=()',
  'Cross-Origin-Resource-Policy': 'same-site',
  ...(enableCOEP
    ? {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      }
    : {}),
};

const generateNonce = (): string => {
  const nonce = new Uint8Array(16);
  crypto.getRandomValues(nonce);

  return btoa(String.fromCharCode(...Array.from(nonce)));
};

// Generate CSP
const generateCSP = (nonce: string): string => {
  const policies = {
    'default-src': ["'self'"],
    'img-src': [
      "'self'",
      'boxyhq.com',
      '*.boxyhq.com',
      '*.dicebear.com',
      'data:',
    ],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      ...(enableStrictCSP ? ["'strict-dynamic'"] : []),
      '*.gstatic.com',
      '*.google.com',
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'connect-src': [
      "'self'",
      '*.google.com',
      '*.gstatic.com',
      'boxyhq.com',
      '*.ingest.sentry.io',
      '*.mixpanel.com',
    ],
    'frame-src': ["'self'", '*.google.com', '*.gstatic.com'],
    'font-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'script-src-attr': ["'none'"],
    'report-uri': ['/api/security/csp-report'],
    'report-to': ['csp-endpoint'],
  };

  return Object.entries(policies)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .concat(enableStrictCSP ? ['upgrade-insecure-requests'] : [])
    .join('; ');
};

const applySecurityHeaders = (
  response: NextResponse,
  csp: string,
  reportTo: string
) => {
  if (isDevelopment && !env.securityHeadersEnabled) {
    return;
  }

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Report-To', reportTo);
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
};

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const requestHeaders = new Headers(req.headers);
  const nonce = generateNonce();
  const csp = generateCSP(nonce);
  const reportTo = JSON.stringify({
    group: 'csp-endpoint',
    max_age: 10886400,
    endpoints: [{ url: `${req.nextUrl.origin}/api/security/csp-report` }],
  });

  requestHeaders.set('Content-Security-Policy', csp);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Report-To', reportTo);

  // Bypass routes that don't require authentication checks, but still apply headers
  if (isUnAuthenticatedRoute(pathname)) {
    const bypassResponse = NextResponse.next({
      request: { headers: requestHeaders },
    });

    applySecurityHeaders(bypassResponse, csp, reportTo);

    return bypassResponse;
  }

  const redirectUrl = new URL('/auth/login', req.url);
  redirectUrl.searchParams.set('callbackUrl', encodeURI(req.url));

  // JWT strategy
  if (env.nextAuth.sessionStrategy === 'jwt') {
    const token = await getToken({
      req,
    });

    if (!token) {
      const redirectResponse = NextResponse.redirect(redirectUrl);
      applySecurityHeaders(redirectResponse, csp, reportTo);
      return redirectResponse;
    }
  }

  // Database strategy
  else if (env.nextAuth.sessionStrategy === 'database') {
    const url = new URL('/api/auth/session', req.url);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') || '',
      },
    });

    const session = await response.json();

    if (!session.user) {
      const redirectResponse = NextResponse.redirect(redirectUrl);
      applySecurityHeaders(redirectResponse, csp, reportTo);
      return redirectResponse;
    }
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  applySecurityHeaders(response, csp, reportTo);

  // All good, let the request through
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth/session).*)'],
};
