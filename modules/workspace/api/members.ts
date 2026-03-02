import { ApiError } from '@/lib/errors';
import { sendAudit } from '@/lib/retraced';
import { sendEvent } from '@/lib/svix';
import { Role } from '@prisma/client';
import {
  countProjectMembers,
  getProjectMembers,
  removeProjectMember,
  updateProjectMember,
} from 'models/projectMember';
import { throwIfNoProjectAccess } from 'models/access';
import { throwIfNotAllowed } from 'models/user';
import type { NextApiRequest, NextApiResponse } from 'next';
import { recordMetric } from '@/lib/metrics';
import { validateMembershipOperation } from '@/lib/rbac';
import {
  deleteMemberSchema,
  updateMemberSchema,
  validateWithSchema,
} from '@/lib/zod';

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
      case 'DELETE':
        await handleDELETE(req, res);
        break;
      case 'PUT':
        await handlePUT(req, res);
        break;
      case 'PATCH':
        await handlePATCH(req, res);
        break;
      default:
        res.setHeader('Allow', 'GET, DELETE, PUT, PATCH');
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

// Get members of a project
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  throwIfNotAllowed(projectMember, 'project_member', 'read');

  const members = await getProjectMembers(projectMember.projectId);

  recordMetric('member.fetched');

  res.status(200).json({ data: members });
};

// Delete the member from the project
const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  throwIfNotAllowed(projectMember, 'project_member', 'delete');

  const { memberId } = validateWithSchema(
    deleteMemberSchema,
    req.query as { memberId: string }
  );

  await validateMembershipOperation(memberId, projectMember);

  const memberRemoved = await removeProjectMember(
    projectMember.projectId,
    memberId
  );

  await sendEvent(projectMember.projectId, 'member.removed', memberRemoved);

  sendAudit({
    action: 'member.remove',
    crud: 'd',
    user: projectMember.user,
    project: projectMember.project,
  });

  recordMetric('member.removed');

  res.status(200).json({ data: {} });
};

// Leave a project
const handlePUT = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  throwIfNotAllowed(projectMember, 'project', 'leave');

  // Keep owner-count checks index-friendly; monitor performance for large projects.
  const totalProjectOwners = await countProjectMembers({
    where: {
      role: Role.OWNER,
      projectId: projectMember.projectId,
    },
  });

  if (totalProjectOwners <= 1) {
    throw new ApiError(400, 'A project should have at least one owner.');
  }

  await removeProjectMember(projectMember.projectId, projectMember.user.id);

  recordMetric('member.left');

  res.status(200).json({ data: {} });
};

// Update the role of a member
const handlePATCH = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  throwIfNotAllowed(projectMember, 'project_member', 'update');

  const { memberId, role } = validateWithSchema(
    updateMemberSchema,
    req.body as { memberId: string; role: Role }
  );

  await validateMembershipOperation(memberId, projectMember, {
    role,
  });

  const memberUpdated = await updateProjectMember({
    where: {
      projectId_userId: {
        projectId: projectMember.projectId,
        userId: memberId,
      },
    },
    data: {
      role,
    },
  });

  sendAudit({
    action: 'member.update',
    crud: 'u',
    user: projectMember.user,
    project: projectMember.project,
  });

  recordMetric('member.role.updated');

  res.status(200).json({ data: memberUpdated });
};
