import { prisma } from '@/lib/prisma';
import { Prisma, Subscription } from '@prisma/client';

export const BLOCKING_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'incomplete',
  'unpaid',
]);

type StripeSubscriptionInput = {
  id: string;
  teamId: string;
  organizationId?: string | null;
  projectId?: string | null;
  customerId: string;
  status: string;
  quantity?: number | null;
  currency?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: Date | null;
  priceId?: string | null;
  productId?: string | null;
};

const buildStripeSubscriptionData = ({
  teamId,
  organizationId,
  projectId,
  customerId,
  status,
  quantity,
  currency,
  currentPeriodStart,
  currentPeriodEnd,
  cancelAt,
  cancelAtPeriodEnd,
  trialEnd,
  priceId,
  productId,
}: Omit<StripeSubscriptionInput, 'id'>) => {
  return {
    teamId,
    organizationId: organizationId ?? null,
    projectId: projectId ?? null,
    customerId,
    status,
    quantity,
    currency,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAt,
    cancelAtPeriodEnd,
    trialEnd,
    priceId,
    productId,
  };
};

export const createStripeSubscription = async (
  input: StripeSubscriptionInput
) => {
  return await prisma.subscription.create({
    data: {
      id: input.id,
      ...buildStripeSubscriptionData(input),
    },
  });
};

export const upsertStripeSubscription = async (
  input: StripeSubscriptionInput
) => {
  const data = buildStripeSubscriptionData(input);

  return await prisma.subscription.upsert({
    where: {
      id: input.id,
    },
    create: {
      id: input.id,
      ...data,
    },
    update: data,
  });
};

export const deleteStripeSubscription = async (id: string) => {
  return await prisma.subscription.deleteMany({
    where: {
      id,
    },
  });
};

export const updateStripeSubscription = async (
  id: string,
  data: Prisma.SubscriptionUpdateInput
) => {
  return await prisma.subscription.update({
    where: {
      id,
    },
    data,
  });
};

export const getByTeamId = async (teamId: string) => {
  return await prisma.subscription.findMany({
    where: {
      teamId,
    },
  });
};

export const getByOrganizationId = async (organizationId: string) => {
  return await prisma.subscription.findMany({
    where: {
      organizationId,
    },
  });
};

export const getByBillingScope = async ({
  teamId,
  organizationId,
}: {
  teamId: string;
  organizationId?: string | null;
}) => {
  if (organizationId) {
    return await getByOrganizationId(organizationId);
  }

  return await getByTeamId(teamId);
};

const sortByMostRecent = (a: Subscription, b: Subscription) => {
  const aPeriod = a.currentPeriodEnd?.getTime() ?? 0;
  const bPeriod = b.currentPeriodEnd?.getTime() ?? 0;

  if (aPeriod !== bPeriod) {
    return bPeriod - aPeriod;
  }

  return b.updatedAt.getTime() - a.updatedAt.getTime();
};

export const getBlockingByBillingScope = async ({
  teamId,
  organizationId,
}: {
  teamId: string;
  organizationId?: string | null;
}) => {
  const subscriptions = await getByBillingScope({
    teamId,
    organizationId,
  });

  return subscriptions
    .filter((subscription) =>
      BLOCKING_SUBSCRIPTION_STATUSES.has(subscription.status)
    )
    .sort(sortByMostRecent);
};

export const getByCustomerId = async (customerId: string) => {
  return await prisma.subscription.findMany({
    where: {
      customerId,
    },
  });
};

export const getBySubscriptionId = async (
  subscriptionId: string
): Promise<Subscription | null> => {
  return await prisma.subscription.findUnique({
    where: {
      id: subscriptionId,
    },
  });
};
