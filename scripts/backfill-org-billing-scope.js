const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

async function main() {
  console.log('Backfilling organization/project scope on subscriptions/invoices...');

  const teams = await db.team.findMany({
    where: {
      organizationId: {
        not: null,
      },
    },
    select: {
      id: true,
      organizationId: true,
      projectId: true,
    },
  });

  let updatedSubscriptions = 0;
  let updatedInvoices = 0;

  for (const team of teams) {
    if (!team.organizationId) {
      continue;
    }

    const subResult = await db.subscription.updateMany({
      where: {
        teamId: team.id,
        organizationId: null,
      },
      data: {
        organizationId: team.organizationId,
        projectId: team.projectId ?? null,
      },
    });
    updatedSubscriptions += subResult.count;

    const invoiceResult = await db.invoice.updateMany({
      where: {
        teamId: team.id,
        organizationId: null,
      },
      data: {
        organizationId: team.organizationId,
      },
    });
    updatedInvoices += invoiceResult.count;
  }

  console.log(
    `Backfill complete. Updated subscriptions: ${updatedSubscriptions}, updated invoices: ${updatedInvoices}`
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
