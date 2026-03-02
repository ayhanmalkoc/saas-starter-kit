export {};

const { faker } = require('@faker-js/faker');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const { randomUUID } = require('crypto');

const client = new PrismaClient();

const USER_COUNT = 10;
const ORGANIZATION_COUNT = 5;
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin@123';
const USER_EMAIL = 'user@example.com';
const USER_PASSWORD = 'user@123';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

async function seedUsers() {
  const seededUsers: any[] = [];

  await createUser(ADMIN_EMAIL, ADMIN_PASSWORD);
  await createUser(USER_EMAIL, USER_PASSWORD);

  for (let i = 0; i < USER_COUNT; i += 1) {
    await createUser(`user+${i}@example.com`);
  }

  console.log('Seeded users', seededUsers.length);
  return seededUsers;

  async function createUser(email: string, plainPassword?: string) {
    try {
      const originalPassword = plainPassword || faker.internet.password();
      const password = await hash(originalPassword, 12);

      const user = await client.user.create({
        data: {
          email,
          name: faker.person.firstName(),
          password,
          emailVerified: new Date(),
        },
      });

      seededUsers.push({
        ...user,
        password: originalPassword,
      });
    } catch (error: any) {
      if (String(error?.message || '').includes('Unique constraint failed')) {
        console.error('Duplicate email', email);
      } else {
        console.error(error);
      }
    }
  }
}

async function seedOrganizationsWithProjects(users: any[]) {
  const seededOrganizations: any[] = [];
  const seededProjects: any[] = [];

  for (let index = 0; index < ORGANIZATION_COUNT; index += 1) {
    const organizationName = faker.company.name();
    const organizationSlug = slugify(`${organizationName}-${index}`);

    const organization = await client.organization.create({
      data: {
        name: organizationName,
        slug: organizationSlug,
      },
    });

    const project = await client.project.create({
      data: {
        organizationId: organization.id,
        name: organizationName,
        slug: 'default',
      },
    });

    seededOrganizations.push(organization);
    seededProjects.push(project);

    const memberCount = Math.min(
      users.length,
      2 + Math.floor(Math.random() * Math.max(2, users.length - 1))
    );

    const shuffledUsers = [...users].sort(() => Math.random() - 0.5);
    const selectedUsers = shuffledUsers.slice(0, memberCount);

    await client.organizationMember.createMany({
      data: selectedUsers.map((user, position) => ({
        organizationId: organization.id,
        userId: user.id,
        role: position === 0 ? 'OWNER' : 'MEMBER',
      })),
      skipDuplicates: true,
    });

    await client.projectMember.createMany({
      data: selectedUsers.map((user, position) => ({
        projectId: project.id,
        userId: user.id,
        role: position === 0 ? 'OWNER' : 'MEMBER',
      })),
      skipDuplicates: true,
    });
  }

  console.log('Seeded organizations', seededOrganizations.length);
  console.log('Seeded projects', seededProjects.length);

  return {
    organizations: seededOrganizations,
    projects: seededProjects,
  };
}

async function seedInvitations(projects: any[], users: any[]) {
  const seededInvitations: any[] = [];

  for (const project of projects) {
    const invitationCount = Math.floor(Math.random() * users.length) + 1;

    for (let index = 0; index < invitationCount; index += 1) {
      const invitedBy = users[Math.floor(Math.random() * users.length)];
      if (!invitedBy) {
        continue;
      }

      try {
        const invitation = await client.invitation.create({
          data: {
            organizationId: project.organizationId,
            projectId: project.id,
            invitedBy: invitedBy.id,
            email: faker.internet.email(),
            role: 'MEMBER',
            sentViaEmail: true,
            token: randomUUID(),
            allowedDomains: [],
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        seededInvitations.push(invitation);
      } catch (error) {
        console.error(error);
      }
    }
  }

  console.log('Seeded invitations', seededInvitations.length);
  return seededInvitations;
}

async function init() {
  const users = await seedUsers();
  const { projects } = await seedOrganizationsWithProjects(users);
  await seedInvitations(projects, users);
}

init()
  .catch((error: unknown) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await client.$disconnect();
  });
