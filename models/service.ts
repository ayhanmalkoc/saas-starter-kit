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
  tier?: string;
  recommended?: boolean;
};

const parsePlanMetadata = (
  metadata: Stripe.Metadata | null | undefined
): PlanMetadata & { features: string[] } => {
  const featureFlags: Record<string, boolean> = {};
  const limits: Record<string, number> = {};
  const features = new Set<string>();
  let tier: string | undefined;
  let recommended: boolean | undefined;

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

    if (key === 'tier') {
      tier = rawValue;
      continue;
    }

    if (key === 'recommended') {
      recommended = rawValue === 'true';
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

  return {
    featureFlags,
    limits,
    features: Array.from(features),
    tier,
    recommended,
  };
};

const buildServiceData = (product: Stripe.Product) => {
  const { featureFlags, limits, features, tier, recommended } =
    parsePlanMetadata(product.metadata);
  const mergedFeatures = features;

  return {
    id: product.id,
    description: product.description || '',
    features: mergedFeatures,
    image: product.images.length > 0 ? product.images[0] : '',
    metadata: { featureFlags, limits, tier, recommended },
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
  const services = await prisma.service.findMany({
    include: {
      Price: true,
    },
  });
  return services
    .filter((service) => {
      const metadata = service.metadata as any;
      return metadata?.tier;
    })
    .map((service) => ({
      ...service,
      prices: service.Price,
    }))
    .sort((a, b) => {
      const priceA = a.prices[0]?.amount || 0;
      const priceB = b.prices[0]?.amount || 0;
      return priceA - priceB;
    });
};
