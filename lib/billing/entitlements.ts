import type Stripe from 'stripe';

import { ApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { getByTeamId } from 'models/subscription';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
]);

type EntitlementValues = {
  features: Record<string, boolean>;
  limits: Record<string, number>;
};

export type TeamEntitlements = EntitlementValues & {
  planIds: string[];
  sources: string[];
};

type EntitlementRequirement = {
  feature?: string;
  limit?: {
    key: string;
    minimum?: number;
  };
};

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const emptyEntitlements = (): TeamEntitlements => ({
  features: {},
  limits: {},
  planIds: [],
  sources: [],
});

const parseMetadataEntitlements = (
  metadata: Stripe.Metadata | null | undefined
): EntitlementValues => {
  const entitlements: EntitlementValues = {
    features: {},
    limits: {},
  };

  if (!metadata) {
    return entitlements;
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
          entitlements.features[feature] = true;
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
            entitlements.limits[normalizeKey(limitKey)] = parsed;
          }
        });
      continue;
    }

    if (key.startsWith('feature_')) {
      const featureKey = normalizeKey(key.replace('feature_', ''));
      entitlements.features[featureKey] =
        rawValue === 'true' || rawValue === '1' || rawValue === 'yes';
      continue;
    }

    if (key.startsWith('limit_')) {
      const limitKey = normalizeKey(key.replace('limit_', ''));
      const parsed = Number(rawValue);
      if (!Number.isNaN(parsed)) {
        entitlements.limits[limitKey] = parsed;
      }
    }
  }

  return entitlements;
};

const parseServiceEntitlements = (
  service: { features: string[]; metadata?: unknown } | null
) => {
  const entitlements: EntitlementValues = {
    features: {},
    limits: {},
  };

  if (!service) {
    return entitlements;
  }

  service.features
    .map((feature) => normalizeKey(feature))
    .filter(Boolean)
    .forEach((feature) => {
      entitlements.features[feature] = true;
    });

  if (service.metadata && typeof service.metadata === 'object') {
    const metadata = service.metadata as {
      featureFlags?: Record<string, boolean>;
      limits?: Record<string, number>;
    };

    if (metadata.featureFlags) {
      for (const [feature, enabled] of Object.entries(metadata.featureFlags)) {
        if (enabled) {
          entitlements.features[normalizeKey(feature)] = true;
        }
      }
    }

    if (metadata.limits) {
      for (const [limitKey, limitValue] of Object.entries(metadata.limits)) {
        const parsed = Number(limitValue);
        if (!Number.isNaN(parsed)) {
          entitlements.limits[normalizeKey(limitKey)] = parsed;
        }
      }
    }
  }

  return entitlements;
};

const mergeEntitlements = (
  base: TeamEntitlements,
  incoming: EntitlementValues,
  planId: string | null,
  source: string
) => {
  for (const [feature, enabled] of Object.entries(incoming.features)) {
    base.features[feature] = base.features[feature] || enabled;
  }

  for (const [limitKey, limitValue] of Object.entries(incoming.limits)) {
    const existing = base.limits[limitKey];
    base.limits[limitKey] =
      existing === undefined ? limitValue : Math.max(existing, limitValue);
  }

  if (planId) {
    base.planIds.push(planId);
  }

  if (!base.sources.includes(source)) {
    base.sources.push(source);
  }
};

const getEntitlementsFromStripeProduct = async (productId: string) => {
  try {
    const product = await stripe.products.retrieve(productId);
    return parseMetadataEntitlements(product.metadata);
  } catch (error) {
    console.error(`Failed to retrieve Stripe product ${productId}:`, error);
    return null;
  }
};

const getEntitlementsFromDatabasePlan = async (
  productId: string | null,
  priceId: string | null
) => {
  try {
    let serviceId = productId ?? null;

    if (!serviceId && priceId) {
      const price = await prisma.price.findUnique({
        where: { id: priceId },
        select: { serviceId: true },
      });
      serviceId = price?.serviceId ?? null;
    }

    if (!serviceId) {
      return null;
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { features: true, metadata: true },
    });

    return parseServiceEntitlements(service);
  } catch (error) {
    console.error(
      `Failed to retrieve database plan for product=${productId}, price=${priceId}:`,
      error
    );
    return null;
  }
};

export const getTeamEntitlements = async (
  teamId: string
): Promise<TeamEntitlements> => {
  const entitlements = emptyEntitlements();

  const subscriptions = await getByTeamId(teamId);
  const activeSubscriptions = subscriptions.filter((subscription) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
  );

  if (activeSubscriptions.length === 0) {
    return entitlements;
  }

  const results = await Promise.all(
    activeSubscriptions.map(async (subscription) => {
      const { productId, priceId } = subscription;
      let planEntitlements: EntitlementValues | null = null;
      let source = 'database';

      if (productId) {
        const stripeEntitlements =
          await getEntitlementsFromStripeProduct(productId);
        if (
          stripeEntitlements &&
          (Object.keys(stripeEntitlements.features).length > 0 ||
            Object.keys(stripeEntitlements.limits).length > 0)
        ) {
          planEntitlements = stripeEntitlements;
          source = 'stripe';
        }
      }

      if (!planEntitlements) {
        planEntitlements = await getEntitlementsFromDatabasePlan(
          productId,
          priceId
        );
      }

      return { planEntitlements, productId, source };
    })
  );

  for (const { planEntitlements, productId, source } of results) {
    if (!planEntitlements) {
      continue;
    }

    mergeEntitlements(entitlements, planEntitlements, productId, source);
  }

  return entitlements;
};

export const requireTeamEntitlement = async (
  teamId: string,
  requirement: EntitlementRequirement
) => {
  const entitlements = await getTeamEntitlements(teamId);

  if (requirement.feature) {
    const featureKey = normalizeKey(requirement.feature);
    if (!entitlements.features[featureKey]) {
      throw new ApiError(
        403,
        `Plan does not include required feature: ${requirement.feature}`
      );
    }
  }

  if (requirement.limit) {
    const limitKey = normalizeKey(requirement.limit.key);
    const limitValue = entitlements.limits[limitKey];
    if (
      requirement.limit.minimum !== undefined &&
      (limitValue === undefined || limitValue < requirement.limit.minimum)
    ) {
      throw new ApiError(
        403,
        `Plan limit insufficient for ${requirement.limit.key}`
      );
    }
  }

  return entitlements;
};

export const hasTeamEntitlement = async (
  teamId: string,
  requirement: EntitlementRequirement
) => {
  try {
    await requireTeamEntitlement(teamId, requirement);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return false;
    }
    throw error;
  }
};
