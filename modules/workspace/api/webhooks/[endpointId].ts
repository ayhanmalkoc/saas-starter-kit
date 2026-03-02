import { ApiError } from '@/lib/errors';
import { sendAudit } from '@/lib/retraced';
import { findOrCreateApp, findWebhook, updateWebhook } from '@/lib/svix';
import { throwIfNoProjectAccess } from 'models/access';
import { throwIfNotAllowed } from 'models/user';
import type { NextApiRequest, NextApiResponse } from 'next';
import { EndpointIn } from 'svix';
import { recordMetric } from '@/lib/metrics';
import env from '@/lib/env';
import {
  getWebhookSchema,
  updateWebhookEndpointSchema,
  validateWithSchema,
} from '@/lib/zod';
import { requireOrganizationEntitlement } from '@/lib/billing/entitlements';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  try {
    if (!env.workspaceFeatures.webhook) {
      throw new ApiError(404, 'Not Found');
    }

    switch (method) {
      case 'GET':
        await handleGET(req, res);
        break;
      case 'PUT':
        await handlePUT(req, res);
        break;
      default:
        res.setHeader('Allow', 'GET, PUT');
        res.status(405).json({
          error: { message: `Method ${method} Not Allowed` },
        });
    }
  } catch (err: any) {
    const message = err?.body?.detail || err.message || 'Something went wrong';
    const hasHttpStatus =
      typeof err?.status === 'number' && err.status >= 400 && err.status < 600;
    const hasHttpCode =
      typeof err?.code === 'number' && err.code >= 400 && err.code < 600;
    const status = hasHttpStatus ? err.status : hasHttpCode ? err.code : 500;

    res.status(status).json({ error: { message } });
  }
}

// Get a Webhook
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'webhooks',
  });
  throwIfNotAllowed(projectMember, 'project_webhook', 'read');

  const { endpointId } = validateWithSchema(
    getWebhookSchema,
    req.query as {
      endpointId: string;
    }
  );

  const app = await findOrCreateApp(
    projectMember.project.name,
    projectMember.project.id
  );

  if (!app) {
    throw new ApiError(400, 'Bad request.');
  }

  const webhook = await findWebhook(app.id, endpointId as string);

  recordMetric('webhook.fetched');

  res.status(200).json({ data: webhook });
};

// Update a Webhook
const handlePUT = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'webhooks',
  });
  throwIfNotAllowed(projectMember, 'project_webhook', 'update');

  const { name, url, eventTypes, endpointId } = validateWithSchema(
    updateWebhookEndpointSchema,
    {
      ...req.query,
      ...req.body,
    }
  );

  const app = await findOrCreateApp(
    projectMember.project.name,
    projectMember.project.id
  );

  if (!app) {
    throw new ApiError(400, 'Bad request.');
  }

  const data: EndpointIn = {
    description: name,
    url,
    version: 1,
  };

  if (eventTypes.length > 0) {
    data['filterTypes'] = eventTypes;
  }
  // Checks if the webhook exists or throws an error
  await findWebhook(app.id, endpointId);

  const webhook = await updateWebhook(app.id, endpointId, data);

  sendAudit({
    action: 'webhook.update',
    crud: 'u',
    user: projectMember.user,
    project: projectMember.project,
  });

  recordMetric('webhook.updated');

  res.status(200).json({ data: webhook });
};
