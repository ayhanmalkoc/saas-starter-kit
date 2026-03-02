import env from '@/lib/env';
import { throwIfNoProjectAccess } from 'models/access';
import { throwIfNotAllowed } from 'models/user';
import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError } from '@/lib/errors';
import { dsyncManager } from '@/lib/jackson/dsync';
import { sendAudit } from '@/lib/retraced';
import { throwIfNoAccessToDirectory } from '@/lib/guards/project-dsync';
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
      case 'PATCH':
        await handlePATCH(req, res);
        break;
      case 'DELETE':
        await handleDELETE(req, res);
        break;
      default:
        res.setHeader('Allow', 'GET, PATCH, DELETE');
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

  const directoryId = req.query.directoryId as string;

  await throwIfNoAccessToDirectory({
    projectId: projectMember.project.id,
    directoryId,
  });

  const connection = await dsync.getConnectionById(directoryId);

  res.status(200).json(connection);
};

const handlePATCH = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'directory_sync',
  });

  throwIfNotAllowed(projectMember, 'project_dsync', 'read');

  await throwIfNoAccessToDirectory({
    projectId: projectMember.project.id,
    directoryId: req.query.directoryId as string,
  });

  const body = { ...req.query, ...req.body };

  const connection = await dsync.updateConnection(body);

  res.status(200).json(connection);
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'directory_sync',
  });

  throwIfNotAllowed(projectMember, 'project_dsync', 'delete');

  await throwIfNoAccessToDirectory({
    projectId: projectMember.project.id,
    directoryId: req.query.directoryId as string,
  });

  const data = await dsync.deleteConnection(req.query);

  sendAudit({
    action: 'dsync.connection.delete',
    crud: 'd',
    user: projectMember.user,
    project: projectMember.project,
  });

  res.status(200).json(data);
};
