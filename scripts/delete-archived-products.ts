import 'dotenv/config';
import { stripe } from '../lib/stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.log('STRIPE_SECRET_KEY is missing! Please check your .env file.');
  process.exit(1);
}

async function main() {
  console.log('Searching for archived Stripe products to delete...');

  const archivedProducts = stripe.products.list({
    active: false,
  });

  let productCount = 0;
  for await (const product of archivedProducts) {
    productCount++;
    console.log(
      `\nProcessing archived product: ${product.name} (${product.id})...`
    );

    let allPricesArchived = true;

    // Fetch all prices (Active and Inactive) using auto-pagination
    const productPrices = stripe.prices.list({
      product: product.id,
    });

    console.log(`  Checking associated prices...`);
    for await (const price of productPrices) {
      if (price.active) {
        try {
          // Stripe Node SDK doesn't expose prices.del, and Stripe doesn't support price deletion.
          // We archive them by setting active: false.
          await stripe.prices.update(price.id, { active: false });
          console.log(`    ✅ Archived price: ${price.id}`);
        } catch (err: any) {
          console.log(
            `    ⚠️ Could not archive price ${price.id}: ${err.message}`
          );
          allPricesArchived = false;
        }
      } else {
        console.log(`    ℹ️ Price already archived: ${price.id}`);
      }
    }

    if (allPricesArchived) {
      try {
        await stripe.products.del(product.id);
        console.log(`  ✅ Deleted product: ${product.name}`);
      } catch (error: any) {
        if (error.code === 'resource_missing') {
          console.log(`  ⚠️ Already missing: ${product.name}`);
        } else {
          console.error(
            `  ❌ Failed to delete product ${product.name}: ${error.message}`
          );
        }
      }
    } else {
      console.log(
        `  ⏭️ Skipping product deletion (Has un-archived prices or history).`
      );
    }
  }

  if (productCount === 0) {
    console.log('No archived products found.');
  }

  console.log('\nCleanup process completed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
