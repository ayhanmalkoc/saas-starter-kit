import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { findOrCreateApp } from '@/lib/svix';

export const user = {
  name: 'Jackson',
  email: 'jackson@example.com',
  password: 'password',
} as const;

export const project = {
  name: 'Example',
  slug: 'example',
} as const;

export const secondProject = {
  name: 'BoxyHQ',
  slug: 'boxyhq',
} as const;

const e2eDefaultPlan = {
  name: 'Free',
  description: 'E2E default plan',
  features: [
    'sso',
    'directory_sync',
    'webhooks',
    'api_keys',
    'project_audit_log',
  ],
  metadata: {
    isDefault: true,
    tier: 'business',
    planLevel: 0,
    limits: {
      project_members: 100,
    },
  },
} as const;

const clearJacksonArtifacts = async () => {
  try {
    await prisma.$executeRawUnsafe('DELETE FROM "jackson_index"');
    await prisma.$executeRawUnsafe('DELETE FROM "jackson_ttl"');
    await prisma.$executeRawUnsafe('DELETE FROM "jackson_store"');
  } catch (error) {
    // e2e cleanup should not fail hard if Jackson tables are unavailable.
    console.warn(
      'Unable to clear Jackson artifacts during e2e cleanup.',
      error
    );
  }
};

export async function cleanup() {
  await prisma.projectMember.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.price.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.project.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.service.deleteMany();
  await prisma.account.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await clearJacksonArtifacts();
  await prisma.$disconnect();
}

export async function seedDefaultAccount() {
  const passwordHash = await hash(user.password, 12);

  await prisma.service.create({
    data: {
      name: e2eDefaultPlan.name,
      description: e2eDefaultPlan.description,
      image: '/images/plan-free.png',
      features: e2eDefaultPlan.features,
      metadata: e2eDefaultPlan.metadata,
      created: new Date(),
    },
  });

  const createdUser = await prisma.user.create({
    data: {
      name: user.name,
      email: user.email,
      password: passwordHash,
      emailVerified: new Date(),
    },
  });

  const organization = await prisma.organization.create({
    data: {
      name: project.name,
      slug: project.slug,
    },
  });

  const project = await prisma.project.create({
    data: {
      organizationId: organization.id,
      name: project.name,
      slug: 'default',
    },
  });

  await findOrCreateApp(project.name, project.id);

  await prisma.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId: createdUser.id,
      role: Role.OWNER,
    },
  });

  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: createdUser.id,
      role: Role.OWNER,
    },
  });
}
