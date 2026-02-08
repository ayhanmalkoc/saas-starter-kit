import './instrumentation-client';

/**
 * @deprecated This shim will be removed after 2026-03-31.
 * Move any client-side Sentry setup to `instrumentation-client.ts`.
 */

if (process.env.NODE_ENV !== 'production') {
  console.warn(
    '[DEPRECATION] sentry.client.config.ts is deprecated. Use instrumentation-client.ts instead. Planned removal: 2026-03-31.'
  );
}

export {};
