import type { GetServerSidePropsContext } from 'next';
import env from '@/lib/env';
import { getTeamCanonicalRouteBySlug } from 'models/team';

const normalizeSingleParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const extractResolvedPath = (context: GetServerSidePropsContext) => {
  const rawUrl = context.resolvedUrl || context.req.url || '';
  const [pathname, queryString] = rawUrl.split('?');

  return {
    rawUrl,
    pathname: pathname || '',
    queryString: queryString || '',
  };
};

export const getLegacyTeamRouteRedirect = async (
  context: GetServerSidePropsContext
): Promise<
  | {
      redirect: {
        destination: string;
        permanent: false;
      };
    }
  | {
      notFound: true;
    }
  | null
> => {
  const teamSlug = normalizeSingleParam(
    (context.params?.slug as string | string[] | undefined) ??
      (context.query.slug as string | string[] | undefined)
  );

  if (!teamSlug) {
    return null;
  }

  const { pathname, queryString } = extractResolvedPath(context);
  const teamPrefix = `/teams/${teamSlug}`;
  const prefixIndex = pathname.indexOf(teamPrefix);

  if (prefixIndex < 0) {
    return null;
  }

  if (env.routing.legacyTeamRouteMode === 'enabled') {
    return null;
  }

  if (env.routing.legacyTeamRouteMode === 'disabled') {
    return {
      notFound: true,
    };
  }

  const canonicalRoute = await getTeamCanonicalRouteBySlug(teamSlug);
  if (!canonicalRoute) {
    return null;
  }

  const suffix = pathname.slice(prefixIndex + teamPrefix.length);
  const normalizedSuffix = suffix || '/settings';
  const destinationPath = `/orgs/${canonicalRoute.organizationSlug}/projects/${canonicalRoute.projectSlug}${normalizedSuffix}`;
  const destination = queryString
    ? `${destinationPath}?${queryString}`
    : destinationPath;

  if (destination === pathname || destination === `${pathname}?${queryString}`) {
    return null;
  }

  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
};
