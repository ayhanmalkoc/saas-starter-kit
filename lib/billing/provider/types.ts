export interface BillingTeam {
  id: string;
  slug: string;
  organizationId?: string | null;
  projectId?: string | null;
  billingId: string | null;
  billingProvider: string | null;
}

export interface BillingTeamMember {
  teamId: string;
  team: BillingTeam;
}

export interface BillingSession {
  user?: {
    email?: string | null;
    name?: string | null;
  };
}

export interface CheckoutSessionResult {
  url: string | null;
  sessionId?: string;
}

export interface BillingProvider {
  getCustomerId(
    teamMember: BillingTeamMember,
    session?: BillingSession
  ): Promise<string>;
  createCheckoutSession(params: {
    customerId: string;
    price: string;
    quantity?: number;
    metadata?: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSessionResult>;
  createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string | null }>;
}
