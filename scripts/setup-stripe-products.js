const Stripe = require('stripe');

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const parseBoolean = (value) =>
  value === true ||
  value === 'true' ||
  value === '1' ||
  value === 'yes' ||
  value === 'on';

const parseFeatures = (metadata) =>
  String(metadata?.features || '')
    .split(',')
    .map((feature) => normalizeKey(feature))
    .filter(Boolean);

const parseInherits = (metadata) =>
  String(metadata?.inherits || '')
    .split(',')
    .map((plan) => normalizeKey(plan))
    .filter(Boolean);

const parsePlanLevel = (metadata, productName) => {
  const level = Number(metadata?.plan_level);
  if (!Number.isFinite(level)) {
    throw new Error(
      `Product "${productName}" is missing numeric metadata.plan_level`
    );
  }

  return level;
};

const products = [
  // --- INDIVIDUAL (tier: personal) ---
  {
    name: 'Free',
    description: 'Perfect for getting started.',
    metadata: {
      tier: 'personal',
      features: 'api_keys',
      plan_level: '0',
      is_default: 'true',
      recommended: 'false',
      limit_team_members: '1',
    },
    prices: [
      { unit_amount: 0, currency: 'usd', recurring: { interval: 'month' } },
    ],
  },
  {
    name: 'Basic',
    description: 'Essential tools for individuals.',
    metadata: {
      tier: 'personal',
      features: 'more_storage',
      plan_level: '1',
      inherits: 'Free',
      recommended: 'false',
    },
    prices: [
      { unit_amount: 900, currency: 'usd', recurring: { interval: 'month' } },
      { unit_amount: 9000, currency: 'usd', recurring: { interval: 'year' } },
    ],
  },
  {
    name: 'Pro',
    description: 'For power users needing more.',
    metadata: {
      tier: 'personal',
      features: 'advanced_analytics',
      plan_level: '2',
      inherits: 'Basic',
      recommended: 'true',
    },
    prices: [
      { unit_amount: 1900, currency: 'usd', recurring: { interval: 'month' } },
      { unit_amount: 19000, currency: 'usd', recurring: { interval: 'year' } },
    ],
  },

  // --- BUSINESS (tier: business) ---
  {
    name: 'Team',
    description: 'Collaborate with your team.',
    metadata: {
      tier: 'business',
      features: 'team_collaboration,api_keys,webhooks,team_audit_log',
      plan_level: '10',
      recommended: 'true',
      limit_team_members: '10',
    },
    prices: [
      { unit_amount: 4900, currency: 'usd', recurring: { interval: 'month' } },
      { unit_amount: 49000, currency: 'usd', recurring: { interval: 'year' } },
    ],
  },
  {
    name: 'Enterprise',
    description: 'Custom solutions for large organizations.',
    metadata: {
      tier: 'business',
      features: 'sso,directory_sync,priority_support',
      plan_level: '20',
      inherits: 'Team',
      recommended: 'false',
      limit_team_members: '1000',
      custom: 'true',
    },
    prices: [
      { unit_amount: 0, currency: 'usd', recurring: { interval: 'month' } },
    ],
  },
];

const resolveEffectiveFeatures = (
  product,
  allProducts,
  byName,
  byTier,
  cache,
  stack
) => {
  const key = normalizeKey(product.name);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  if (stack.has(key)) {
    throw new Error(`Circular inherits detected for product "${product.name}"`);
  }
  stack.add(key);

  const tier = normalizeKey(product.metadata?.tier);
  const level = parsePlanLevel(product.metadata, product.name);
  const features = new Set(parseFeatures(product.metadata));
  const inherits = parseInherits(product.metadata);

  const inheritedPlans =
    inherits.length > 0
      ? inherits.map((name) => byName.get(name)).filter(Boolean)
      : (byTier.get(tier) || []).filter(
          (candidate) =>
            parsePlanLevel(candidate.metadata, candidate.name) < level
        );

  for (const inheritedPlan of inheritedPlans) {
    const inheritedFeatures = resolveEffectiveFeatures(
      inheritedPlan,
      allProducts,
      byName,
      byTier,
      cache,
      stack
    );
    for (const feature of inheritedFeatures) {
      features.add(feature);
    }
  }

  stack.delete(key);
  const resolved = Array.from(features);
  cache.set(key, resolved);
  return resolved;
};

const validateProducts = (catalog) => {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error('Product catalog is empty');
  }

  const byName = new Map();
  const byTier = new Map();
  const defaultPlans = [];
  const levelKeys = new Set();

  for (const product of catalog) {
    const productName = normalizeKey(product.name);
    const tier = normalizeKey(product.metadata?.tier);
    const level = parsePlanLevel(product.metadata, product.name);

    if (!productName) {
      throw new Error('Product name is required');
    }
    if (!tier) {
      throw new Error(`Product "${product.name}" is missing metadata.tier`);
    }
    if (byName.has(productName)) {
      throw new Error(`Duplicate product name "${product.name}"`);
    }

    const levelKey = `${tier}:${level}`;
    if (levelKeys.has(levelKey)) {
      throw new Error(`Duplicate plan_level ${level} in tier "${tier}"`);
    }

    levelKeys.add(levelKey);
    byName.set(productName, product);
    byTier.set(tier, [...(byTier.get(tier) || []), product]);

    if (parseBoolean(product.metadata?.is_default)) {
      defaultPlans.push(product.name);
    }
  }

  if (defaultPlans.length > 1) {
    throw new Error(
      `Only one default plan is allowed. Found: ${defaultPlans.join(', ')}`
    );
  }

  for (const product of catalog) {
    const tier = normalizeKey(product.metadata?.tier);
    const level = parsePlanLevel(product.metadata, product.name);
    const inherits = parseInherits(product.metadata);

    for (const inheritedName of inherits) {
      const inherited = byName.get(inheritedName);
      if (!inherited) {
        throw new Error(
          `Product "${product.name}" inherits unknown plan "${inheritedName}"`
        );
      }

      const inheritedTier = normalizeKey(inherited.metadata?.tier);
      const inheritedLevel = parsePlanLevel(inherited.metadata, inherited.name);

      if (inheritedTier !== tier) {
        throw new Error(
          `Product "${product.name}" can only inherit plans in tier "${tier}"`
        );
      }

      if (inheritedLevel >= level) {
        throw new Error(
          `Product "${product.name}" must inherit a lower plan_level`
        );
      }
    }
  }

  const cache = new Map();
  for (const [tier, tierProducts] of byTier) {
    const ordered = [...tierProducts].sort(
      (a, b) =>
        parsePlanLevel(a.metadata, a.name) - parsePlanLevel(b.metadata, b.name)
    );

    let previousFeatures = new Set();
    for (const product of ordered) {
      const effectiveFeatures = new Set(
        resolveEffectiveFeatures(
          product,
          catalog,
          byName,
          byTier,
          cache,
          new Set()
        )
      );

      const missing = [...previousFeatures].filter(
        (feature) => !effectiveFeatures.has(feature)
      );

      if (missing.length > 0) {
        throw new Error(
          `Plan "${product.name}" in tier "${tier}" drops inherited features: ${missing.join(', ')}`
        );
      }

      previousFeatures = effectiveFeatures;
    }
  }

  return true;
};

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    require('dotenv').config({ quiet: true });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

async function main() {
  validateProducts(products);
  const stripe = getStripeClient();

  console.log('Seeding Stripe Products (Idempotent)...');

  const existingProducts = await stripe.products.list({
    limit: 100,
    active: true,
  });
  const existingProductsMap = new Map();

  for (const product of existingProducts.data) {
    existingProductsMap.set(product.name, product);
  }

  for (const productConfig of products) {
    let product = existingProductsMap.get(productConfig.name);

    if (product) {
      console.log(`Product already exists: ${productConfig.name}`);
      if (
        JSON.stringify(product.metadata) !==
        JSON.stringify(productConfig.metadata)
      ) {
        console.log(`  Updating metadata for ${productConfig.name}`);
        await stripe.products.update(product.id, {
          metadata: productConfig.metadata,
        });
      }
    } else {
      console.log(`Creating product: ${productConfig.name}`);
      product = await stripe.products.create({
        name: productConfig.name,
        description: productConfig.description,
        metadata: productConfig.metadata,
      });
    }

    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 100,
    });

    for (const priceConfig of productConfig.prices) {
      const existingPrice = existingPrices.data.find(
        (existing) =>
          existing.unit_amount === priceConfig.unit_amount &&
          existing.currency === priceConfig.currency &&
          existing.recurring?.interval === priceConfig.recurring.interval
      );

      if (existingPrice) {
        console.log(
          `  Price already exists: ${priceConfig.unit_amount / 100} ${priceConfig.currency}/${priceConfig.recurring.interval}`
        );
      } else {
        console.log(
          `  Creating price: ${priceConfig.unit_amount / 100} ${priceConfig.currency}/${priceConfig.recurring.interval}`
        );
        await stripe.prices.create({
          product: product.id,
          unit_amount: priceConfig.unit_amount,
          currency: priceConfig.currency,
          recurring: priceConfig.recurring,
        });
      }
    }
  }

  console.log('Done.');
}

module.exports = {
  products,
  validateProducts,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
