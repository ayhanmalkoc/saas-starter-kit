/**
 * This script syncs Stripe products and prices directly to the database
 * without needing the Next.js API server to be running.
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { stripe } from '../lib/stripe';
import { buildServiceUpsert } from '../models/service';
import { buildPriceUpsert } from '../models/price';

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

    // Insert services (products) first
    for (const product of products) {
      console.log(`Syncing product: ${product.name}`);
      await buildServiceUpsert(product);
    }

    // Only sync prices whose product is active (exists in synced products)
    const productIds = new Set(products.map((p) => p.id));
    const matchedPrices = prices.filter((price) => {
      const pid =
        typeof price.product === 'string' ? price.product : price.product.id;
      return productIds.has(pid);
    });

    for (const price of matchedPrices) {
      console.log(`Syncing price: ${price.id}`);
      await buildPriceUpsert(price);
    }

    console.log('Sync completed successfully.');
  } catch (error) {
    console.error('Stripe sync failed', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
