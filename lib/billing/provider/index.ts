import { stripeBillingProvider } from './stripe';
import type { BillingProvider } from './types';

export type { BillingProvider } from './types';

export const getBillingProvider = (
  billingProvider?: string | null
): BillingProvider => {
  switch (billingProvider) {
    case 'stripe':
    default:
      return stripeBillingProvider;
  }
};
