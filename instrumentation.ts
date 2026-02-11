import * as Sentry from '@sentry/nextjs';

import { getSharedSentryOptions } from './sentry.shared.config';

declare global {
  var __SENTRY_SERVER_INIT_DONE__: boolean | undefined;
}

export function register() {
  if (
    (process.env.NEXT_RUNTIME === 'nodejs' ||
      process.env.NEXT_RUNTIME === 'edge') &&
    !globalThis.__SENTRY_SERVER_INIT_DONE__
  ) {
    Sentry.init(getSharedSentryOptions());
    globalThis.__SENTRY_SERVER_INIT_DONE__ = true;
  }
}

export const onRequestError = Sentry.captureRequestError;
