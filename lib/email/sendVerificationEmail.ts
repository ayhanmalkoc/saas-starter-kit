import type { User, VerificationToken } from '@prisma/client';
import { sendEmail } from './sendEmail';
import { render } from '@react-email/components';
import { VerificationEmail } from '@/components/emailTemplates';
import app from '../app';
import env from '../env';

export const sendVerificationEmail = async ({
  user,
  verificationToken,
  callbackUrl,
}: {
  user: User;
  verificationToken: VerificationToken;
  callbackUrl?: string;
}) => {
  const subject = `Confirm your ${app.name} account`;
  let verificationLink = `${
    env.appUrl
  }/auth/verify-email-token?token=${encodeURIComponent(
    verificationToken.token
  )}`;

  if (callbackUrl) {
    verificationLink += `&callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }

  const html = await render(VerificationEmail({ subject, verificationLink }));

  await sendEmail({
    to: user.email,
    subject,
    html,
  });
};
