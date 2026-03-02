import { ApiError } from '@/lib/errors';
import { sendAudit } from '@/lib/retraced';
import {
  createWebhook,
  deleteWebhook,
  findOrCreateApp,
  createEventType,
  listWebhooks,
} from '@/lib/svix';
import { throwIfNoProjectAccess } from 'models/access';
import { throwIfNotAllowed } from 'models/user';
import type { NextApiRequest, NextApiResponse } from 'next';
import { EndpointIn } from 'svix';
import { recordMetric } from '@/lib/metrics';
import env from '@/lib/env';
import {
  deleteWebhookSchema,
  validateWithSchema,
  webhookEndpointSchema,
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
      case 'POST':
        await handlePOST(req, res);
        break;
      case 'GET':
        await handleGET(req, res);
        break;
      case 'DELETE':
        await handleDELETE(req, res);
        break;
      default:
        res.setHeader('Allow', 'POST, GET, DELETE');
        res.status(405).json({
          error: { message: `Method ${method} Not Allowed` },
        });
    }
  } catch (error: any) {
    const message = error.message || 'Something went wrong';
    const status = error.status || 500;

    res.status(status).json({ error: { message } });
  }
}

// Create a Webhook endpoint
const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'webhooks',
  });
  throwIfNotAllowed(projectMember, 'project_webhook', 'create');

  const { name, url, eventTypes } = validateWithSchema(
    webhookEndpointSchema,
    req.body
  );
  const app = await findOrCreateApp(
    projectMember.project.name,
    projectMember.project.id
  );

  if (new URL(url).protocol !== 'https:') {
    throw new ApiError(400, 'Webhook URL must use HTTPS protocol.');
  }

  const data: EndpointIn = {
    description: name,
    url,
    version: 1,
  };

  if (eventTypes.length) {
    data['filterTypes'] = eventTypes;
  }

  for (const eventType of eventTypes) {
    await createEventType(eventType);
  }

  if (!app) {
    throw new ApiError(400, 'Bad request.');
  }

  const endpoint = await createWebhook(app.id, data);

  sendAudit({
    action: 'webhook.create',
    crud: 'c',
    user: projectMember.user,
    project: projectMember.project,
  });

  recordMetric('webhook.created');

  res.status(200).json({ data: endpoint });
};

// Get all webhooks created by a project.
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'webhooks',
  });
  throwIfNotAllowed(projectMember, 'project_webhook', 'read');

  const app = await findOrCreateApp(
    projectMember.project.name,
    projectMember.project.id
  );

  if (!app) {
    throw new ApiError(400, 'Bad request. Please add a Svix API key.');
  }

  const webhooks = await listWebhooks(app.id);

  recordMetric('webhook.fetched');

  res.status(200).json({ data: webhooks?.data || [] });
};

// Delete a webhook
const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  await requireOrganizationEntitlement(projectMember.organizationId, {
    feature: 'webhooks',
  });
  throwIfNotAllowed(projectMember, 'project_webhook', 'delete');

  const { webhookId } = validateWithSchema(
    deleteWebhookSchema,
    req.query as { webhookId: string }
  );

  const app = await findOrCreateApp(
    projectMember.project.name,
    projectMember.project.id
  );

  if (!app) {
    throw new ApiError(400, 'Bad request.');
  }

  if (app.uid != projectMember.project.id) {
    throw new ApiError(400, 'Bad request.');
  }

  await deleteWebhook(app.id, webhookId);

  sendAudit({
    action: 'webhook.delete',
    crud: 'd',
    user: projectMember.user,
    project: projectMember.project,
  });

  recordMetric('webhook.removed');

  res.status(200).json({ data: {} });
};
