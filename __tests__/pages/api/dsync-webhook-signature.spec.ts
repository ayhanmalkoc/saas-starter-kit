import crypto from 'crypto';
import { Readable } from 'stream';

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

import env from '@/lib/env';
import handler, {
  getRawBody,
  setWebhookReplayCache,
  verifyWebhookSignature,
} from '@/pages/api/webhooks/dsync';
import { handleEvents } from '@/lib/jackson/dsyncEvents';

const makeRequest = (signatureHeader?: string) =>
  ({
    headers: signatureHeader ? { 'boxyhq-signature': signatureHeader } : {},
  }) as any;

const createSignature = (timestamp: number, rawBody: string) =>
  crypto
    .createHmac('sha256', 'test-webhook-secret')
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

describe('getRawBody', () => {
  it('concatenates string and buffer stream chunks', async () => {
    const readable = Readable.from(['{"foo":', Buffer.from('"bar"}')]);

    const rawBody = await getRawBody(readable);

    expect(rawBody.toString('utf8')).toBe('{"foo":"bar"}');
  });
});

describe('verifyWebhookSignature', () => {
  const replayCacheHasMock = jest.fn();
  const replayCacheSetMock = jest.fn();

  beforeEach(() => {
    jest.restoreAllMocks();
    (env as any).jackson.dsync.webhook_secret = 'test-webhook-secret';
    replayCacheHasMock.mockReset().mockResolvedValue(false);
    replayCacheSetMock.mockReset().mockResolvedValue(undefined);

    setWebhookReplayCache({
      has: replayCacheHasMock,
      set: replayCacheSetMock,
    });
  });

  afterEach(() => {
    setWebhookReplayCache(undefined);
  });

  it('returns false when signature header is missing', async () => {
    const result = await verifyWebhookSignature(makeRequest(), '{"foo":"bar"}');

    expect(result).toBe(false);
  });

  it('returns false when signature header is malformed', async () => {
    const result = await verifyWebhookSignature(
      makeRequest('invalid-header'),
      '{"foo":"bar"}'
    );

    expect(result).toBe(false);
  });

  it('returns false when t= or s= is missing', async () => {
    const timestamp = 1_700_000_000;
    const rawBody = '{"foo":"bar"}';
    const signature = createSignature(timestamp, rawBody);

    const withoutTimestamp = await verifyWebhookSignature(
      makeRequest(`s=${signature}`),
      rawBody
    );

    const withoutSignature = await verifyWebhookSignature(
      makeRequest(`t=${timestamp}`),
      rawBody
    );

    expect(withoutTimestamp).toBe(false);
    expect(withoutSignature).toBe(false);
  });

  it('returns false when timestamp is outside tolerance window', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);

    const oldTimestamp = 1_700_000_000 - 301;
    const rawBody = '{"foo":"bar"}';
    const signature = createSignature(oldTimestamp, rawBody);

    const result = await verifyWebhookSignature(
      makeRequest(`t=${oldTimestamp},s=${signature}`),
      rawBody
    );

    expect(result).toBe(false);
  });

  it('returns false when signature is not valid hex or has invalid length', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);

    const timestamp = 1_700_000_000;
    const rawBody = '{"foo":"bar"}';

    const invalidHex = await verifyWebhookSignature(
      makeRequest(`t=${timestamp},s=${'z'.repeat(64)}`),
      rawBody
    );

    const invalidLength = await verifyWebhookSignature(
      makeRequest(`t=${timestamp},s=${'a'.repeat(63)}`),
      rawBody
    );

    expect(invalidHex).toBe(false);
    expect(invalidLength).toBe(false);
  });

  it('returns false when signature is detected as replayed', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);
    replayCacheHasMock.mockResolvedValue(true);

    const timestamp = 1_700_000_000;
    const rawBody = '{"foo":"bar"}';
    const signature = createSignature(timestamp, rawBody);

    const result = await verifyWebhookSignature(
      makeRequest(`t=${timestamp},s=${signature}`),
      rawBody
    );

    expect(result).toBe(false);
    expect(replayCacheHasMock).toHaveBeenCalledWith(`${timestamp}:${signature}`);
  });

  it('stores replay cache entry with double tolerance TTL on valid signature', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);

    const timestamp = 1_700_000_000;
    const rawBody = '{"foo":"bar"}';
    const signature = createSignature(timestamp, rawBody);

    const result = await verifyWebhookSignature(
      makeRequest(`t=${timestamp},s=${signature}`),
      rawBody
    );

    expect(result).toBe(true);
    expect(replayCacheSetMock).toHaveBeenCalledWith(
      `${timestamp}:${signature}`,
      600
    );
  });

  it('throws an ApiError when webhook secret is missing', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);
    (env as any).jackson.dsync.webhook_secret = '';

    const timestamp = 1_700_000_000;
    const rawBody = '{"foo":"bar"}';
    const signature = createSignature(timestamp, rawBody);

    await expect(
      verifyWebhookSignature(makeRequest(`t=${timestamp},s=${signature}`), rawBody)
    ).rejects.toThrow(
      'JACKSON_WEBHOOK_SECRET is not configured for DSync webhook verification.'
    );
  });

  it('returns false when signature is invalid', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);

    const timestamp = 1_700_000_000;
    const badSignature = 'a'.repeat(64);

    const result = await verifyWebhookSignature(
      makeRequest(`t=${timestamp},s=${badSignature}`),
      '{"foo":"bar"}'
    );

    expect(result).toBe(false);
  });

  it('fails verification when semantic payload is same but raw field order differs', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);

    const timestamp = 1_700_000_000;
    const signedRawBody = '{"a":1,"b":2}';
    const deliveredRawBody = '{"b":2,"a":1}';
    const signature = createSignature(timestamp, signedRawBody);

    const result = await verifyWebhookSignature(
      makeRequest(`t=${timestamp},s=${signature}`),
      deliveredRawBody
    );

    expect(result).toBe(false);
  });

  it('passes verification only for byte-identical raw payload', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);

    const timestamp = 1_700_000_000;
    const rawBody = '{"b":2,"a":1}';
    const signature = createSignature(timestamp, rawBody);

    const result = await verifyWebhookSignature(
      makeRequest(`t=${timestamp},s=${signature}`),
      rawBody
    );

    expect(result).toBe(true);
  });
});

describe('dsync webhook handler', () => {
  const makeResponse = () => {
    const res: any = {};

    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);

    return res;
  };

  const makePostRequest = (rawBody: string, signatureHeader: string) => {
    const readable = Readable.from([rawBody]) as any;
    readable.method = 'POST';
    readable.headers = { 'boxyhq-signature': signatureHeader };

    return readable;
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    (env as any).jackson.dsync.webhook_secret = 'test-webhook-secret';
    (handleEvents as jest.Mock).mockReset().mockResolvedValue(undefined);
    setWebhookReplayCache({
      has: jest.fn().mockResolvedValue(false),
      set: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    setWebhookReplayCache(undefined);
  });

  it('returns 405 with Allow header when method is not POST', async () => {
    const req = { method: 'GET', headers: {} } as any;
    const res = makeResponse();

    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST');
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Method GET Not Allowed' },
    });
  });

  it('returns 200 when webhook is processed successfully', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);
    const rawBody = '{"foo":"bar"}';
    const timestamp = 1_700_000_000;
    const signature = createSignature(timestamp, rawBody);
    const req = makePostRequest(rawBody, `t=${timestamp},s=${signature}`);
    const res = makeResponse();

    await handler(req, res);

    expect(handleEvents).toHaveBeenCalledWith({ foo: 'bar' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('returns 400 when payload is not valid JSON after signature verification', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);
    const rawBody = '{"foo":}';
    const timestamp = 1_700_000_000;
    const signature = createSignature(timestamp, rawBody);
    const req = makePostRequest(rawBody, `t=${timestamp},s=${signature}`);
    const res = makeResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Invalid JSON payload.' },
    });
    expect(handleEvents).not.toHaveBeenCalled();
  });

  it('returns 401 when signature verification fails', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);
    const rawBody = '{"foo":"bar"}';
    const req = makePostRequest(rawBody, `t=1700000000,s=${'a'.repeat(64)}`);
    const res = makeResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Invalid webhook signature.' },
    });
    expect(handleEvents).not.toHaveBeenCalled();
  });
});
