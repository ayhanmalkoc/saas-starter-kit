const dotenv = require('dotenv');
const Stripe = require('stripe');

dotenv.config({ quiet: true });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is missing! Please check your .env file.');
}

const stripe = new Stripe(stripeSecretKey);

async function main() {
  console.log('Archiving all Stripe prices...');
  const prices = stripe.prices.list({ limit: 100, active: true });
  for await (const price of prices) {
    console.log(`Archiving price: ${price.id}`);
    await stripe.prices.update(price.id, { active: false });
  }

  console.log('Archiving all Stripe products...');
  const products = stripe.products.list({ limit: 100, active: true });
  let productCount = 0;

  for await (const product of products) {
    productCount++;
    console.log(`Archiving product: ${product.name} (${product.id})`);
    await stripe.products.update(product.id, { active: false });
  }

  if (productCount === 0) {
    console.log('No active products found.');
  }

  console.log('All products and prices archived successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
