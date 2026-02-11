const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.log('Stripe secret key not found in environment.');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function main() {
  console.log('Fetching all products to archive checking...');
  const products = [];

  for await (const product of stripe.products.list({
    limit: 100,
    active: true,
  })) {
    products.push(product);
  }

  console.log(`Found ${products.length} active products.`);

  for (const product of products) {
    if (!product.metadata.tier) {
      console.log(`Archiving old product: ${product.name} (${product.id})`);
      await stripe.products.update(product.id, { active: false });
    } else {
      console.log(
        `Skipping new product: ${product.name} (${product.id}) - Tier: ${product.metadata.tier}`
      );
    }
  }

  console.log('Done.');
}

main().catch(console.error);
