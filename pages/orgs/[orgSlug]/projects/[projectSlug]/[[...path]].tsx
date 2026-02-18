import type { GetServerSideProps } from 'next';

import {
  buildLegacyTeamDestination,
  normalizeOrgProjectRouteParams,
  resolveLegacyTeamContextFromOrgProject,
} from '@/lib/routing/org-project-compat';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const routeParams = normalizeOrgProjectRouteParams({
    orgSlug: context.params?.orgSlug,
    projectSlug: context.params?.projectSlug,
  });

  if (!routeParams) {
    return { notFound: true };
  }

  const teamContext = await resolveLegacyTeamContextFromOrgProject(routeParams);
  if (!teamContext) {
    return { notFound: true };
  }

  const suffixSegments = Array.isArray(context.params?.path)
    ? context.params?.path
    : [];

  const destination = buildLegacyTeamDestination({
    teamSlug: teamContext.teamSlug,
    suffixSegments,
    query: context.query,
  });

  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
};

export default function OrgProjectCompatPage() {
  return null;
}
