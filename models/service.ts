import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import type { Prisma, Service } from '@prisma/client';

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

type PlanMetadata = {
  featureFlags: Record<string, boolean>;
  limits: Record<string, number>;
};

const parsePlanMetadata = (
  metadata: Stripe.Metadata | null | undefined
): PlanMetadata & { features: string[] } => {
  const featureFlags: Record<string, boolean> = {};
  const limits: Record<string, number> = {};
  const features = new Set<string>();

  if (!metadata) {
    return { featureFlags, limits, features: [] };
  }

  for (const [rawKey, rawValue] of Object.entries(metadata)) {
    if (!rawValue) {
      continue;
    }

    const key = normalizeKey(rawKey);

    if (key === 'features') {
      rawValue
        .split(',')
        .map((item) => normalizeKey(item))
        .filter(Boolean)
        .forEach((feature) => {
          features.add(feature);
          featureFlags[feature] = true;
        });
      continue;
    }

    if (key === 'limits') {
      rawValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((entry) => {
          const eqIndex = entry.indexOf('=');
          if (eqIndex === -1) {
            return;
          }
          const limitKey = entry.slice(0, eqIndex);
          const limitValue = entry.slice(eqIndex + 1);
          const parsed = Number(limitValue);
          if (!Number.isNaN(parsed)) {
            limits[normalizeKey(limitKey)] = parsed;
          }
        });
      continue;
    }

    if (key.startsWith('feature_')) {
      const featureKey = normalizeKey(key.replace('feature_', ''));
      const enabled =
        rawValue === 'true' || rawValue === '1' || rawValue === 'yes';
      featureFlags[featureKey] = enabled;
      if (enabled) {
        features.add(featureKey);
      }
      continue;
    }

    if (key.startsWith('limit_')) {
      const limitKey = normalizeKey(key.replace('limit_', ''));
      const parsed = Number(rawValue);
      if (!Number.isNaN(parsed)) {
        limits[limitKey] = parsed;
      }
    }
  }

  return { featureFlags, limits, features: Array.from(features) };
};

const buildServiceData = (product: Stripe.Product) => {
  const { featureFlags, limits, features } = parsePlanMetadata(
    product.metadata
  );
  const mergedFeatures = features;

  return {
    id: product.id,
    description: product.description || '',
    features: mergedFeatures,
    image: product.images.length > 0 ? product.images[0] : '',
    metadata: { featureFlags, limits },
    name: product.name,
    created: new Date(product.created * 1000),
  };
};

export const buildServiceUpsert = (
  product: Stripe.Product
): Prisma.PrismaPromise<Service> => {
  const data = buildServiceData(product);
  return prisma.service.upsert({
    where: { id: product.id },
    create: data,
    update: data,
  });
};

export const upsertServiceFromStripe = async (product: Stripe.Product) => {
  return await buildServiceUpsert(product);
};

export const getAllServices = async () => {
  return await prisma.service.findMany();
};
