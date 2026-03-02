import { sendAudit } from '@/lib/retraced';
import { deleteProject, getProjectById, updateProject } from 'models/project';
import {
  getCurrentUserWithProject,
  throwIfNoProjectAccess,
} from 'models/access';
import { throwIfNotAllowed } from 'models/user';
import type { NextApiRequest, NextApiResponse } from 'next';
import { recordMetric } from '@/lib/metrics';
import { ApiError } from '@/lib/errors';
import env from '@/lib/env';
import { updateProjectSchema, validateWithSchema } from '@/lib/zod';
import { Prisma } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await throwIfNoProjectAccess(req, res);

    switch (req.method) {
      case 'GET':
        await handleGET(req, res);
        break;
      case 'PUT':
        await handlePUT(req, res);
        break;
      case 'DELETE':
        await handleDELETE(req, res);
        break;
      default:
        res.setHeader('Allow', 'GET, PUT, DELETE');
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

// Get a project
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const user = await getCurrentUserWithProject(req, res);

  throwIfNotAllowed(user, 'project', 'read');

  const project = await getProjectById(user.project.id);

  recordMetric('project.fetched');

  res.status(200).json({ data: project });
};

// Update a project
const handlePUT = async (req: NextApiRequest, res: NextApiResponse) => {
  const user = await getCurrentUserWithProject(req, res);

  throwIfNotAllowed(user, 'project', 'update');

  const { name, slug } = validateWithSchema(updateProjectSchema, req.body);

  let updatedProject: Awaited<ReturnType<typeof updateProject>>;

  try {
    updatedProject = await updateProject(user.project.id, {
      name,
      slug,
    });
  } catch (error: any) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      error.meta?.target
    ) {
      const target = error.meta.target as string[];

      if (target.includes('slug')) {
        throw new ApiError(
          409,
          'This slug is already taken for a project in this organization.'
        );
      }
    }

    throw error;
  }

  sendAudit({
    action: 'project.update',
    crud: 'u',
    user,
    project: user.project,
  });

  recordMetric('project.updated');

  res.status(200).json({ data: updatedProject });
};

// Delete a project
const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!env.workspaceFeatures.deleteProject) {
    throw new ApiError(404, 'Not Found');
  }

  const user = await getCurrentUserWithProject(req, res);

  throwIfNotAllowed(user, 'project', 'delete');

  await deleteProject(user.project.id);

  sendAudit({
    action: 'project.delete',
    crud: 'd',
    user,
    project: user.project,
  });

  recordMetric('project.removed');

  res.status(204).end();
};
