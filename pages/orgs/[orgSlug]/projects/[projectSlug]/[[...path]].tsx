import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  InferGetServerSidePropsType,
  NextPage,
} from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import {
  normalizeOrgProjectRouteParams,
  resolveLegacyTeamContextFromOrgProject,
} from '@/lib/routing/org-project-compat';
import { requireTeamEntitlement } from '@/lib/billing/entitlements';
import env from '@/lib/env';
import { getViewerToken } from '@/lib/retraced';
import { getSession } from '@/lib/session';
import { getTeamMember } from 'models/team';
import { throwIfNotAllowed } from 'models/user';

import TeamApiKeysPage from '@/modules/workspace/pages/api-keys';
import TeamAuditLogsPage from '@/modules/workspace/pages/audit-logs';
import TeamBillingPage from '@/modules/workspace/pages/billing';
import TeamDirectorySyncPage from '@/modules/workspace/pages/directory-sync';
import TeamMembersPage from '@/modules/workspace/pages/members';
import TeamProductsPage from '@/modules/workspace/pages/products';
import TeamSettingsPage from '@/modules/workspace/pages/settings';
import TeamSSOPage from '@/modules/workspace/pages/sso';
import TeamWebhooksPage from '@/modules/workspace/pages/webhooks';

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
) : Promise<GetServerSidePropsResult<Record<string, unknown>>> => {
  const { locale, req, res, query } = context;
  const translations = locale
    ? await serverSideTranslations(locale, ['common'])
    : {};

  switch (pageKey) {
    case 'api-keys':
      if (!env.teamFeatures.apiKey) {
        return { notFound: true };
      }
      return {
        props: {
          ...translations,
          teamFeatures: env.teamFeatures,
        },
      };
    case 'audit-logs':
    {
      if (!env.teamFeatures.auditLog) {
        return { notFound: true };
      }

      const session = await getSession(req, res);
      const teamMember = await getTeamMember(
        session?.user.id as string,
        query.slug as string
      );

      try {
        throwIfNotAllowed(teamMember, 'team_audit_log', 'read');
        await requireTeamEntitlement(teamMember.team.id, {
          feature: 'team_audit_log',
        });

        const auditLogToken = await getViewerToken(
          teamMember.team.id,
          session?.user.id as string
        );

        return {
          props: {
            ...translations,
            error: null,
            auditLogToken: auditLogToken ?? '',
            retracedHost: env.retraced.url ?? '',
            teamFeatures: env.teamFeatures,
          },
        };
      } catch (error: unknown) {
        const { message } = error as { message: string };
        return {
          props: {
            ...translations,
            error: {
              message,
            },
            auditLogToken: null,
            retracedHost: null,
            teamFeatures: env.teamFeatures,
          },
        };
      }
    }
    case 'billing':
      if (!env.teamFeatures.payments) {
        return { notFound: true };
      }
      return {
        props: {
          ...translations,
          teamFeatures: env.teamFeatures,
        },
      };
    case 'directory-sync':
      if (!env.teamFeatures.dsync) {
        return { notFound: true };
      }
      return {
        props: {
          ...translations,
          teamFeatures: env.teamFeatures,
        },
      };
    case 'members':
    case 'settings':
      return {
        props: {
          ...translations,
          teamFeatures: env.teamFeatures,
        },
      };
    case 'products':
      return {
        props: {
          ...translations,
        },
      };
    case 'sso':
      if (!env.teamFeatures.sso) {
        return { notFound: true };
      }
      return {
        props: {
          ...translations,
          teamFeatures: env.teamFeatures,
          SPConfigURL: env.jackson.selfHosted
            ? '/api/oauth/saml'
            : `${env.jackson.url}/api/v1/connections/${query.slug}/saml`,
        },
      };
    case 'webhooks':
      if (!env.teamFeatures.webhook) {
        return { notFound: true };
      }
      return {
        props: {
          ...translations,
          teamFeatures: env.teamFeatures,
        },
      };
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

  const result = (await runTeamPageServerSideProps(
    pageKey,
    delegatedContext
  )) as any;

  if (result?.redirect?.destination) {
    return {
      redirect: {
        destination: result.redirect.destination,
        permanent: false,
      },
    };
  }

  if (result?.notFound) {
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

  return { notFound: true };
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
