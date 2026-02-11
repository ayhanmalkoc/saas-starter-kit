import 'dotenv/config';
import { stripe } from '../lib/stripe';

async function main() {
  console.log('Archiving all Stripe products...');

  const products = await stripe.products.list({ limit: 100, active: true });

  if (products.data.length === 0) {
    console.log('No active products found.');
    return;
  }

  for (const product of products.data) {
    console.log(`Archiving product: ${product.name} (${product.id})`);
    await stripe.products.update(product.id, { active: false });
  }

  console.log('All products archived successfully.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
