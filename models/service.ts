import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import type { Prisma, Service } from '@prisma/client';

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

const parseBoolean = (value: unknown) =>
  value === true ||
  value === 'true' ||
  value === '1' ||
  value === 'yes' ||
  value === 'on';

type PlanMetadata = {
  featureFlags: Record<string, boolean>;
  limits: Record<string, number>;
  tier?: string;
  planLevel?: number;
  inherits?: string[];
  isDefault?: boolean;
  recommended?: boolean;
  custom?: boolean;
};

const parsePlanMetadata = (
  metadata: Stripe.Metadata | null | undefined
): PlanMetadata & { features: string[] } => {
  const featureFlags: Record<string, boolean> = {};
  const limits: Record<string, number> = {};
  const features = new Set<string>();
  let tier: string | undefined;
  let planLevel: number | undefined;
  let inherits: string[] | undefined;
  let isDefault: boolean | undefined;
  let recommended: boolean | undefined;
  let custom: boolean | undefined;

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
        .map((item) => normalizeFeatureKey(item))
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
      const featureKey = normalizeFeatureKey(key.replace('feature_', ''));
      const enabled = parseBoolean(rawValue);
      featureFlags[featureKey] = enabled;
      if (enabled) {
        features.add(featureKey);
      }
      continue;
    }

    if (key === 'tier') {
      tier = normalizeKey(rawValue);
      continue;
    }

    if (key === 'plan_level') {
      const parsed = Number(rawValue);
      if (!Number.isNaN(parsed)) {
        planLevel = parsed;
      }
      continue;
    }

    if (key === 'inherits') {
      inherits = rawValue
        .split(',')
        .map((item) => normalizeKey(item))
        .filter(Boolean);
      continue;
    }

    if (key === 'is_default' || key === 'default') {
      isDefault = parseBoolean(rawValue);
      continue;
    }

    if (key === 'recommended') {
      recommended = parseBoolean(rawValue);
      continue;
    }

    if (key === 'custom') {
      custom = parseBoolean(rawValue);
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
    planLevel,
    inherits,
    isDefault,
    recommended,
    custom,
  };
};

const parseServiceMetadata = (metadata: unknown) => {
  const parsed = {
    featureFlags: {} as Record<string, boolean>,
    limits: {} as Record<string, number>,
    tier: undefined as string | undefined,
    planLevel: undefined as number | undefined,
    inherits: [] as string[],
    isDefault: false,
    recommended: false,
    custom: false,
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
  parsed.recommended = parseBoolean(record.recommended);
  parsed.custom = parseBoolean(record.custom);

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

const buildServiceData = (product: Stripe.Product) => {
  const {
    featureFlags,
    limits,
    features,
    tier,
    planLevel,
    inherits,
    isDefault,
    recommended,
    custom,
  } = parsePlanMetadata(product.metadata);

  return {
    id: product.id,
    description: product.description || '',
    features,
    image: product.images.length > 0 ? product.images[0] : '',
    metadata: {
      featureFlags,
      limits,
      tier,
      planLevel,
      inherits,
      isDefault,
      recommended,
      custom,
    },
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

const buildServiceNameMap = (
  services: Array<Service & { Price: Array<{ amount: number | null }> }>
) => {
  const map = new Map<
    string,
    Service & { Price: Array<{ amount: number | null }> }
  >();
  for (const service of services) {
    map.set(normalizeKey(service.name), service);
  }

  return map;
};

const resolveInheritedServiceIds = (
  service: Service & { Price: Array<{ amount: number | null }> },
  services: Array<Service & { Price: Array<{ amount: number | null }> }>,
  serviceById: Map<
    string,
    Service & { Price: Array<{ amount: number | null }> }
  >,
  serviceByName: Map<
    string,
    Service & { Price: Array<{ amount: number | null }> }
  >
) => {
  const metadata = parseServiceMetadata(service.metadata);

  if (metadata.inherits.length > 0) {
    return metadata.inherits
      .map((ref) => serviceById.get(ref)?.id ?? serviceByName.get(ref)?.id)
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

const resolveServiceFeatures = (
  serviceId: string,
  services: Array<Service & { Price: Array<{ amount: number | null }> }>,
  serviceById: Map<
    string,
    Service & { Price: Array<{ amount: number | null }> }
  >,
  serviceByName: Map<
    string,
    Service & { Price: Array<{ amount: number | null }> }
  >,
  cache: Map<string, string[]>,
  stack: Set<string>
): string[] => {
  const cached = cache.get(serviceId);
  if (cached) {
    return cached;
  }

  if (stack.has(serviceId)) {
    return [];
  }

  const service = serviceById.get(serviceId);
  if (!service) {
    return [];
  }

  stack.add(serviceId);

  const features = new Set<string>(
    service.features.map((feature) => normalizeFeatureKey(feature))
  );
  const metadata = parseServiceMetadata(service.metadata);

  for (const [feature, enabled] of Object.entries(metadata.featureFlags)) {
    if (enabled) {
      features.add(feature);
    }
  }

  const inheritedServiceIds = resolveInheritedServiceIds(
    service,
    services,
    serviceById,
    serviceByName
  );

  for (const inheritedServiceId of inheritedServiceIds) {
    const inheritedFeatures = resolveServiceFeatures(
      inheritedServiceId,
      services,
      serviceById,
      serviceByName,
      cache,
      stack
    );
    for (const feature of inheritedFeatures) {
      features.add(feature);
    }
  }

  stack.delete(serviceId);
  const resolved = Array.from(features);
  cache.set(serviceId, resolved);
  return resolved;
};

export const getAllServices = async () => {
  const services = await prisma.service.findMany({
    include: {
      Price: {
        orderBy: {
          amount: 'asc',
        },
      },
    },
  });

  const tieredServices = services.filter((service) => {
    const metadata = parseServiceMetadata(service.metadata);
    return Boolean(metadata.tier);
  });

  const serviceById = new Map(
    tieredServices.map((service) => [service.id, service])
  );
  const serviceByName = buildServiceNameMap(tieredServices);
  const featureCache = new Map<string, string[]>();

  return tieredServices
    .map((service) => {
      const metadata = parseServiceMetadata(service.metadata);
      const features = resolveServiceFeatures(
        service.id,
        tieredServices,
        serviceById,
        serviceByName,
        featureCache,
        new Set<string>()
      );

      return {
        ...service,
        features,
        prices: service.Price,
        __tier: metadata.tier || '',
        __planLevel: metadata.planLevel ?? Number.MAX_SAFE_INTEGER,
        __priceAmount: service.Price[0]?.amount ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => {
      if (a.__tier !== b.__tier) {
        return a.__tier.localeCompare(b.__tier);
      }

      if (a.__planLevel !== b.__planLevel) {
        return a.__planLevel - b.__planLevel;
      }

      if (a.__priceAmount !== b.__priceAmount) {
        return a.__priceAmount - b.__priceAmount;
      }

      return a.name.localeCompare(b.name);
    })
    .map(({ __tier, __planLevel, __priceAmount, ...service }) => service);
};
