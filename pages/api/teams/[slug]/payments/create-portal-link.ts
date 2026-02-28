import { NextApiRequest, NextApiResponse } from 'next';

import { getSession } from '@/lib/session';
import { getOrganizationById } from 'models/organization';
import { throwIfNoTeamAccess } from 'models/team';
import { getBillingProvider } from '@/lib/billing/provider';
import type {
  BillingSession,
  BillingTeamMember,
} from '@/lib/billing/provider/types';
import env from '@/lib/env';
import {
  buildTeamWorkspaceAppPath,
  buildWorkspaceAppPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';
import { maybeRedirectLegacyTeamApiRoute } from '@/lib/routing/legacy-team-api-redirect';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (await maybeRedirectLegacyTeamApiRoute(req, res)) {
    return;
  }

  try {
    switch (req.method) {
      case 'POST':
        await handlePOST(req, res);
        break;
      default:
        res.setHeader('Allow', 'POST');
        res.status(405).json({
          error: { message: `Method ${req.method} Not Allowed` },
        });
    }
  } catch (error: any) {
    const message = error.message || 'Something went wrong';
    const status = error.status || 500;

    res.status(status).json({ error: { message } });
  }
}

const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const teamMember = await throwIfNoTeamAccess(req, res);
  const session = await getSession(req, res);
  const billingOrganization = teamMember.team.organizationId
    ? await getOrganizationById(teamMember.team.organizationId)
    : null;
  const billingProvider = getBillingProvider(
    billingOrganization?.billingProvider ?? teamMember.team.billingProvider
  );
  const customerId = await billingProvider.getCustomerId(
    teamMember as BillingTeamMember,
    session as BillingSession
  );
  const routeContext = getWorkspaceRouteContextFromQuery(req.query);
  const billingPath =
    buildWorkspaceAppPath({
      context: routeContext,
      teamSlug: teamMember.team.slug,
      suffix: 'billing',
    }) ?? buildTeamWorkspaceAppPath({ team: teamMember.team, suffix: 'billing' });

  const { url } = await billingProvider.createPortalSession({
    customerId,
    returnUrl: `${env.appUrl}${billingPath}`,
  });

  res.json({ data: { url } });
};
