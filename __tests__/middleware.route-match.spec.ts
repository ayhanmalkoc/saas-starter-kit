import {
  isExactMatch,
  isPrefixMatch,
  isUnAuthenticatedRoute,
  unAuthenticatedRoutes,
} from '../lib/middleware/route-match';

describe('middleware route matching helpers', () => {
  it('classifies unauthenticated route patterns by matching strategy', () => {
    expect(unAuthenticatedRoutes.exact).toEqual(
      expect.arrayContaining(['/api/health'])
    );
    expect(unAuthenticatedRoutes.prefix).toEqual(
      expect.arrayContaining(['/api/auth/**'])
    );
    expect(unAuthenticatedRoutes.singleSegmentWildcard).toEqual(
      expect.arrayContaining(['/invitations/*'])
    );
  });

  it('matches exact routes only when path is identical', () => {
    expect(isExactMatch('/api/health', '/api/health')).toBe(true);
    expect(isExactMatch('/api/health/check', '/api/health')).toBe(false);
  });

  it('matches prefix routes for base path and descendants', () => {
    expect(isPrefixMatch('/api/auth', '/api/auth/**')).toBe(true);
    expect(isPrefixMatch('/api/auth/login', '/api/auth/**')).toBe(true);
    expect(isPrefixMatch('/api/authz/login', '/api/auth/**')).toBe(false);
  });

  it.each([
    ['/api/health', true],
    ['/api/health/check', false],
    ['/api/auth', true],
    ['/api/auth/sso/verify', true],
    ['/api/authz/sso/verify', false],
    ['/api/oauth/token', true],
    ['/api/scim/v2.0/users', true],
    ['/api/scim/v2/users', false],
    ['/api/invitations/abc', true],
    ['/api/invitations/abc/extra', false],
    ['/invitations/token123', true],
    ['/invitations/token123/accept', false],
    ['/.well-known/saml-configuration', true],
    ['/.well-known/a/b', false],
    ['/dashboard', false],
    ['/api/teams/acme/members', false],
  ])(
    'table-driven bypass case: pathname=%s -> bypass=%s',
    (pathname, expectedBypass) => {
      expect(isUnAuthenticatedRoute(pathname)).toBe(expectedBypass);
    }
  );

  it('does not bypass authentication for similarly named protected routes', () => {
    expect(isUnAuthenticatedRoute('/api/authentication/health')).toBe(false);
    expect(isUnAuthenticatedRoute('/api/invitations')).toBe(false);
    expect(isUnAuthenticatedRoute('/authx/login')).toBe(false);
  });
});
