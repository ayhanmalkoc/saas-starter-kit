import env from '@/lib/env';
import { sendAudit } from '@/lib/retraced';
import { throwIfNoProjectAccess } from 'models/access';
import { throwIfNotAllowed } from 'models/user';
import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError } from '@/lib/errors';
import { dsyncManager } from '@/lib/jackson/dsync';
import { requireOrganizationEntitlement } from '@/lib/billing/entitlements';

const dsync = dsyncManager();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  try {
    if (!env.workspaceFeatures.dsync) {
      throw new ApiError(404, 'Not Found');
    }

    switch (method) {
      case 'GET':
        await handleGET(req, res);
        break;
      case 'POST':
        await handlePOST(req, res);
        break;

      default:
        res.setHeader('Allow', 'GET, POST');
        res.status(405).json({
          error: { message: `Method ${method} Not Allowed` },
        });
    }
  } catch (error: any) {
    console.error(error);

    const message = error.message || 'Something went wrong';
    const status = error.status || 500;

    res.status(status).json({ error: { message } });
  }
}

const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'directory_sync',
  });

  throwIfNotAllowed(projectMember, 'project_dsync', 'read');

  const connections = await dsync.getConnections({
    tenant: projectMember.projectId,
  });

  res.status(200).json(connections);
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'directory_sync',
  });

  throwIfNotAllowed(projectMember, 'project_dsync', 'create');

  const { body } = req;

  const connection = await dsync.createConnection({
    ...body,
    tenant: projectMember.projectId,
  });

  sendAudit({
    action: 'dsync.connection.create',
    crud: 'c',
    user: projectMember.user,
    project: projectMember.project,
  });

  res.status(201).json(connection);
};
