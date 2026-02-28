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

import TeamApiKeysPage, {
  getServerSideProps as getApiKeysServerSideProps,
} from '../../../../teams/[slug]/api-keys';
import TeamAuditLogsPage, {
  getServerSideProps as getAuditLogsServerSideProps,
} from '../../../../teams/[slug]/audit-logs';
import TeamBillingPage, {
  getServerSideProps as getBillingServerSideProps,
} from '../../../../teams/[slug]/billing';
import TeamDirectorySyncPage, {
  getServerSideProps as getDirectorySyncServerSideProps,
} from '../../../../teams/[slug]/directory-sync';
import TeamMembersPage, {
  getServerSideProps as getMembersServerSideProps,
} from '../../../../teams/[slug]/members';
import TeamProductsPage, {
  getServerSideProps as getProductsServerSideProps,
} from '../../../../teams/[slug]/products';
import TeamSettingsPage, {
  getServerSideProps as getSettingsServerSideProps,
} from '../../../../teams/[slug]/settings';
import TeamSSOPage, {
  getServerSideProps as getSSOServerSideProps,
} from '../../../../teams/[slug]/sso';
import TeamWebhooksPage, {
  getServerSideProps as getWebhooksServerSideProps,
} from '../../../../teams/[slug]/webhooks';

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
  getServerSideProps: (context: GetServerSidePropsContext) => Promise<any>;
};

const TEAM_PAGE_CONFIG_BY_KEY: Record<TeamPageKey, TeamPageConfig> = {
  settings: {
    component: TeamSettingsPage,
    getServerSideProps: getSettingsServerSideProps,
  },
  members: {
    component: TeamMembersPage,
    getServerSideProps: getMembersServerSideProps,
  },
  sso: {
    component: TeamSSOPage,
    getServerSideProps: getSSOServerSideProps,
  },
  'directory-sync': {
    component: TeamDirectorySyncPage,
    getServerSideProps: getDirectorySyncServerSideProps,
  },
  'audit-logs': {
    component: TeamAuditLogsPage,
    getServerSideProps: getAuditLogsServerSideProps,
  },
  billing: {
    component: TeamBillingPage,
    getServerSideProps: getBillingServerSideProps,
  },
  webhooks: {
    component: TeamWebhooksPage,
    getServerSideProps: getWebhooksServerSideProps,
  },
  'api-keys': {
    component: TeamApiKeysPage,
    getServerSideProps: getApiKeysServerSideProps,
  },
  products: {
    component: TeamProductsPage,
    getServerSideProps: getProductsServerSideProps,
  },
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

  const pageConfig = TEAM_PAGE_CONFIG_BY_KEY[pageKey];
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

  const result = await pageConfig.getServerSideProps(delegatedContext);

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
