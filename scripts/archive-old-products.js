const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.log('STRIPE_SECRET_KEY is missing!');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
if (dryRun) {
  console.log('DRY RUN MODE: No actual changes will be made in Stripe.');
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
      // 1. Get ALL prices (active and inactive) for the product to check history
      const allPrices = await stripe.prices.list({
        product: product.id,
        limit: 100,
      });

      let hasActiveSubscriptions = false;
      for (const price of allPrices.data) {
        const subs = await stripe.subscriptions.list({
          price: price.id,
          status: 'active',
          limit: 1,
        });
        if (subs.data.length > 0) {
          hasActiveSubscriptions = true;
          break;
        }
      }

      if (hasActiveSubscriptions) {
        console.log(
          `Skipping product: ${product.name} (${product.id}) - Has active subscriptions.`
        );
        continue;
      }

      if (dryRun) {
        console.log(
          `[DRY RUN] Would archive product: ${product.name} (${product.id})`
        );
      } else {
        console.log(`Archiving old product: ${product.name} (${product.id})`);
        await stripe.products.update(product.id, { active: false });
      }
    } else {
      console.log(
        `Skipping new product: ${product.name} (${product.id}) - Tier: ${product.metadata.tier}`
      );
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
