import { stripeBillingProvider } from './stripe';
import type { BillingProvider } from './types';

export type { BillingProvider } from './types';

export const getBillingProvider = (
  billingProvider?: string | null
): BillingProvider => {
  switch (billingProvider) {
    case undefined:
    case null:
    case 'stripe':
      return stripeBillingProvider;
    default:
      throw new Error(`Unsupported billing provider: ${billingProvider}`);
  }
};
