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
  console.log('Searching for old Stripe products to archive...');

  const activeProducts = stripe.products.list({
    limit: 100,
    active: true,
  });

  let productCount = 0;
  for await (const product of activeProducts) {
    productCount++;
    if (!product.metadata.tier) {
      // 1. Get ALL prices (active and inactive) for the product to check history
      const productPrices = stripe.prices.list({
        product: product.id,
        limit: 100,
      });

      let hasActiveSubscriptions = false;
      for await (const price of productPrices) {
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

  if (productCount === 0) {
    console.log('No active products found.');
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
