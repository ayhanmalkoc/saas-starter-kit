import type Stripe from 'stripe';

export interface BillingProvider {
  getCustomerId(teamMember: any, session?: any): Promise<string>;
  createCheckoutSession(params: {
    customerId: string;
    price: string;
    quantity?: number;
    successUrl: string;
    cancelUrl: string;
  }): Promise<Stripe.Checkout.Session>;
  createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string | null }>;
}

