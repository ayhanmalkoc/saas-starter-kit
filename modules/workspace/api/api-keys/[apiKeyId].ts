import { deleteApiKey } from 'models/apiKey';
import {
  getCurrentUserWithProject,
  throwIfNoProjectAccess,
} from 'models/access';
import { throwIfNotAllowed } from 'models/user';
import type { NextApiRequest, NextApiResponse } from 'next';
import { recordMetric } from '@/lib/metrics';
import env from '@/lib/env';
import { ApiError } from '@/lib/errors';
import { deleteApiKeySchema, validateWithSchema } from '@/lib/zod';
import { throwIfNoAccessToApiKey } from '@/lib/guards/project-api-key';
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
      case 'DELETE':
        await handleDELETE(req, res);
        break;
      default:
        res.setHeader('Allow', 'DELETE');
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

// Delete an API key
const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const user = await getCurrentUserWithProject(req, res);

  throwIfNotAllowed(user, 'project_api_key', 'delete');

  const { apiKeyId } = validateWithSchema(deleteApiKeySchema, req.query);

  await throwIfNoAccessToApiKey(apiKeyId, user.project.id);

  await deleteApiKey(apiKeyId);

  recordMetric('apikey.removed');

  res.status(204).end();
};
