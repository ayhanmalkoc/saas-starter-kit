/**
 * This script syncs Stripe products and prices directly to the database
 * without requiring the Next.js API server.
 */
const dotenv = require('dotenv');
const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ quiet: true });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is missing! Please check your .env file.');
}

const db = new PrismaClient();
const stripe = new Stripe(stripeSecretKey);

const normalizeKey = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const featureAliasMap = {
  webhook: 'webhooks',
  team_webhook: 'webhooks',
  dsync: 'directory_sync',
  team_dsync: 'directory_sync',
  audit_logs: 'team_audit_log',
  team_audit_logs: 'team_audit_log',
  api_key: 'api_keys',
  team_api_key: 'api_keys',
};

const normalizeFeatureKey = (value) => {
  const normalized = normalizeKey(value);
  return featureAliasMap[normalized] || normalized;
};

const parseBoolean = (value) =>
  value === true ||
  value === 'true' ||
  value === '1' ||
  value === 'yes' ||
  value === 'on';

const parsePlanMetadata = (metadata) => {
  const featureFlags = {};
  const limits = {};
  const features = new Set();
  let tier;
  let planLevel;
  let inherits;
  let isDefault;
  let recommended;
  let custom;

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

const buildServiceData = (product) => {
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

const buildPriceData = (price) => {
  const serviceId =
    typeof price.product === 'string' ? price.product : price.product.id;

  const recurringMetadata = price.recurring
    ? JSON.parse(JSON.stringify(price.recurring))
    : null;

  return {
    id: price.id,
    billingScheme: price.billing_scheme,
    currency: price.currency,
    serviceId,
    amount:
      typeof price.unit_amount === 'number'
        ? price.unit_amount / 100
        : undefined,
    metadata: {
      ...price.metadata,
      recurring: recurringMetadata,
    },
    type: price.type,
    created: new Date(price.created * 1000),
  };
};

const listStripeProducts = async () =>
  await stripe.products
    .list({ active: true })
    .autoPagingToArray({ limit: 10000 });

const listStripePrices = async () =>
  await stripe.prices
    .list({ active: true })
    .autoPagingToArray({ limit: 10000 });

async function main() {
  console.log('Starting manual Stripe sync...');

  try {
    const [products, prices] = await Promise.all([
      listStripeProducts(),
      listStripePrices(),
    ]);

    console.log(
      `Found ${products.length} products and ${prices.length} prices.`
    );

    for (const product of products) {
      console.log(`Syncing product: ${product.name}`);
      const serviceData = buildServiceData(product);
      await db.service.upsert({
        where: { id: serviceData.id },
        create: serviceData,
        update: serviceData,
      });
    }

    const productIds = new Set(products.map((product) => product.id));
    const matchedPrices = prices.filter((price) => {
      const serviceId =
        typeof price.product === 'string' ? price.product : price.product.id;
      return productIds.has(serviceId);
    });

    for (const price of matchedPrices) {
      console.log(`Syncing price: ${price.id}`);
      const priceData = buildPriceData(price);
      await db.price.upsert({
        where: { id: priceData.id },
        create: priceData,
        update: priceData,
      });
    }

    console.log('Sync completed successfully.');
  } catch (error) {
    console.error('Stripe sync failed', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
