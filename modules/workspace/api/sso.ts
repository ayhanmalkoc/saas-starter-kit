import type { NextApiRequest, NextApiResponse } from 'next';

import env from '@/lib/env';
import { ApiError } from '@/lib/errors';
import { sendAudit } from '@/lib/retraced';
import { throwIfNoProjectAccess } from 'models/access';
import { throwIfNotAllowed } from 'models/user';
import { ssoManager } from '@/lib/jackson/sso/index';
import { requireOrganizationEntitlement } from '@/lib/billing/entitlements';
import {
  extractClientId,
  throwIfNoAccessToConnection,
} from '@/lib/guards/project-sso';

const sso = ssoManager();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  try {
    if (!env.workspaceFeatures.sso) {
      throw new ApiError(404, 'Not Found');
    }

    switch (method) {
      case 'GET':
        await handleGET(req, res);
        break;
      case 'POST':
        await handlePOST(req, res);
        break;
      case 'PATCH':
        await handlePATCH(req, res);
        break;
      case 'DELETE':
        await handleDELETE(req, res);
        break;
      default:
        res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
        res.status(405).json({
          error: { message: `Method ${method} Not Allowed` },
        });
    }
  } catch (err: any) {
    console.error(err);

    const message = err.message || 'Something went wrong';
    const status = err.status || 500;

    res.status(status).json({ error: { message } });
  }
}

// Get the SSO connection for the project.
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'sso',
  });

  throwIfNotAllowed(projectMember, 'project_sso', 'read');

  if ('clientID' in req.query) {
    await throwIfNoAccessToConnection({
      projectId: projectMember.projectId,
      clientId: extractClientId(req),
    });
  }

  const params =
    'clientID' in req.query
      ? { clientID: req.query.clientID as string }
      : { tenant: projectMember.projectId, product: env.jackson.productId };

  const connections = await sso.getConnections(params);

  res.json(connections);
};

// Create a SSO connection for the project.
const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'sso',
  });

  throwIfNotAllowed(projectMember, 'project_sso', 'create');

  const connection = await sso.createConnection({
    ...req.body,
    defaultRedirectUrl: env.jackson.sso.callback + env.jackson.sso.idpLoginPath,
    redirectUrl: env.jackson.sso.callback,
    product: env.jackson.productId,
    tenant: projectMember.projectId,
  });

  sendAudit({
    action: 'sso.connection.create',
    crud: 'c',
    user: projectMember.user,
    project: projectMember.project,
  });

  res.status(201).json(connection);
};

const handlePATCH = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'sso',
  });

  throwIfNotAllowed(projectMember, 'project_sso', 'create');

  await throwIfNoAccessToConnection({
    projectId: projectMember.projectId,
    clientId: extractClientId(req),
  });

  await sso.updateConnection({
    ...req.body,
    tenant: projectMember.projectId,
    product: env.jackson.productId,
  });

  sendAudit({
    action: 'sso.connection.patch',
    crud: 'u',
    user: projectMember.user,
    project: projectMember.project,
  });

  res.status(204).end();
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'sso',
  });

  throwIfNotAllowed(projectMember, 'project_sso', 'delete');

  await throwIfNoAccessToConnection({
    projectId: projectMember.projectId,
    clientId: extractClientId(req),
  });

  await sso.deleteConnection({ ...(req.query as any) });

  sendAudit({
    action: 'sso.connection.delete',
    crud: 'c',
    user: projectMember.user,
    project: projectMember.project,
  });

  res.status(204).end();
};
