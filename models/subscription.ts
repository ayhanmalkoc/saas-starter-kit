import { prisma } from '@/lib/prisma';
import { Prisma, Subscription } from '@prisma/client';

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
    return await prisma.subscription.findMany({
      where: {
        OR: [{ organizationId }, { teamId }],
      },
    });
  }

  return await getByTeamId(teamId);
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
