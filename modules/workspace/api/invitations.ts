import { sendProjectInviteEmail } from '@/lib/email/sendProjectInviteEmail';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { sendAudit } from '@/lib/retraced';
import { getSession } from '@/lib/session';
import { sendEvent } from '@/lib/svix';
import { getOrganizationEntitlements } from '@/lib/billing/entitlements';
import { getUser, throwIfNotAllowed } from 'models/user';
import {
  deleteInvitation,
  getInvitation,
  getInvitationCount,
  getInvitations,
  isInvitationExpired,
} from 'models/invitation';
import { throwIfNoProjectAccess } from 'models/access';
import type { NextApiRequest, NextApiResponse } from 'next';
import { recordMetric } from '@/lib/metrics';
import { extractEmailDomain, isEmailAllowed } from '@/lib/email/utils';
import { Invitation, Prisma, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { countProjectMembers } from 'models/projectMember';
import {
  acceptInvitationSchema,
  deleteInvitationSchema,
  getInvitationsSchema,
  inviteViaEmailSchema,
  validateWithSchema,
} from '@/lib/zod';

const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INVITATION_RETRIES = 3;

const enforceProjectMemberLimitValue = (
  memberLimit: number | undefined,
  requestedMemberCount: number
) => {
  if (memberLimit === undefined) {
    return;
  }

  if (requestedMemberCount > memberLimit) {
    throw new ApiError(
      403,
      `Project member limit exceeded (${memberLimit}). Increase seat capacity from billing before inviting more members.`
    );
  }
};

const createInvitationWithProjectLimit = async ({
  organizationId,
  projectId,
  invitedBy,
  role,
  sentViaEmail,
  email,
  allowedDomains,
  memberLimit,
}: {
  organizationId: string;
  projectId: string;
  invitedBy: string;
  role: Role;
  sentViaEmail: boolean;
  email: string | null;
  allowedDomains: string[];
  memberLimit: number | undefined;
}): Promise<Invitation> => {
  for (let attempt = 1; attempt <= MAX_INVITATION_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const [currentMemberCount, pendingInvitationCount] =
            await Promise.all([
              tx.projectMember.count({
                where: { projectId },
              }),
              tx.invitation.count({
                where: {
                  projectId,
                  expires: {
                    gt: new Date(),
                  },
                },
              }),
            ]);

          enforceProjectMemberLimitValue(
            memberLimit,
            currentMemberCount + pendingInvitationCount + 1
          );

          return await tx.invitation.create({
            data: {
              organizationId,
              projectId,
              invitedBy,
              role,
              email,
              sentViaEmail,
              allowedDomains,
              token: randomUUID(),
              expires: new Date(Date.now() + INVITATION_EXPIRY_MS),
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < MAX_INVITATION_RETRIES
      ) {
        continue;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        sentViaEmail &&
        email
      ) {
        throw new ApiError(400, 'An invitation already exists for this email.');
      }

      throw error;
    }
  }

  throw new ApiError(
    409,
    'Invitation request conflicted with another request. Please retry.'
  );
};

const addProjectAndOrganizationMemberWithProjectLimit = async ({
  organizationId,
  projectId,
  userId,
  role,
  memberLimit,
}: {
  organizationId: string;
  projectId: string;
  userId: string;
  role: Role;
  memberLimit: number | undefined;
}) => {
  for (let attempt = 1; attempt <= MAX_INVITATION_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existingMember = await tx.projectMember.findUnique({
            where: {
              projectId_userId: {
                projectId,
                userId,
              },
            },
            select: {
              projectId: true,
            },
          });

          if (!existingMember) {
            const currentMemberCount = await tx.projectMember.count({
              where: {
                projectId,
              },
            });
            enforceProjectMemberLimitValue(memberLimit, currentMemberCount + 1);
          }

          await tx.organizationMember.upsert({
            where: {
              organizationId_userId: {
                organizationId,
                userId,
              },
            },
            create: {
              organizationId,
              userId,
              role,
            },
            update: {
              role,
            },
          });

          return await tx.projectMember.upsert({
            create: {
              projectId,
              userId,
              role,
            },
            update: {
              role,
            },
            where: {
              projectId_userId: {
                projectId,
                userId,
              },
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < MAX_INVITATION_RETRIES
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new ApiError(
    409,
    'Invitation acceptance conflicted with another request. Please retry.'
  );
};

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
      case 'PUT':
        await handlePUT(req, res);
        break;
      case 'DELETE':
        await handleDELETE(req, res);
        break;
      default:
        res.setHeader('Allow', 'GET, POST, PUT, DELETE');
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

// Invite a user to a project
const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  throwIfNotAllowed(projectMember, 'project_invitation', 'create');

  const { email, role, sentViaEmail, domains } = validateWithSchema(
    inviteViaEmailSchema,
    req.body
  ) as {
    email?: string;
    role: Role;
    sentViaEmail: boolean;
    domains?: string;
  };

  let invitation: undefined | Invitation = undefined;

  // Invite via email
  if (sentViaEmail) {
    if (!email) {
      throw new ApiError(400, 'Email is required.');
    }

    if (!isEmailAllowed(email)) {
      throw new ApiError(
        400,
        'It seems you entered a non-business email. Invitations can only be sent to work emails.'
      );
    }

    // Keep member-existence checks index-friendly; monitor performance on large projects.
    const memberExists = await countProjectMembers({
      where: {
        projectId: projectMember.projectId,
        user: {
          email,
        },
      },
    });

    if (memberExists) {
      throw new ApiError(400, 'This user is already a member of the project.');
    }

    const invitationExists = await getInvitationCount({
      where: {
        email,
        projectId: projectMember.projectId,
      },
    });

    if (invitationExists) {
      throw new ApiError(400, 'An invitation already exists for this email.');
    }
  }
  const entitlements = await getOrganizationEntitlements(
    projectMember.organizationId
  );
  const memberLimit = entitlements.limits.project_members;

  if (sentViaEmail) {
    invitation = await createInvitationWithProjectLimit({
      organizationId: projectMember.organizationId,
      projectId: projectMember.projectId,
      invitedBy: projectMember.userId,
      email: email!,
      role,
      sentViaEmail: true,
      allowedDomains: [],
      memberLimit,
    });
  } else {
    invitation = await createInvitationWithProjectLimit({
      organizationId: projectMember.organizationId,
      projectId: projectMember.projectId,
      invitedBy: projectMember.userId,
      role,
      email: null,
      sentViaEmail: false,
      allowedDomains: domains
        ? domains.split(',').map((d) => d.trim().toLowerCase())
        : [],
      memberLimit,
    });
  }

  if (!invitation) {
    throw new ApiError(400, 'Could not create invitation. Please try again.');
  }

  if (invitation.sentViaEmail) {
    await sendProjectInviteEmail(projectMember.project, invitation);
  }

  await sendEvent(projectMember.projectId, 'invitation.created', invitation);

  sendAudit({
    action: 'member.invitation.create',
    crud: 'c',
    user: projectMember.user,
    project: projectMember.project,
  });

  recordMetric('invitation.created');

  res.status(204).end();
};

// Get all invitations for a project
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  throwIfNotAllowed(projectMember, 'project_invitation', 'read');

  const { sentViaEmail } = validateWithSchema(
    getInvitationsSchema,
    req.query as { sentViaEmail: string }
  );

  const invitations = await getInvitations(
    projectMember.projectId,
    sentViaEmail === 'true'
  );

  recordMetric('invitation.fetched');

  res.status(200).json({ data: invitations });
};

// Delete an invitation
const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const projectMember = await throwIfNoProjectAccess(req, res);
  throwIfNotAllowed(projectMember, 'project_invitation', 'delete');

  const { id } = validateWithSchema(
    deleteInvitationSchema,
    req.query as { id: string }
  );

  const invitation = await getInvitation({ id });

  if (
    invitation.invitedBy != projectMember.user.id ||
    invitation.project.id != projectMember.projectId
  ) {
    throw new ApiError(
      400,
      `You don't have permission to delete this invitation.`
    );
  }

  await deleteInvitation({ id });

  sendAudit({
    action: 'member.invitation.delete',
    crud: 'd',
    user: projectMember.user,
    project: projectMember.project,
  });

  await sendEvent(projectMember.projectId, 'invitation.removed', invitation);

  recordMetric('invitation.removed');

  res.status(200).json({ data: {} });
};

// Accept an invitation to a project
const handlePUT = async (req: NextApiRequest, res: NextApiResponse) => {
  const { inviteToken } = validateWithSchema(
    acceptInvitationSchema,
    req.body as { inviteToken: string }
  );

  const invitation = await getInvitation({ token: inviteToken });

  if (await isInvitationExpired(invitation.expires)) {
    throw new ApiError(400, 'Invitation expired. Please request a new one.');
  }

  const session = await getSession(req, res);

  if (!session || !session.user || !session.user.id || !session.user.email) {
    throw new ApiError(401, 'You must be logged in to accept this invitation.');
  }

  const { id: userId, email } = session.user;
  const existingUser = await getUser({ id: userId });

  if (!existingUser) {
    throw new ApiError(
      401,
      'Session user could not be found. Please sign out and sign in again before accepting the invitation.'
    );
  }

  // Make sure the user is logged in with the invited email address (Join via email)
  if (invitation.sentViaEmail && invitation.email !== email) {
    throw new ApiError(
      400,
      'You must be logged in with the email address you were invited with.'
    );
  }

  // Make sure the user is logged in with an allowed domain (Join via link)
  if (!invitation.sentViaEmail && invitation.allowedDomains.length) {
    const emailDomain = extractEmailDomain(email);
    const allowJoin = invitation.allowedDomains.find(
      (domain) => domain === emailDomain
    );

    if (!allowJoin) {
      throw new ApiError(
        400,
        'You must be logged in with an email address from an allowed domain.'
      );
    }
  }

  const entitlements = await getOrganizationEntitlements(
    invitation.project.organizationId
  );
  const memberLimit = entitlements.limits.project_members;

  let member;
  try {
    member = await addProjectAndOrganizationMemberWithProjectLimit({
      organizationId: invitation.project.organizationId,
      projectId: invitation.project.id,
      userId,
      role: invitation.role,
      memberLimit,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new ApiError(
        401,
        'Session is stale for invitation acceptance. Please sign out and sign in again.'
      );
    }

    throw error;
  }

  await sendEvent(invitation.project.id, 'member.created', member);

  if (invitation.sentViaEmail) {
    await deleteInvitation({ token: inviteToken });
  }

  recordMetric('member.created');

  res.status(204).end();
};
