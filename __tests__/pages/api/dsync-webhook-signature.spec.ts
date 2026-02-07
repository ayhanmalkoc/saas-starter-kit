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

import env from '@/lib/env';
import handler, {
  setWebhookReplayCache,
  verifyWebhookSignature,
} from '@/pages/api/webhooks/dsync';
import { handleEvents } from '@/lib/jackson/dsyncEvents';

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



  it('returns false when signature is detected as replayed', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);
    replayCacheHasMock.mockResolvedValue(true);

    const timestamp = 1_700_000_000;
    const body = { foo: 'bar' };
    const signature = createSignature(timestamp, body);

    const result = await verifyWebhookSignature(
      makeRequest(`t=${timestamp},s=${signature}`, body)
    );

    expect(result).toBe(false);
    expect(replayCacheHasMock).toHaveBeenCalledWith(`${timestamp}:${signature}`);
  });

  it('stores replay cache entry with double tolerance TTL on valid signature', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);

    const timestamp = 1_700_000_000;
    const body = { foo: 'bar' };
    const signature = createSignature(timestamp, body);

    const result = await verifyWebhookSignature(
      makeRequest(`t=${timestamp},s=${signature}`, body)
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
    const body = { foo: 'bar' };
    const signature = createSignature(timestamp, body);

    await expect(
      verifyWebhookSignature(makeRequest(`t=${timestamp},s=${signature}`, body))
    ).rejects.toThrow('JACKSON_WEBHOOK_SECRET is not configured for DSync webhook verification.');
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


describe('dsync webhook handler', () => {
  const makeResponse = () => {
    const res: any = {};

    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);

    return res;
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
    const req = { method: 'GET', headers: {}, body: {} } as any;
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
    const body = { foo: 'bar' };
    const timestamp = 1_700_000_000;
    const signature = createSignature(timestamp, body);
    const req = {
      method: 'POST',
      headers: { 'boxyhq-signature': `t=${timestamp},s=${signature}` },
      body,
    } as any;
    const res = makeResponse();

    await handler(req, res);

    expect(handleEvents).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('returns 401 when signature verification fails', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000 * 1000);
    const req = {
      method: 'POST',
      headers: { 'boxyhq-signature': `t=1700000000,s=${'a'.repeat(64)}` },
      body: { foo: 'bar' },
    } as any;
    const res = makeResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Invalid webhook signature.' },
    });
    expect(handleEvents).not.toHaveBeenCalled();
  });
});
