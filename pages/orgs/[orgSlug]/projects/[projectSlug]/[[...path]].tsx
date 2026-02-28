import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
  NextPage,
} from 'next';

import {
  normalizeOrgProjectRouteParams,
  resolveLegacyTeamContextFromOrgProject,
} from '@/lib/routing/org-project-compat';

import TeamApiKeysPage from '../../../../teams/[slug]/api-keys';
import TeamAuditLogsPage from '../../../../teams/[slug]/audit-logs';
import TeamBillingPage from '../../../../teams/[slug]/billing';
import TeamDirectorySyncPage from '../../../../teams/[slug]/directory-sync';
import TeamMembersPage from '../../../../teams/[slug]/members';
import TeamProductsPage from '../../../../teams/[slug]/products';
import TeamSettingsPage from '../../../../teams/[slug]/settings';
import TeamSSOPage from '../../../../teams/[slug]/sso';
import TeamWebhooksPage from '../../../../teams/[slug]/webhooks';

type TeamPageKey =
  | 'settings'
  | 'members'
  | 'sso'
  | 'directory-sync'
  | 'audit-logs'
  | 'billing'
  | 'webhooks'
  | 'api-keys'
  | 'products';

type TeamPageConfig = {
  component: NextPage<any>;
};

const TEAM_PAGE_CONFIG_BY_KEY: Record<TeamPageKey, TeamPageConfig> = {
  settings: {
    component: TeamSettingsPage,
  },
  members: {
    component: TeamMembersPage,
  },
  sso: {
    component: TeamSSOPage,
  },
  'directory-sync': {
    component: TeamDirectorySyncPage,
  },
  'audit-logs': {
    component: TeamAuditLogsPage,
  },
  billing: {
    component: TeamBillingPage,
  },
  webhooks: {
    component: TeamWebhooksPage,
  },
  'api-keys': {
    component: TeamApiKeysPage,
  },
  products: {
    component: TeamProductsPage,
  },
};

const runTeamPageServerSideProps = async (
  pageKey: TeamPageKey,
  context: GetServerSidePropsContext
) => {
  switch (pageKey) {
    case 'settings': {
      const pageModule = await import('../../../../teams/[slug]/settings');
      return pageModule.getServerSideProps(context);
    }
    case 'members': {
      const pageModule = await import('../../../../teams/[slug]/members');
      return pageModule.getServerSideProps(context);
    }
    case 'sso': {
      const pageModule = await import('../../../../teams/[slug]/sso');
      return pageModule.getServerSideProps(context);
    }
    case 'directory-sync': {
      const pageModule = await import('../../../../teams/[slug]/directory-sync');
      return pageModule.getServerSideProps(context);
    }
    case 'audit-logs': {
      const pageModule = await import('../../../../teams/[slug]/audit-logs');
      return pageModule.getServerSideProps(context);
    }
    case 'billing': {
      const pageModule = await import('../../../../teams/[slug]/billing');
      return pageModule.getServerSideProps(context);
    }
    case 'webhooks': {
      const pageModule = await import('../../../../teams/[slug]/webhooks');
      return pageModule.getServerSideProps(context);
    }
    case 'api-keys': {
      const pageModule = await import('../../../../teams/[slug]/api-keys');
      return pageModule.getServerSideProps(context);
    }
    case 'products': {
      const pageModule = await import('../../../../teams/[slug]/products');
      return pageModule.getServerSideProps(context);
    }
  }
};

const normalizePathSegments = (path: string | string[] | undefined) => {
  if (!path) {
    return [];
  }

  const segments = Array.isArray(path) ? path : [path];
  return segments.map((segment) => segment.trim()).filter(Boolean);
};

const resolveTeamPageKey = (segments: string[]): TeamPageKey | null => {
  if (segments.length === 0) {
    return 'settings';
  }

  if (segments.length > 1) {
    return null;
  }

  const key = segments[0] as TeamPageKey;
  return key in TEAM_PAGE_CONFIG_BY_KEY ? key : null;
};

export const getServerSideProps: GetServerSideProps<{
  __teamPageKey: TeamPageKey;
}> = async (context) => {
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

  const pathSegments = normalizePathSegments(context.params?.path);
  const pageKey = resolveTeamPageKey(pathSegments);
  if (!pageKey) {
    return { notFound: true };
  }

  const delegatedContext = {
    ...context,
    params: {
      ...(context.params || {}),
      slug: teamContext.teamSlug,
    },
    query: {
      ...context.query,
      slug: teamContext.teamSlug,
    },
  } as GetServerSidePropsContext;

  const result = await runTeamPageServerSideProps(pageKey, delegatedContext);

  if ('redirect' in result) {
    return result;
  }

  if ('notFound' in result) {
    return { notFound: true };
  }

  if ('props' in result) {
    const delegatedProps = await Promise.resolve(result.props);
    return {
      props: {
        ...(delegatedProps as Record<string, unknown>),
        __teamPageKey: pageKey,
      },
    };
  }

  return result;
};

const OrgProjectCompatPage = ({
  __teamPageKey,
  ...pageProps
}: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const pageConfig = TEAM_PAGE_CONFIG_BY_KEY[__teamPageKey];
  const TeamPageComponent = pageConfig.component;

  return <TeamPageComponent {...pageProps} />;
};

export default OrgProjectCompatPage;
