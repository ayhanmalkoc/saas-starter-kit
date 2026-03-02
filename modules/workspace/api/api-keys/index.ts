import { createApiKey, fetchApiKeys } from 'models/apiKey';
import { throwIfNoProjectAccess } from 'models/access';
import { throwIfNotAllowed } from 'models/user';
import type { NextApiRequest, NextApiResponse } from 'next';
import { recordMetric } from '@/lib/metrics';
import env from '@/lib/env';
import { ApiError } from '@/lib/errors';
import { createApiKeySchema, validateWithSchema } from '@/lib/zod';
import { requireOrganizationEntitlement } from '@/lib/billing/entitlements';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (!env.workspaceFeatures.apiKey) {
      throw new ApiError(404, 'Not Found');
    }

    const projectMember = await throwIfNoProjectAccess(req, res);
    await requireOrganizationEntitlement(projectMember.organizationId, {
      feature: 'api_keys',
    });

    switch (req.method) {
      case 'GET':
        await handleGET(req, res, projectMember);
        break;
      case 'POST':
        await handlePOST(req, res, projectMember);
        break;
      default:
        res.setHeader('Allow', 'GET, POST');
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

// Get API keys
const handleGET = async (
  req: NextApiRequest,
  res: NextApiResponse,
  projectMember: Awaited<ReturnType<typeof throwIfNoProjectAccess>>
) => {
  throwIfNotAllowed(projectMember, 'project_api_key', 'read');

  const apiKeys = await fetchApiKeys(projectMember.project.id);

  recordMetric('apikey.fetched');

  res.json({ data: apiKeys });
};

// Create an API key
const handlePOST = async (
  req: NextApiRequest,
  res: NextApiResponse,
  projectMember: Awaited<ReturnType<typeof throwIfNoProjectAccess>>
) => {
  throwIfNotAllowed(projectMember, 'project_api_key', 'create');

  const { name } = validateWithSchema(createApiKeySchema, req.body);

  const apiKey = await createApiKey({
    name,
    projectId: projectMember.project.id,
  });

  recordMetric('apikey.created');

  res.status(201).json({ data: { apiKey } });
};
