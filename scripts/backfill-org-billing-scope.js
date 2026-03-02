const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

async function main() {
  console.log(
    'Backfilling missing subscription organization scope from canonical project relation...'
  );

  const subscriptionsToRepair = await db.subscription.findMany({
    where: {
      organizationId: null,
      projectId: { not: null },
      project: { isNot: null },
    },
    select: {
      id: true,
      project: {
        select: {
          organizationId: true,
        },
      },
    },
  });

  let updatedSubscriptions = 0;

  for (const subscription of subscriptionsToRepair) {
    const organizationId = subscription.project?.organizationId;
    if (!organizationId) {
      continue;
    }

    await db.subscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        organizationId,
      },
    });

    updatedSubscriptions += 1;
  }

  const invoicesWithoutOrganization = await db.invoice.count({
    where: {
      organizationId: null,
    },
  });

  if (invoicesWithoutOrganization > 0) {
    console.warn(
      `Found ${invoicesWithoutOrganization} invoice rows without organization scope. Manual remediation may be required.`
    );
  }

  console.log(
    `Backfill complete. Updated subscriptions: ${updatedSubscriptions}, invoices_without_organization: ${invoicesWithoutOrganization}`
  );
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
