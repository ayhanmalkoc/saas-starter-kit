import 'dotenv/config';
import { stripe } from '../lib/stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.log('STRIPE_SECRET_KEY is missing! Please check your .env file.');
  process.exit(1);
}

async function main() {
  console.log('Searching for archived Stripe products to delete...');

  const products = await stripe.products.list({
    limit: 100,
    active: false,
  });

  if (products.data.length === 0) {
    console.log('No archived products found.');
    return;
  }

  console.log(`Found ${products.data.length} archived products.`);

  for (const product of products.data) {
    console.log(
      `\nProcessing archived product: ${product.name} (${product.id})...`
    );

    // 2. Fetch all prices for this product (Active and Inactive)
    const prices = await stripe.prices.list({
      product: product.id,
      limit: 100,
      active: true,
    });
    const inactivePrices = await stripe.prices.list({
      product: product.id,
      limit: 100,
      active: false,
    });

    const allPrices = [...prices.data, ...inactivePrices.data];

    let allPricesDeleted = true;

    if (allPrices.length > 0) {
      console.log(
        `  Found ${allPrices.length} associated prices. Attempting to delete them (via API)...`
      );
      for (const price of allPrices) {
        try {
          // Stripe Node SDK doesn't expose prices.del, we use raw fetch
          const response = await fetch(
            `https://api.stripe.com/v1/prices/${price.id}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }
          );

          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Unknown error');
          }

          console.log(`    ✅ Deleted price: ${price.id}`);
        } catch (err: any) {
          console.log(
            `    ⚠️ Could not delete price ${price.id}: ${err.message}`
          );
          allPricesDeleted = false;
        }
      }
    }

    if (allPricesDeleted) {
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
        `  ⏭️ Skipping product deletion (Has undeletable prices/history).`
      );
    }
  }

  console.log('\nCleanup process completed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
