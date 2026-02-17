import type { Prisma } from '@prisma/client';

import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const asJsonObject = (value: unknown): Prisma.JsonObject | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }

  return null;
};

export const getServiceTier = (metadata: unknown) => {
  const metadataObject = asJsonObject(metadata);
  const rawTier = metadataObject?.tier;

  if (typeof rawTier !== 'string') {
    return null;
  }

  const normalizedTier = normalizeKey(rawTier);
  return normalizedTier || null;
};

export const isBusinessService = (metadata: unknown) =>
  getServiceTier(metadata) === 'business';

export const assertBusinessTierPrice = async (priceId: string) => {
  const price = await prisma.price.findUnique({
    where: { id: priceId },
    select: {
      id: true,
      service: {
        select: {
          id: true,
          name: true,
          metadata: true,
        },
      },
    },
  });

  if (!price || !price.service) {
    throw new ApiError(
      422,
      'Price not found in local catalog. Run `npm run setup:stripe` first.'
    );
  }

  if (!isBusinessService(price.service.metadata)) {
    throw new ApiError(
      422,
      'Team billing endpoints only support business tier plans.'
    );
  }

  return {
    priceId: price.id,
    serviceId: price.service.id,
    serviceName: price.service.name,
  };
};
