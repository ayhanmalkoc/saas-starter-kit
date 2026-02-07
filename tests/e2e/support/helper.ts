import { prisma } from '@/lib/prisma';

export const user = {
  name: 'Jackson',
  email: 'jackson@example.com',
  password: 'password',
} as const;

export const team = {
  name: 'Example',
  slug: 'example',
} as const;

export const secondTeam = {
  name: 'BoxyHQ',
  slug: 'boxyhq',
} as const;

export async function cleanup() {
  await prisma.teamMember.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.team.deleteMany();
  await prisma.account.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
}
