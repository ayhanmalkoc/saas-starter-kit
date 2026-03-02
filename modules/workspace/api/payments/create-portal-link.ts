import { NextApiRequest, NextApiResponse } from 'next';

import { getSession } from '@/lib/session';
import { getOrganizationById } from 'models/organization';
import { throwIfNoProjectAccess } from 'models/access';
import { getBillingProvider } from '@/lib/billing/provider';
import type {
  BillingSession,
  BillingProjectMember,
} from '@/lib/billing/provider/types';
import env from '@/lib/env';
import {
  buildWorkspaceAppPath,
  getWorkspaceRouteContextFromQuery,
} from '@/lib/routing/workspace-routes';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
  const projectMember = await throwIfNoProjectAccess(req, res);
  const session = await getSession(req, res);
  const billingOrganization = await getOrganizationById(
    projectMember.organizationId
  );
  const billingProvider = getBillingProvider(
    billingOrganization?.billingProvider ?? 'stripe'
  );
  const customerId = await billingProvider.getCustomerId(
    projectMember as BillingProjectMember,
    session as BillingSession
  );
  const routeContext = getWorkspaceRouteContextFromQuery(req.query);
  const billingPath = buildWorkspaceAppPath({
    context: routeContext,
    suffix: 'billing',
  });

  if (!billingPath) {
    throw new Error('Workspace app route could not be resolved.');
  }

  const { url } = await billingProvider.createPortalSession({
    customerId,
    returnUrl: `${env.appUrl}${billingPath}`,
  });

  res.json({ data: { url } });
};
