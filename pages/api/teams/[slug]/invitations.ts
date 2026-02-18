import { sendTeamInviteEmail } from '@/lib/email/sendTeamInviteEmail';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { sendAudit } from '@/lib/retraced';
import { getSession } from '@/lib/session';
import { sendEvent } from '@/lib/svix';
import { getTeamEntitlements } from '@/lib/billing/entitlements';
import { getUser, throwIfNotAllowed } from 'models/user';
import {
  deleteInvitation,
  getInvitation,
  getInvitationCount,
  getInvitations,
  isInvitationExpired,
} from 'models/invitation';
import { addTeamMember, throwIfNoTeamAccess } from 'models/team';
import type { NextApiRequest, NextApiResponse } from 'next';
import { recordMetric } from '@/lib/metrics';
import { extractEmailDomain, isEmailAllowed } from '@/lib/email/utils';
import { Invitation, Prisma, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { countTeamMembers } from 'models/teamMember';
import {
  acceptInvitationSchema,
  deleteInvitationSchema,
  getInvitationsSchema,
  inviteViaEmailSchema,
  validateWithSchema,
} from '@/lib/zod';

const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INVITATION_RETRIES = 3;

const enforceTeamMemberLimitValue = (
  memberLimit: number | undefined,
  requestedMemberCount: number
) => {
  if (memberLimit === undefined) {
    return;
  }

  if (requestedMemberCount > memberLimit) {
    throw new ApiError(
      403,
      `Team member limit exceeded (${memberLimit}). Increase seat capacity from billing before inviting more members.`
    );
  }
};

const enforceTeamMemberLimit = async (
  teamId: string,
  requestedMemberCount: number
) => {
  const entitlements = await getTeamEntitlements(teamId);
  enforceTeamMemberLimitValue(
    entitlements.limits.team_members,
    requestedMemberCount
  );
};

const createInvitationWithTeamLimit = async ({
  teamId,
  invitedBy,
  role,
  sentViaEmail,
  email,
  allowedDomains,
  memberLimit,
}: {
  teamId: string;
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
              tx.teamMember.count({
                where: { teamId },
              }),
              tx.invitation.count({
                where: {
                  teamId,
                  expires: {
                    gt: new Date(),
                  },
                },
              }),
            ]);

          enforceTeamMemberLimitValue(
            memberLimit,
            currentMemberCount + pendingInvitationCount + 1
          );

          return await tx.invitation.create({
            data: {
              teamId,
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

// Invite a user to a team
const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const teamMember = await throwIfNoTeamAccess(req, res);
  throwIfNotAllowed(teamMember, 'team_invitation', 'create');

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

    // Keep member-existence checks index-friendly; monitor performance on large teams.
    const memberExists = await countTeamMembers({
      where: {
        teamId: teamMember.teamId,
        user: {
          email,
        },
      },
    });

    if (memberExists) {
      throw new ApiError(400, 'This user is already a member of the team.');
    }

    const invitationExists = await getInvitationCount({
      where: {
        email,
        teamId: teamMember.teamId,
      },
    });

    if (invitationExists) {
      throw new ApiError(400, 'An invitation already exists for this email.');
    }
  }
  const entitlements = await getTeamEntitlements(teamMember.teamId);
  const memberLimit = entitlements.limits.team_members;

  if (sentViaEmail) {
    invitation = await createInvitationWithTeamLimit({
      teamId: teamMember.teamId,
      invitedBy: teamMember.userId,
      email: email!,
      role,
      sentViaEmail: true,
      allowedDomains: [],
      memberLimit,
    });
  } else {
    invitation = await createInvitationWithTeamLimit({
      teamId: teamMember.teamId,
      invitedBy: teamMember.userId,
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
    await sendTeamInviteEmail(teamMember.team, invitation);
  }

  await sendEvent(teamMember.teamId, 'invitation.created', invitation);

  sendAudit({
    action: 'member.invitation.create',
    crud: 'c',
    user: teamMember.user,
    team: teamMember.team,
  });

  recordMetric('invitation.created');

  res.status(204).end();
};

// Get all invitations for a team
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const teamMember = await throwIfNoTeamAccess(req, res);
  throwIfNotAllowed(teamMember, 'team_invitation', 'read');

  const { sentViaEmail } = validateWithSchema(
    getInvitationsSchema,
    req.query as { sentViaEmail: string }
  );

  const invitations = await getInvitations(
    teamMember.teamId,
    sentViaEmail === 'true'
  );

  recordMetric('invitation.fetched');

  res.status(200).json({ data: invitations });
};

// Delete an invitation
const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const teamMember = await throwIfNoTeamAccess(req, res);
  throwIfNotAllowed(teamMember, 'team_invitation', 'delete');

  const { id } = validateWithSchema(
    deleteInvitationSchema,
    req.query as { id: string }
  );

  const invitation = await getInvitation({ id });

  if (
    invitation.invitedBy != teamMember.user.id ||
    invitation.team.id != teamMember.teamId
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
    user: teamMember.user,
    team: teamMember.team,
  });

  await sendEvent(teamMember.teamId, 'invitation.removed', invitation);

  recordMetric('invitation.removed');

  res.status(200).json({ data: {} });
};

// Accept an invitation to an organization
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

  const isExistingMember = Boolean(
    await countTeamMembers({
      where: {
        teamId: invitation.team.id,
        userId,
      },
    })
  );

  if (!isExistingMember) {
    const currentMemberCount = await countTeamMembers({
      where: {
        teamId: invitation.team.id,
      },
    });
    await enforceTeamMemberLimit(invitation.team.id, currentMemberCount + 1);
  }

  let teamMember;
  try {
    teamMember = await addTeamMember(
      invitation.team.id,
      userId,
      invitation.role
    );
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

  await sendEvent(invitation.team.id, 'member.created', teamMember);

  if (invitation.sentViaEmail) {
    await deleteInvitation({ token: inviteToken });
  }

  recordMetric('member.created');

  res.status(204).end();
};
