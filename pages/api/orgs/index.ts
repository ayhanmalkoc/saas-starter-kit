import { slugify } from '@/lib/server-common';
import { ApiError } from '@/lib/errors';
import {
  createOrganizationWithDefaultProject,
  getOrganizationBySlug,
} from 'models/organization';
import { getProjectsByUserId } from 'models/project';
import type { NextApiRequest, NextApiResponse } from 'next';
import { recordMetric } from '@/lib/metrics';
import { createProjectSchema, validateWithSchema } from '@/lib/zod';
import { getCurrentUser } from 'models/user';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  try {
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
    const message = error.message || 'Something went wrong';
    const status = error.status || 500;

    res.status(status).json({ error: { message } });
  }
}

const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const user = await getCurrentUser(req, res);
  const projects = await getProjectsByUserId(user.id);

  recordMetric('project.fetched');

  res.status(200).json({ data: projects });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const { name } = validateWithSchema(createProjectSchema, req.body);

  const user = await getCurrentUser(req, res);
  const slug = slugify(name);

  if (await getOrganizationBySlug(slug)) {
    throw new ApiError(400, 'An organization with this slug already exists.');
  }

  const workspace = await createOrganizationWithDefaultProject({
    ownerUserId: user.id,
    organizationName: name,
    organizationSlug: slug,
  });

  recordMetric('project.created');

  res.status(200).json({
    data: {
      ...workspace.project,
      organization: {
        id: workspace.organization.id,
        name: workspace.organization.name,
        slug: workspace.organization.slug,
        billingId: workspace.organization.billingId,
        billingProvider: workspace.organization.billingProvider,
      },
    },
  });
};
