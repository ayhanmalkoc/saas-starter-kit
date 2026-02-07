import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

import env from '@/lib/env';
import { ApiError } from '@/lib/errors';
import { handleEvents } from '@/lib/jackson/dsyncEvents';

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const SIGNATURE_HEX_LENGTH = 64;

type ReplayCache = {
  has: (key: string) => boolean | Promise<boolean>;
  set: (key: string, ttlInSeconds: number) => void | Promise<void>;
};

const inMemoryReplayEntries = new Map<string, number>();

const inMemoryReplayCache: ReplayCache = {
  has(key: string) {
    const now = Math.floor(Date.now() / 1000);

    for (const [cacheKey, expiresAt] of inMemoryReplayEntries.entries()) {
      if (expiresAt <= now) {
        inMemoryReplayEntries.delete(cacheKey);
      }
    }

    const expiresAt = inMemoryReplayEntries.get(key);

    return typeof expiresAt === 'number' && expiresAt > now;
  },
  set(key: string, ttlInSeconds: number) {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlInSeconds;

    inMemoryReplayEntries.set(key, expiresAt);
  },
};

/**
 * Optional replay cache hook for distributed deployments (e.g. Redis).
 * Set this from app bootstrap to enforce replay prevention across instances.
 */
let replayCache: ReplayCache | undefined;

export const setWebhookReplayCache = (cache?: ReplayCache) => {
  replayCache = cache;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      throw new ApiError(405, `Method ${req.method} Not Allowed`);
    }

    if (!(await verifyWebhookSignature(req))) {
      console.error('Signature verification failed.');
      res.status(401).json({ error: { message: 'Invalid webhook signature.' } });
      return;
    }

    await handleEvents(req.body);

    res.status(200).end();
  } catch (error: any) {
    console.error(error);

    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { message: error.message } });
      return;
    }

    res.status(500).json({ error: { message: 'Internal Server Error' } });
  }
}

const parseSignatureHeader = (signatureHeader: string) => {
  const parsedHeader = signatureHeader.split(',').reduce<Record<string, string>>(
    (acc, part) => {
      const [rawKey, ...rawValueParts] = part.split('=');
      const key = rawKey?.trim();
      const value = rawValueParts.join('=').trim();

      if (!key || !value) {
        throw new Error('Invalid signature header part.');
      }

      acc[key] = value;

      return acc;
    },
    {}
  );

  const timestamp = Number.parseInt(parsedHeader.t, 10);
  const signature = parsedHeader.s;

  if (!Number.isFinite(timestamp) || !signature) {
    throw new Error('Missing timestamp/signature in signature header.');
  }

  return {
    timestamp,
    signature,
  };
};

const isReplayAttempt = async (timestamp: number, signature: string) => {
  const cache = replayCache ?? inMemoryReplayCache;
  const replayCacheKey = `${timestamp}:${signature}`;

  if (await cache.has(replayCacheKey)) {
    return true;
  }

  await cache.set(replayCacheKey, 2 * SIGNATURE_TOLERANCE_SECONDS);

  return false;
};

export const verifyWebhookSignature = async (req: NextApiRequest) => {
  const signatureHeader = req.headers['boxyhq-signature'] as string;

  if (!signatureHeader) {
    return false;
  }

  let timestamp: number;
  let signature: string;

  try {
    ({ timestamp, signature } = parseSignatureHeader(signatureHeader));
  } catch {
    return false;
  }

  if (
    signature.length !== SIGNATURE_HEX_LENGTH ||
    !/^[0-9a-f]+$/i.test(signature)
  ) {
    return false;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowInSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const webhookSecret = env.jackson.dsync.webhook_secret;
  if (!webhookSecret) {
    console.error('Missing JACKSON_WEBHOOK_SECRET: cannot verify DSync webhook signature.');
    throw new ApiError(500, 'JACKSON_WEBHOOK_SECRET is not configured for DSync webhook verification.');
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${JSON.stringify(req.body)}`)
    .digest('hex');

  if (expectedSignature.length !== signature.length) {
    return false;
  }

  const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');
  const receivedSignatureBuffer = Buffer.from(signature, 'hex');

  if (expectedSignatureBuffer.length !== receivedSignatureBuffer.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(expectedSignatureBuffer, receivedSignatureBuffer)) {
    return false;
  }

  if (await isReplayAttempt(timestamp, signature)) {
    return false;
  }

  return true;
};
