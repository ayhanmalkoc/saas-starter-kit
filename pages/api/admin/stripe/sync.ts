import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { buildServiceUpsert } from 'models/service';
import { buildPriceUpsert } from 'models/price';

const listStripeProducts = () =>
  stripe.products.list({ active: true, limit: 100 });

const listStripePrices = () => stripe.prices.list({ active: true, limit: 100 });

const validateSecret = (req: NextApiRequest) => {
  const secret = process.env.STRIPE_SYNC_SECRET;
  if (!secret) {
    return true;
  }
  const provided = req.headers['x-stripe-sync-secret'];
  return provided === secret;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!validateSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [products, prices] = await Promise.all([
      listStripeProducts(),
      listStripePrices(),
    ]);

    const operations = [
      ...products.data.map(buildServiceUpsert),
      ...prices.data.map(buildPriceUpsert),
    ];

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    return res.status(200).json({
      synced: true,
      products: products.data.length,
      prices: prices.data.length,
    });
  } catch (error) {
    console.error('Stripe sync failed', error);
    return res.status(500).json({ error: 'Stripe sync failed' });
  }
}
