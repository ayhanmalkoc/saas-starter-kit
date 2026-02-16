const { products, validateProducts } = require('./setup-stripe-products');

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const parsePlanLevel = (metadata) => Number(metadata?.plan_level ?? 0);

const summarizeCatalog = (catalog) => {
  const tiers = new Map();

  for (const product of catalog) {
    const tier = normalizeKey(product.metadata?.tier || 'unclassified');
    tiers.set(tier, [...(tiers.get(tier) || []), product]);
  }

  for (const [tier, plans] of tiers) {
    console.log(`\n[${tier}]`);
    const ordered = [...plans].sort(
      (a, b) => parsePlanLevel(a.metadata) - parsePlanLevel(b.metadata)
    );

    for (const plan of ordered) {
      console.log(
        `- ${plan.name} (level: ${plan.metadata.plan_level}, inherits: ${plan.metadata.inherits || '-'})`
      );
    }
  }
};

try {
  validateProducts(products);
  console.log('Plan catalog validation passed.');
  summarizeCatalog(products);
  process.exit(0);
} catch (error) {
  console.error('Plan catalog validation failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
