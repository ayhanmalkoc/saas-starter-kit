/**
 * This script clears all users and teams from the database,
 * effectively resetting user data while keeping Stripe products/prices.
 */
import { prisma } from '../lib/prisma';

async function main() {
  console.log('Clearing all users and teams...');

  try {
    // Delete all users. Cascade should handle TeamMembers, Invitations, etc.
    // However, Teams might need explicit deletion if not cascaded from users (Teams have owners).
    // Let's delete Teams first? No, Users are owners.
    // Let's delete everything in order.

    // Delete Invitations
    await prisma.invitation.deleteMany({});
    console.log('Deleted invitations.');

    // Delete TeamMembers
    await prisma.teamMember.deleteMany({});
    console.log('Deleted team members.');

    // Delete Teams
    await prisma.team.deleteMany({});
    console.log('Deleted teams.');

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
