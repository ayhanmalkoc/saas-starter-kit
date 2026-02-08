import type { BrowserOptions, NodeOptions } from '@sentry/nextjs';

const traceSampleRate = parseFloat(
  process.env.NEXT_PUBLIC_SENTRY_TRACE_SAMPLE_RATE ?? '0.0'
);

type SharedSentryOptions = Pick<
  BrowserOptions | NodeOptions,
  'dsn' | 'tracesSampleRate' | 'debug' | 'environment' | 'release'
>;

export const getSharedSentryOptions = (): SharedSentryOptions => ({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: Number.isFinite(traceSampleRate) ? traceSampleRate : 0,
  debug: false,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
});
