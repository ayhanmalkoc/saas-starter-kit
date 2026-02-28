import type { NextApiRequest, NextApiResponse } from 'next';
import env from '@/lib/env';
import { getTeamCanonicalRouteBySlug } from 'models/team';

const normalizeSingleParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const parseRawUrl = (rawUrl: string) => {
  const [pathname, queryString] = rawUrl.split('?');
  return {
    pathname: pathname || '',
    queryString: queryString || '',
  };
};

export const maybeRedirectLegacyTeamApiRoute = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  if (res.writableEnded) {
    return true;
  }

  const teamSlug = normalizeSingleParam(
    (req.query.slug as string | string[] | undefined) ?? undefined
  );

  if (!teamSlug || !req.url) {
    return false;
  }

  const { pathname, queryString } = parseRawUrl(req.url);
  const legacyPrefix = `/api/teams/${teamSlug}`;
  const prefixIndex = pathname.indexOf(legacyPrefix);

  if (prefixIndex < 0) {
    return false;
  }

  if (env.routing.legacyTeamRouteMode === 'enabled') {
    return false;
  }

  if (env.routing.legacyTeamRouteMode === 'disabled') {
    res.status(410).json({
      error: {
        code: 'legacy_route_disabled',
        message:
          'Legacy team-scoped API route is disabled. Use /api/orgs/:orgSlug/projects/:projectSlug/* endpoints.',
      },
    });
    return true;
  }

  const canonicalRoute = await getTeamCanonicalRouteBySlug(teamSlug);
  if (!canonicalRoute) {
    return false;
  }

  const suffix = pathname.slice(prefixIndex + legacyPrefix.length);
  const destinationPath = `/api/orgs/${canonicalRoute.organizationSlug}/projects/${canonicalRoute.projectSlug}${suffix}`;
  const destination = queryString
    ? `${destinationPath}?${queryString}`
    : destinationPath;

  res.redirect(307, destination);
  return true;
};
