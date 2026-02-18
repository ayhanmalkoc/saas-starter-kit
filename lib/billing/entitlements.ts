import type Stripe from 'stripe';
import type { Subscription } from '@prisma/client';

import { ApiError } from '@/lib/errors';
import env from '@/lib/env';
import { resolveBillingScopeFromTeamId } from '@/lib/billing/scope';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { getByBillingScope } from 'models/subscription';

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

const featureAliasMap: Record<string, string> = {
  webhook: 'webhooks',
  team_webhook: 'webhooks',
  dsync: 'directory_sync',
  team_dsync: 'directory_sync',
  audit_logs: 'team_audit_log',
  team_audit_logs: 'team_audit_log',
  api_key: 'api_keys',
  team_api_key: 'api_keys',
};

const normalizeFeatureKey = (value: string) => {
  const normalized = normalizeKey(value);
  return featureAliasMap[normalized] || normalized;
};

const emptyEntitlements = (): TeamEntitlements => ({
  features: {},
  limits: {},
  planIds: [],
  sources: [],
});

const emptyEntitlementValues = (): EntitlementValues => ({
  features: {},
  limits: {},
});

const TEAM_MEMBER_LIMIT_KEY = normalizeKey('team_members');

type ServiceMetadata = {
  featureFlags: Record<string, boolean>;
  limits: Record<string, number>;
  tier?: string;
  planLevel?: number;
  inherits: string[];
  isDefault: boolean;
};

type BillingService = {
  id: string;
  name: string;
  features: string[];
  metadata?: unknown;
};

const parseBoolean = (value: unknown) =>
  value === true ||
  value === 'true' ||
  value === '1' ||
  value === 'yes' ||
  value === 'on';

const parseServiceMetadata = (metadata: unknown): ServiceMetadata => {
  const parsed: ServiceMetadata = {
    featureFlags: {},
    limits: {},
    inherits: [],
    isDefault: false,
  };

  if (!metadata || typeof metadata !== 'object') {
    return parsed;
  }

  const record = metadata as Record<string, unknown>;

  if (record.tier && typeof record.tier === 'string') {
    parsed.tier = normalizeKey(record.tier);
  }

  const planLevelRaw = record.planLevel ?? record.plan_level;
  if (planLevelRaw !== undefined) {
    const n = Number(planLevelRaw);
    if (!Number.isNaN(n)) {
      parsed.planLevel = n;
    }
  }

  const inheritsRaw = record.inherits;
  if (typeof inheritsRaw === 'string') {
    parsed.inherits = inheritsRaw
      .split(',')
      .map((item) => normalizeKey(item))
      .filter(Boolean);
  } else if (Array.isArray(inheritsRaw)) {
    parsed.inherits = inheritsRaw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => normalizeKey(item))
      .filter(Boolean);
  }

  parsed.isDefault = parseBoolean(
    record.isDefault ?? record.is_default ?? record.default
  );

  const featureFlagsRaw = record.featureFlags;
  if (featureFlagsRaw && typeof featureFlagsRaw === 'object') {
    for (const [feature, enabled] of Object.entries(
      featureFlagsRaw as Record<string, unknown>
    )) {
      if (parseBoolean(enabled)) {
        parsed.featureFlags[normalizeFeatureKey(feature)] = true;
      }
    }
  }

  const limitsRaw = record.limits;
  if (limitsRaw && typeof limitsRaw === 'object') {
    for (const [limitKey, limitValue] of Object.entries(
      limitsRaw as Record<string, unknown>
    )) {
      const parsedValue = Number(limitValue);
      if (!Number.isNaN(parsedValue)) {
        parsed.limits[normalizeKey(limitKey)] = parsedValue;
      }
    }
  }

  return parsed;
};

const parseMetadataEntitlements = (
  metadata: Stripe.Metadata | null | undefined
): EntitlementValues => {
  const entitlements = emptyEntitlementValues();

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
        .map((item) => normalizeFeatureKey(item))
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
      const featureKey = normalizeFeatureKey(key.replace('feature_', ''));
      entitlements.features[featureKey] = parseBoolean(rawValue);
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
  service: Pick<BillingService, 'features' | 'metadata'> | null
) => {
  const entitlements = emptyEntitlementValues();

  if (!service) {
    return entitlements;
  }

  service.features
    .map((feature) => normalizeFeatureKey(feature))
    .filter(Boolean)
    .forEach((feature) => {
      entitlements.features[feature] = true;
    });

  const metadata = parseServiceMetadata(service.metadata);
  for (const [feature, enabled] of Object.entries(metadata.featureFlags)) {
    if (enabled) {
      entitlements.features[feature] = true;
    }
  }

  for (const [limitKey, limitValue] of Object.entries(metadata.limits)) {
    const parsed = Number(limitValue);
    if (!Number.isNaN(parsed)) {
      entitlements.limits[normalizeKey(limitKey)] = parsed;
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
    if (!base.planIds.includes(planId)) {
      base.planIds.push(planId);
    }
  }

  if (!base.sources.includes(source)) {
    base.sources.push(source);
  }
};

const mergeEntitlementValues = (
  base: EntitlementValues,
  incoming: EntitlementValues
) => {
  for (const [feature, enabled] of Object.entries(incoming.features)) {
    base.features[feature] = base.features[feature] || enabled;
  }

  for (const [limitKey, limitValue] of Object.entries(incoming.limits)) {
    const existing = base.limits[limitKey];
    base.limits[limitKey] =
      existing === undefined ? limitValue : Math.max(existing, limitValue);
  }
};

const applySubscriptionQuantityToEntitlements = (
  entitlements: EntitlementValues,
  subscription: Pick<Subscription, 'quantity'>
) => {
  const quantity = subscription.quantity ?? 1;
  const teamMemberLimit = entitlements.limits[TEAM_MEMBER_LIMIT_KEY];

  if (
    !Number.isFinite(quantity) ||
    quantity <= 1 ||
    teamMemberLimit === undefined
  ) {
    return entitlements;
  }

  return {
    features: { ...entitlements.features },
    limits: {
      ...entitlements.limits,
      [TEAM_MEMBER_LIMIT_KEY]: teamMemberLimit * quantity,
    },
  };
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

const buildServiceNameMap = (services: BillingService[]) => {
  const map = new Map<string, BillingService>();
  for (const service of services) {
    map.set(normalizeKey(service.name), service);
  }

  return map;
};

const resolveInheritedPlanIds = (
  service: BillingService,
  services: BillingService[],
  serviceById: Map<string, BillingService>,
  serviceByName: Map<string, BillingService>
) => {
  const metadata = parseServiceMetadata(service.metadata);

  if (metadata.inherits.length > 0) {
    return metadata.inherits
      .map((rawRef) => {
        const byId = serviceById.get(rawRef);
        if (byId) {
          return byId.id;
        }

        const byName = serviceByName.get(rawRef);
        return byName?.id;
      })
      .filter((id): id is string => Boolean(id));
  }

  if (metadata.planLevel === undefined || !metadata.tier) {
    return [];
  }

  const currentPlanLevel = metadata.planLevel;
  const currentTier = metadata.tier;

  return services
    .filter((candidate) => {
      if (candidate.id === service.id) {
        return false;
      }

      const candidateMetadata = parseServiceMetadata(candidate.metadata);

      return (
        candidateMetadata.tier === currentTier &&
        candidateMetadata.planLevel !== undefined &&
        candidateMetadata.planLevel < currentPlanLevel
      );
    })
    .sort((a, b) => {
      const aLevel = parseServiceMetadata(a.metadata).planLevel ?? -1;
      const bLevel = parseServiceMetadata(b.metadata).planLevel ?? -1;
      return aLevel - bLevel;
    })
    .map((candidate) => candidate.id);
};

const resolveServiceEntitlements = (
  serviceId: string,
  services: BillingService[],
  serviceById: Map<string, BillingService>,
  serviceByName: Map<string, BillingService>,
  cache: Map<string, EntitlementValues>,
  stack: Set<string>
) => {
  const cached = cache.get(serviceId);
  if (cached) {
    return cached;
  }

  if (stack.has(serviceId)) {
    return emptyEntitlementValues();
  }

  const service = serviceById.get(serviceId);
  if (!service) {
    return emptyEntitlementValues();
  }

  stack.add(serviceId);

  const merged = parseServiceEntitlements(service);
  const inheritedPlanIds = resolveInheritedPlanIds(
    service,
    services,
    serviceById,
    serviceByName
  );

  for (const inheritedPlanId of inheritedPlanIds) {
    const inherited = resolveServiceEntitlements(
      inheritedPlanId,
      services,
      serviceById,
      serviceByName,
      cache,
      stack
    );
    mergeEntitlementValues(merged, inherited);
  }

  stack.delete(serviceId);
  cache.set(serviceId, merged);

  return merged;
};

const resolveServiceIdForSubscription = async (
  subscription: Pick<Subscription, 'productId' | 'priceId'>,
  serviceById: Map<string, BillingService>
) => {
  if (subscription.productId && serviceById.has(subscription.productId)) {
    return subscription.productId;
  }

  if (subscription.priceId) {
    try {
      const price = await prisma.price.findUnique({
        where: { id: subscription.priceId },
        select: { serviceId: true },
      });

      if (price?.serviceId && serviceById.has(price.serviceId)) {
        return price.serviceId;
      }
    } catch (error) {
      console.error(
        `Failed to resolve service from price ${subscription.priceId}:`,
        error
      );
    }
  }

  return null;
};

const resolveDefaultPlan = (services: BillingService[]) => {
  const withMetadata = services.map((service) => ({
    service,
    metadata: parseServiceMetadata(service.metadata),
    normalizedName: normalizeKey(service.name),
  }));

  const explicitDefault = withMetadata.find((item) => item.metadata.isDefault);
  if (explicitDefault) {
    return explicitDefault.service;
  }

  const namedFree = withMetadata.find(
    (item) =>
      item.normalizedName === 'free' || item.normalizedName === 'free_plan'
  );
  if (namedFree) {
    return namedFree.service;
  }

  const orderedByLevel = withMetadata
    .filter((item) => item.metadata.planLevel !== undefined)
    .sort(
      (a, b) =>
        (a.metadata.planLevel ?? Infinity) - (b.metadata.planLevel ?? Infinity)
    );

  return orderedByLevel[0]?.service ?? null;
};

export const getTeamEntitlements = async (
  teamId: string
): Promise<TeamEntitlements> => {
  const entitlements = emptyEntitlements();

  const services: BillingService[] = await prisma.service.findMany({
    select: { id: true, name: true, features: true, metadata: true },
  });
  const serviceById = new Map<string, BillingService>(
    services.map((service) => [service.id, service] as const)
  );
  const serviceByName = buildServiceNameMap(services);
  const cache = new Map<string, EntitlementValues>();

  const billingScope = await resolveBillingScopeFromTeamId(teamId);
  const subscriptions = await getByBillingScope({
    teamId,
    organizationId: billingScope.organizationId,
  });
  const activeSubscriptions = subscriptions.filter((subscription) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
  );

  if (activeSubscriptions.length === 0) {
    const defaultPlan = resolveDefaultPlan(services);
    if (defaultPlan) {
      const inheritedEntitlements = resolveServiceEntitlements(
        defaultPlan.id,
        services,
        serviceById,
        serviceByName,
        cache,
        new Set<string>()
      );
      mergeEntitlements(
        entitlements,
        inheritedEntitlements,
        defaultPlan.id,
        'free_tier'
      );
    }
    return entitlements;
  }

  for (const subscription of activeSubscriptions) {
    const resolvedServiceId = await resolveServiceIdForSubscription(
      subscription,
      serviceById
    );
    const planId = resolvedServiceId || subscription.productId;
    let source = 'database';
    let planEntitlements: EntitlementValues | null = null;

    if (resolvedServiceId) {
      planEntitlements = resolveServiceEntitlements(
        resolvedServiceId,
        services,
        serviceById,
        serviceByName,
        cache,
        new Set<string>()
      );
    } else if (subscription.productId) {
      source = 'stripe';
      planEntitlements = await getEntitlementsFromStripeProduct(
        subscription.productId
      );
    }

    if (!planEntitlements) {
      continue;
    }

    const quantityAwareEntitlements = applySubscriptionQuantityToEntitlements(
      planEntitlements,
      subscription
    );

    mergeEntitlements(entitlements, quantityAwareEntitlements, planId, source);
  }

  return entitlements;
};

export const requireTeamEntitlement = async (
  teamId: string,
  requirement: EntitlementRequirement
) => {
  // When payments/billing is disabled, grant all entitlements
  if (!env.teamFeatures.payments) {
    return emptyEntitlements();
  }

  const entitlements = await getTeamEntitlements(teamId);

  if (requirement.feature) {
    const featureKey = normalizeFeatureKey(requirement.feature);
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
  if (!env.teamFeatures.payments) {
    return true;
  }

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
