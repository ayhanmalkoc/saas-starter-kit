const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.log('Loading .env...');
  require('dotenv').config();
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const products = [
  // Personal
  {
    name: 'Personal Basic',
    description: 'Entry level plan for individuals',
    metadata: {
      tier: 'personal',
      features: 'basic_limits',
      recommended: 'false',
    },
    prices: [
      { unit_amount: 900, currency: 'usd', recurring: { interval: 'month' } },
      { unit_amount: 9000, currency: 'usd', recurring: { interval: 'year' } },
    ],
  },
  {
    name: 'Personal Plus',
    description: 'For active individuals',
    metadata: {
      tier: 'personal',
      features: 'basic_limits,more_storage',
      recommended: 'false',
    },
    prices: [
      { unit_amount: 1900, currency: 'usd', recurring: { interval: 'month' } },
      { unit_amount: 19000, currency: 'usd', recurring: { interval: 'year' } },
    ],
  },
  {
    name: 'Personal Pro',
    description: 'For power users',
    metadata: {
      tier: 'personal',
      features: 'basic_limits,more_storage,priority_support',
      recommended: 'true',
    },
    prices: [
      { unit_amount: 2900, currency: 'usd', recurring: { interval: 'month' } },
      { unit_amount: 29000, currency: 'usd', recurring: { interval: 'year' } },
    ],
  },
  // Business
  {
    name: 'Business Plus',
    description: 'For small teams',
    metadata: {
      tier: 'business',
      features: 'team_collaboration',
    },
    prices: [
      { unit_amount: 1500, currency: 'usd', recurring: { interval: 'month' } }, // Per seat
      { unit_amount: 15000, currency: 'usd', recurring: { interval: 'year' } },
    ],
  },
  {
    name: 'Business Pro',
    description: 'For growing companies',
    metadata: {
      tier: 'business',
      features: 'team_collaboration,sso,audit_log,dsync',
      recommended: 'true',
    },
    prices: [
      { unit_amount: 3000, currency: 'usd', recurring: { interval: 'month' } },
      { unit_amount: 30000, currency: 'usd', recurring: { interval: 'year' } },
    ],
  },
];

async function main() {
  console.log('Seeding Stripe Products (Idempotent)...');

  // 1. List active products to avoid duplicates
  const existingProducts = await stripe.products.list({
    limit: 100,
    active: true,
  });
  const existingProductsMap = new Map(); // Name -> Product

  for (const p of existingProducts.data) {
    existingProductsMap.set(p.name, p);
  }

  for (const p of products) {
    let product = existingProductsMap.get(p.name);

    if (product) {
      console.log(`Product already exists: ${p.name}`);
      // Optional: Update metadata if needed
      if (JSON.stringify(product.metadata) !== JSON.stringify(p.metadata)) {
        console.log(`  Updating metadata for ${p.name}`);
        await stripe.products.update(product.id, { metadata: p.metadata });
      }
    } else {
      console.log(`Creating product: ${p.name}`);
      product = await stripe.products.create({
        name: p.name,
        description: p.description,
        metadata: p.metadata,
      });
    }

    // 2. Handle Prices
    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 100,
    });

    for (const priceConfig of p.prices) {
      const existingPrice = existingPrices.data.find(
        (ep) =>
          ep.unit_amount === priceConfig.unit_amount &&
          ep.currency === priceConfig.currency &&
          ep.recurring.interval === priceConfig.recurring.interval
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

main().catch(console.error);
