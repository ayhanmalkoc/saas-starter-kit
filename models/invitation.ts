import env from '@/lib/env';
import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { Invitation } from '@prisma/client';
import { randomUUID } from 'crypto';

export type ProjectInvitation = Pick<
  Invitation,
  'id' | 'email' | 'role' | 'expires' | 'allowedDomains' | 'token'
> & { url: string };

// Keep this query index-friendly; monitor performance as invitation volume grows.
export const getInvitations = async (
  projectId: string,
  sentViaEmail: boolean
) => {
  const invitations = await prisma.invitation.findMany({
    where: {
      projectId,
      sentViaEmail,
    },
    select: {
      id: true,
      email: true,
      role: true,
      expires: true,
      token: true,
      allowedDomains: true,
    },
  });

  return invitations.map((invitation) => ({
    ...invitation,
    url: `${env.appUrl}/invitations/${invitation.token}`,
  })) as (Invitation & { url: string })[];
};

export const getInvitation = async (
  key: { token: string } | { id: string }
) => {
  const invitation = await prisma.invitation.findUnique({
    where: key,
    include: {
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!invitation) {
    throw new ApiError(404, 'Invitation not found.');
  }

  return invitation;
};

export const createInvitation = async (
  params: Omit<
    Invitation,
    'id' | 'token' | 'expires' | 'createdAt' | 'updatedAt'
  >
) => {
  const data: Omit<Invitation, 'id' | 'createdAt' | 'updatedAt'> = {
    ...params,
    token: randomUUID(),
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  return await prisma.invitation.create({
    data,
  });
};

export const deleteInvitation = async (
  key: { token: string } | { id: string }
) => {
  return await prisma.invitation.delete({
    where: key,
  });
};

export const isInvitationExpired = async (expires: Date) => {
  return expires.getTime() < Date.now();
};

export const getInvitationCount = async ({ where }) => {
  return await prisma.invitation.count({
    where,
  });
};
