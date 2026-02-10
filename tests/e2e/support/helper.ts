import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';

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

export async function seedDefaultAccount() {
  const passwordHash = await hash(user.password, 12);

  const createdUser = await prisma.user.create({
    data: {
      name: user.name,
      email: user.email,
      password: passwordHash,
      emailVerified: new Date(),
    },
  });

  const createdTeam = await prisma.team.create({
    data: {
      name: team.name,
      slug: team.slug,
    },
  });

  await prisma.teamMember.create({
    data: {
      teamId: createdTeam.id,
      userId: createdUser.id,
      role: Role.OWNER,
    },
  });
}
