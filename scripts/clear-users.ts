/**
 * This script clears all users and org/project membership data from the database,
 * effectively resetting tenant data while keeping Stripe products/prices.
 */
import { prisma } from '../lib/prisma';
import readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.FORCE_CLEAR !== 'true'
  ) {
    console.error(
      'CRITICAL: Cannot run clear-users in production unless FORCE_CLEAR=true'
    );
    process.exit(1);
  }

  const answer = await new Promise((resolve) => {
    rl.question(
      'WARNING: This will delete ALL users, organizations, projects, and memberships. Are you sure? (y/N) ',
      resolve
    );
  });

  if (String(answer).toLowerCase() !== 'y') {
    console.log('Aborted.');
    process.exit(0);
  }

  console.log('Clearing all users, organizations, and projects...');

  try {
    // Delete Invitations
    await prisma.invitation.deleteMany({});
    console.log('Deleted invitations.');

    // Delete API keys
    await prisma.apiKey.deleteMany({});
    console.log('Deleted API keys.');

    // Delete project and organization memberships
    await prisma.projectMember.deleteMany({});
    console.log('Deleted project members.');

    await prisma.organizationMember.deleteMany({});
    console.log('Deleted organization members.');

    // Delete billing records scoped to organizations/projects
    await prisma.subscription.deleteMany({});
    console.log('Deleted subscriptions.');

    await prisma.invoice.deleteMany({});
    console.log('Deleted invoices.');

    // Delete projects and organizations
    await prisma.project.deleteMany({});
    console.log('Deleted projects.');

    await prisma.organization.deleteMany({});
    console.log('Deleted organizations.');

    // Delete Users
    await prisma.user.deleteMany({});
    console.log('Deleted users.');

    console.log('User data cleared successfully.');
  } catch (error) {
    console.error('Failed to clear data', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
