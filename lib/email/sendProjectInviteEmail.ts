import { Invitation } from '@prisma/client';
import { sendEmail } from './sendEmail';
import { ProjectInviteEmail } from '@/components/emailTemplates';
import { render } from '@react-email/components';
import env from '../env';
import app from '../app';

export const sendProjectInviteEmail = async (
  project: { name: string },
  invitation: Invitation
) => {
  if (!invitation.email) {
    return;
  }

  const subject = `You've been invited to join ${project.name} on ${app.name}`;
  const invitationLink = `${env.appUrl}/invitations/${invitation.token}`;

  const html = await render(
    ProjectInviteEmail({ invitationLink, project, subject })
  );

  await sendEmail({
    to: invitation.email,
    subject,
    html,
  });
};
