import { prisma } from '@/lib/prisma';
import { Prisma, Subscription } from '@prisma/client';

export const createStripeSubscription = async ({
  id,
  teamId,
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
}: {
  id: string;
  teamId: string;
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
}) => {
  return await prisma.subscription.create({
    data: {
      id,
      teamId,
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
    },
  });
};

export const upsertStripeSubscription = async ({
  id,
  teamId,
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
}: {
  id: string;
  teamId: string;
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
}) => {
  return await prisma.subscription.upsert({
    where: {
      id,
    },
    create: {
      id,
      teamId,
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
    },
    update: {
      teamId,
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
    },
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
