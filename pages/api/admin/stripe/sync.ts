import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { buildServiceUpsert } from 'models/service';
import { buildPriceUpsert } from 'models/price';

const listStripeProducts = async () =>
  await stripe.products
    .list({ active: true })
    .autoPagingToArray({ limit: 10000 });

const listStripePrices = async () =>
  await stripe.prices
    .list({ active: true })
    .autoPagingToArray({ limit: 10000 });

const getHeaderValue = (header: string | string[] | undefined) =>
  Array.isArray(header) ? header[0] : header;

const validateSecret = (req: NextApiRequest) => {
  const secret = process.env.STRIPE_SYNC_SECRET;
  if (!secret) {
    console.error('Stripe sync server misconfigured');
    return { valid: false, statusCode: 503, error: 'Service unavailable' };
  }

  const provided = getHeaderValue(req.headers['x-stripe-sync-secret']);
  if (!provided) {
    return { valid: false, statusCode: 401, error: 'Unauthorized' };
  }

  const secretBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(provided);

  if (secretBuffer.length !== providedBuffer.length) {
    return { valid: false, statusCode: 401, error: 'Unauthorized' };
  }

  const valid = timingSafeEqual(secretBuffer, providedBuffer);
  return {
    valid,
    statusCode: valid ? 200 : 401,
    error: valid ? null : 'Unauthorized',
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const validation = validateSecret(req);
  if (!validation.valid) {
    return res.status(validation.statusCode).json({ error: validation.error });
  }

  try {
    const [products, prices] = await Promise.all([
      listStripeProducts(),
      listStripePrices(),
    ]);

    const operations = [
      ...products.map(buildServiceUpsert),
      ...prices.map(buildPriceUpsert),
    ];

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    return res.status(200).json({
      synced: true,
      products: products.length,
      prices: prices.length,
    });
  } catch (error) {
    console.error('Stripe sync failed', error);
    return res.status(500).json({ error: 'Stripe sync failed' });
  }
}
