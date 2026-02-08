import * as Sentry from '@sentry/nextjs';

import { getSharedSentryOptions } from './sentry.shared.config';

declare global {
  // eslint-disable-next-line no-var
  var __SENTRY_CLIENT_INIT_DONE__: boolean | undefined;
}

if (!globalThis.__SENTRY_CLIENT_INIT_DONE__) {
  Sentry.init(getSharedSentryOptions());
  globalThis.__SENTRY_CLIENT_INIT_DONE__ = true;
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
