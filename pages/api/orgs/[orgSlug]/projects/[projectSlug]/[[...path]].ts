import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';

import {
  normalizeOrgProjectRouteParams,
  resolveLegacyTeamContextFromOrgProject,
} from '@/lib/routing/org-project-compat';

import teamHandler from '../../../../teams/[slug]';
import teamApiKeysByIdHandler from '../../../../teams/[slug]/api-keys/[apiKeyId]';
import teamApiKeysHandler from '../../../../teams/[slug]/api-keys';
import teamDirectorySyncByIdHandler from '../../../../teams/[slug]/dsync/[directoryId]';
import teamDirectorySyncHandler from '../../../../teams/[slug]/dsync';
import teamInvitationsHandler from '../../../../teams/[slug]/invitations';
import teamMembersHandler from '../../../../teams/[slug]/members';
import teamPaymentsCreateCheckoutSessionHandler from '../../../../teams/[slug]/payments/create-checkout-session';
import teamPaymentsCreatePortalLinkHandler from '../../../../teams/[slug]/payments/create-portal-link';
import teamPaymentsProductsHandler from '../../../../teams/[slug]/payments/products';
import teamPaymentsUpdateSubscriptionHandler from '../../../../teams/[slug]/payments/update-subscription';
import teamPermissionsHandler from '../../../../teams/[slug]/permissions';
import teamSsoHandler from '../../../../teams/[slug]/sso';
import teamWebhooksByIdHandler from '../../../../teams/[slug]/webhooks/[endpointId]';
import teamWebhooksHandler from '../../../../teams/[slug]/webhooks';

type HandlerResolution = {
  handler: NextApiHandler;
  extraQuery?: Record<string, string>;
};

const resolveLegacyHandler = (segments: string[]): HandlerResolution | null => {
  if (segments.length === 0) {
    return { handler: teamHandler };
  }

  if (segments.length === 1) {
    switch (segments[0]) {
      case 'permissions':
        return { handler: teamPermissionsHandler };
      case 'members':
        return { handler: teamMembersHandler };
      case 'invitations':
        return { handler: teamInvitationsHandler };
      case 'sso':
        return { handler: teamSsoHandler };
      case 'api-keys':
        return { handler: teamApiKeysHandler };
      case 'dsync':
        return { handler: teamDirectorySyncHandler };
      case 'webhooks':
        return { handler: teamWebhooksHandler };
      default:
        return null;
    }
  }

  if (segments[0] === 'api-keys' && segments.length === 2) {
    return {
      handler: teamApiKeysByIdHandler,
      extraQuery: { apiKeyId: segments[1] },
    };
  }

  if (segments[0] === 'dsync' && segments.length === 2) {
    return {
      handler: teamDirectorySyncByIdHandler,
      extraQuery: { directoryId: segments[1] },
    };
  }

  if (segments[0] === 'webhooks' && segments.length === 2) {
    return {
      handler: teamWebhooksByIdHandler,
      extraQuery: { endpointId: segments[1] },
    };
  }

  if (segments[0] === 'payments' && segments.length === 2) {
    switch (segments[1]) {
      case 'products':
        return { handler: teamPaymentsProductsHandler };
      case 'create-checkout-session':
        return { handler: teamPaymentsCreateCheckoutSessionHandler };
      case 'update-subscription':
        return { handler: teamPaymentsUpdateSubscriptionHandler };
      case 'create-portal-link':
        return { handler: teamPaymentsCreatePortalLinkHandler };
      default:
        return null;
    }
  }

  return null;
};

const normalizePathSegments = (path: string | string[] | undefined) => {
  if (!path) {
    return [];
  }

  const segments = Array.isArray(path) ? path : [path];
  return segments.map((segment) => segment.trim()).filter(Boolean);
};

export default async function orgProjectCompatApiHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const routeParams = normalizeOrgProjectRouteParams({
    orgSlug: req.query.orgSlug,
    projectSlug: req.query.projectSlug,
  });

  if (!routeParams) {
    return res.status(400).json({
      error: { message: 'Missing organization/project route params.' },
    });
  }

  const teamContext = await resolveLegacyTeamContextFromOrgProject(routeParams);
  if (!teamContext) {
    return res.status(404).json({
      error: { message: 'Project not found under organization.' },
    });
  }

  const segments = normalizePathSegments(req.query.path);
  const resolution = resolveLegacyHandler(segments);
  if (!resolution) {
    return res.status(404).json({
      error: { message: 'Unknown org/project API path.' },
    });
  }

  req.query = {
    ...req.query,
    slug: teamContext.teamSlug,
    ...(resolution.extraQuery || {}),
  };

  return resolution.handler(req, res);
}
