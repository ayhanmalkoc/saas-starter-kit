import crypto from 'crypto';

jest.mock('@/lib/env', () => ({
  __esModule: true,
  default: {
    jackson: {
      dsync: {
        webhook_secret: 'test-webhook-secret',
      },
    },
  },
}));

jest.mock('@/lib/jackson/dsyncEvents', () => ({
  __esModule: true,
  handleEvents: jest.fn(),
}));

import {
  setWebhookReplayCache,
  verifyWebhookSignature,
} from '@/pages/api/webhooks/dsync';

const makeRequest = (signatureHeader?: string, body: unknown = { foo: 'bar' }) =>
  ({
    headers: signatureHeader ? { 'boxyhq-signature': signatureHeader } : {},
    body,
  }) as any;

const createSignature = (timestamp: number, body: unknown) =>
  crypto
    .createHmac('sha256', 'test-webhook-secret')
    .update(`${timestamp}.${JSON.stringify(body)}`)
    .digest('hex');

describe('verifyWebhookSignature', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    setWebhookReplayCache({
      has: jest.fn().mockResolvedValue(false),
      set: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    setWebhookReplayCache(undefined);
  });

  it('returns false when signature header is missing', async () => {
    const result = await verifyWebhookSignature(makeRequest());

    expect(result).toBe(false);
  });

  it('returns false when signature header is malformed', async () => {
    const result = await verifyWebhookSignature(makeRequest('invalid-header'));

    expect(result).toBe(false);
  });

  it('returns false when t= or s= is missing', async () => {
    const body = { foo: 'bar' };
    const timestamp = 1_700_000_000;
    const signature = createSignature(timestamp, body);

    const withoutTimestamp = await verifyWebhookSignature(
      makeRequest(`s=${signature}`, body)
    );

    const withoutSignature = await verifyWebhookSignature(
      makeRequest(`t=${timestamp}`, body)
    );

    expect(withoutTimestamp).toBe(false);
    expect(withoutSignature).toBe(false);
  });

  it('returns false when timestamp is outside tolerance window', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);

    const oldTimestamp = 1_700_000_000 - 301;
    const body = { foo: 'bar' };
    const signature = createSignature(oldTimestamp, body);

    const result = await verifyWebhookSignature(
      makeRequest(`t=${oldTimestamp},s=${signature}`, body)
    );

    expect(result).toBe(false);
  });


  it('returns false when signature is not valid hex or has invalid length', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);

    const timestamp = 1_700_000_000;
    const body = { foo: 'bar' };

    const invalidHex = await verifyWebhookSignature(
      makeRequest(`t=${timestamp},s=${'z'.repeat(64)}`, body)
    );

    const invalidLength = await verifyWebhookSignature(
      makeRequest(`t=${timestamp},s=${'a'.repeat(63)}`, body)
    );

    expect(invalidHex).toBe(false);
    expect(invalidLength).toBe(false);
  });

  it('returns false when signature is invalid', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);

    const timestamp = 1_700_000_000;
    const badSignature = 'a'.repeat(64);
    const body = { foo: 'bar' };

    const result = await verifyWebhookSignature(
      makeRequest(`t=${timestamp},s=${badSignature}`, body)
    );

    expect(result).toBe(false);
  });
});
