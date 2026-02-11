import 'dotenv/config';
import { stripe } from '../lib/stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.log('STRIPE_SECRET_KEY is missing!');
}

async function main() {
  console.log('Creating Free Plan in Stripe (Idempotent)...');

  const productName = 'Free Plan';

  // Check if product exists
  const products = await stripe.products.search({
    query: `active:'true' AND name:'${productName}'`,
  });

  let product;
  if (products.data.length > 0) {
    product = products.data[0];
    console.log(`Product already exists: ${product.name} (${product.id})`);
  } else {
    console.log(`Creating product: ${productName}`);
    product = await stripe.products.create({
      name: productName,
      description: 'Free plan for everyone',
      metadata: {
        tier: 'free',
        recommended: 'false',
      },
    });
    console.log(`Created product: ${product.name} (${product.id})`);
  }

  // Create Monthly Price ($0)
  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });

  const existingMonthly = prices.data.find(
    (p) => p.unit_amount === 0 && p.recurring?.interval === 'month'
  );

  if (existingMonthly) {
    console.log(`Price already exists: Free/Month (${existingMonthly.id})`);
  } else {
    const priceMonth = await stripe.prices.create({
      product: product.id,
      unit_amount: 0,
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        tier: 'free',
      },
    });
    console.log(`Created price: ${priceMonth.id} (Free/Month)`);
  }

  // Create Yearly Price ($0)
  const existingYearly = prices.data.find(
    (p) => p.unit_amount === 0 && p.recurring?.interval === 'year'
  );

  if (existingYearly) {
    console.log(`Price already exists: Free/Year (${existingYearly.id})`);
  } else {
    const priceYear = await stripe.prices.create({
      product: product.id,
      unit_amount: 0,
      currency: 'usd',
      recurring: {
        interval: 'year',
      },
      metadata: {
        tier: 'free',
      },
    });
    console.log(`Created price: ${priceYear.id} (Free/Year)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
