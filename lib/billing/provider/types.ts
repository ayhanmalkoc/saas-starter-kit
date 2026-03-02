export interface BillingOrganization {
  id: string;
  slug: string;
  billingId: string | null;
  billingProvider: string | null;
}

export interface BillingProject {
  id: string;
  slug: string;
  organizationId: string;
  organization: BillingOrganization;
}

export interface BillingProjectMember {
  projectId: string;
  organizationId: string;
  project: BillingProject;
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
    projectMember: BillingProjectMember,
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
