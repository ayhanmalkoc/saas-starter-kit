import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import type { Prisma, Price, Service } from '@prisma/client';

export const getAllPrices = async () => {
  return await prisma.price.findMany();
};

const buildPriceData = (price: Stripe.Price) => {
  const serviceId =
    typeof price.product === 'string' ? price.product : price.product.id;

  const recurringMetadata = price.recurring
    ? (JSON.parse(JSON.stringify(price.recurring)) as Prisma.InputJsonValue)
    : null;

  return {
    id: price.id,
    billingScheme: price.billing_scheme,
    currency: price.currency,
    serviceId,
    amount: price.unit_amount ? price.unit_amount / 100 : undefined,
    metadata: {
      ...price.metadata,
      recurring: recurringMetadata,
    },
    type: price.type,
    created: new Date(price.created * 1000),
  };
};

export const buildPriceUpsert = (
  price: Stripe.Price
): Prisma.PrismaPromise<Price> => {
  const data = buildPriceData(price);
  return prisma.price.upsert({
    where: { id: price.id },
    create: data,
    update: data,
  });
};

export const upsertPriceFromStripe = async (price: Stripe.Price) => {
  return await buildPriceUpsert(price);
};

export const getServiceByPriceId = async (
  priceId: string
): Promise<Service | undefined> => {
  const data = await prisma.price.findUnique({
    where: {
      id: priceId,
    },
    include: {
      service: true,
    },
  });
  return data?.service;
};
