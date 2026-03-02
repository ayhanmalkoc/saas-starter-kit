import { requireOrganizationEntitlement } from '@/lib/billing/entitlements';
import env from '@/lib/env';
import { getViewerToken } from '@/lib/retraced';
import { getSession } from '@/lib/session';
import { getProjectMembershipByRoute } from 'models/access';
import { getProjectByOrgAndSlug } from 'models/project';
import { throwIfNotAllowed } from 'models/user';
import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  GetServerSidePropsResult,
} from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export type WorkspacePageKey =
  | 'settings'
  | 'members'
  | 'sso'
  | 'directory-sync'
  | 'audit-logs'
  | 'billing'
  | 'webhooks'
  | 'api-keys'
  | 'products';

const runWorkspacePageServerSideProps = async ({
  pageKey,
  context,
  projectId,
}: {
  pageKey: WorkspacePageKey;
  context: GetServerSidePropsContext;
  projectId: string;
}): Promise<GetServerSidePropsResult<Record<string, unknown>>> => {
  const { locale, req, res, query } = context;
  const translations = locale
    ? await serverSideTranslations(locale, ['common'])
    : {};

  switch (pageKey) {
    case 'api-keys':
      if (!env.workspaceFeatures.apiKey) {
        return { notFound: true };
      }
      return {
        props: {
          ...translations,
          workspaceFeatures: env.workspaceFeatures,
        },
      };
    case 'audit-logs': {
      if (!env.workspaceFeatures.auditLog) {
        return { notFound: true };
      }

      const session = await getSession(req, res);
      const projectMember = await getProjectMembershipByRoute(
        session?.user.id as string,
        query as Record<string, string | string[] | undefined>
      );

      try {
        throwIfNotAllowed(projectMember, 'project_audit_log', 'read');
        await requireOrganizationEntitlement(
          projectMember.project.organizationId,
          {
            feature: 'project_audit_log',
          }
        );

        const auditLogToken = await getViewerToken(
          projectMember.project.id,
          session?.user.id as string
        );

        return {
          props: {
            ...translations,
            error: null,
            auditLogToken: auditLogToken ?? '',
            retracedHost: env.retraced.url ?? '',
            workspaceFeatures: env.workspaceFeatures,
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
            workspaceFeatures: env.workspaceFeatures,
          },
        };
      }
    }
    case 'billing':
      if (!env.workspaceFeatures.payments) {
        return { notFound: true };
      }
      return {
        props: {
          ...translations,
          workspaceFeatures: env.workspaceFeatures,
        },
      };
    case 'directory-sync':
      if (!env.workspaceFeatures.dsync) {
        return { notFound: true };
      }
      return {
        props: {
          ...translations,
          workspaceFeatures: env.workspaceFeatures,
        },
      };
    case 'members':
    case 'settings':
      return {
        props: {
          ...translations,
          workspaceFeatures: env.workspaceFeatures,
        },
      };
    case 'products':
      return {
        props: {
          ...translations,
        },
      };
    case 'sso':
      if (!env.workspaceFeatures.sso) {
        return { notFound: true };
      }
      return {
        props: {
          ...translations,
          workspaceFeatures: env.workspaceFeatures,
          SPConfigURL: env.jackson.selfHosted
            ? '/api/oauth/saml'
            : `${env.jackson.url}/api/v1/connections/${projectId}/saml`,
        },
      };
    case 'webhooks':
      if (!env.workspaceFeatures.webhook) {
        return { notFound: true };
      }
      return {
        props: {
          ...translations,
          workspaceFeatures: env.workspaceFeatures,
        },
      };
  }
};

export const getWorkspacePageServerSideProps = (
  pageKey: WorkspacePageKey
): GetServerSideProps<Record<string, unknown>> => {
  return async (context: GetServerSidePropsContext) => {
    const orgSlug = context.params?.orgSlug as string | undefined;
    const projectSlug = context.params?.projectSlug as string | undefined;

    if (!orgSlug || !projectSlug) {
      return { notFound: true };
    }

    const project = await getProjectByOrgAndSlug(orgSlug, projectSlug);
    if (!project) {
      return { notFound: true };
    }

    return runWorkspacePageServerSideProps({
      pageKey,
      context,
      projectId: project.id,
    });
  };
};
