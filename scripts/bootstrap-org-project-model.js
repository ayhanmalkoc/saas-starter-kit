/**
 * Org/project model bootstrap script.
 *
 * Legacy workspace aliasing has been fully removed from the data model.
 * This script is intentionally a no-op guard kept for setup pipelines.
 */
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

async function main() {
  const [organizationCount, projectCount] = await Promise.all([
    db.organization.count(),
    db.project.count(),
  ]);

  console.log(
    `Org/project model already native. organizations=${organizationCount}, projects=${projectCount}. No bootstrap action required.`
  );
}

main()
  .catch((error) => {
    console.error('Org/project bootstrap check failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
