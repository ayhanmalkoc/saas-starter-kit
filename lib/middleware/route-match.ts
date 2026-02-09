export const unAuthenticatedRoutes = {
  exact: [
    '/api/hello',
    '/api/health',
    '/api/webhooks/stripe',
    '/api/webhooks/dsync',
    '/api/security/csp-report',
    '/terms-condition',
    '/unlock-account',
    '/login/saml',
  ],
  prefix: ['/api/auth/**', '/api/oauth/**', '/api/scim/v2.0/**', '/auth/**'],
  singleSegmentWildcard: [
    '/api/invitations/*',
    '/invitations/*',
    '/.well-known/*',
  ],
} as const;

const normalizePathname = (pathname: string): string => {
  if (!pathname) {
    return '/';
  }

  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
};

export const isExactMatch = (pathname: string, route: string): boolean => {
  return normalizePathname(pathname) === normalizePathname(route);
};

export const isPrefixMatch = (pathname: string, pattern: string): boolean => {
  const normalizedPathname = normalizePathname(pathname);
  const prefix = normalizePathname(pattern.replace('/**', ''));

  return (
    normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`)
  );
};

const singleSegmentPatternToRegExp = (pattern: string): RegExp => {
  const escapedPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace('/*', '/[^/]+');

  return new RegExp(`^${escapedPattern}$`);
};

const isSingleSegmentWildcardMatch = (
  pathname: string,
  pattern: string
): boolean => {
  const normalizedPathname = normalizePathname(pathname);

  return singleSegmentPatternToRegExp(pattern).test(normalizedPathname);
};

export const isUnAuthenticatedRoute = (pathname: string): boolean => {
  return (
    unAuthenticatedRoutes.exact.some((route) =>
      isExactMatch(pathname, route)
    ) ||
    unAuthenticatedRoutes.prefix.some((route) =>
      isPrefixMatch(pathname, route)
    ) ||
    unAuthenticatedRoutes.singleSegmentWildcard.some((route) =>
      isSingleSegmentWildcardMatch(pathname, route)
    )
  );
};
