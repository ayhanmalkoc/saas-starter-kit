import {
  getOrganizationById,
  setOrganizationBillingIfEmpty,
} from 'models/organization';

import { stripe } from '@/lib/stripe';

import type {
  BillingProvider,
  BillingSession,
  BillingProjectMember,
} from './types';

const getStripeCustomerId = async (
  projectMember: BillingProjectMember,
  session?: BillingSession
) => {
  const organization = await getOrganizationById(projectMember.organizationId);
  if (!organization) {
    throw new Error(
      `Organization not found while resolving billing scope: ${projectMember.organizationId}`
    );
  }

  if (organization.billingId) {
    return organization.billingId;
  }

  const customerMetadata: Record<string, string> = {
    organizationId: projectMember.organizationId,
    projectId: projectMember.projectId,
  };

  const customerData: {
    metadata: Record<string, string>;
    email?: string;
    name?: string;
  } = {
    metadata: customerMetadata,
  };

  if (session?.user?.email) {
    customerData.email = session.user.email;
  }

  if (session?.user?.name) {
    customerData.name = session.user.name;
  }

  const customer = await stripe.customers.create(customerData);

  try {
    const didReserveBillingSlot = await setOrganizationBillingIfEmpty(
      organization.id,
      customer.id,
      'stripe'
    );

    if (didReserveBillingSlot) {
      return customer.id;
    }

    const latestOrganization = await getOrganizationById(organization.id);

    if (latestOrganization?.billingId) {
      await stripe.customers.del(customer.id);
      return latestOrganization.billingId;
    }

    throw new Error(
      `Failed to reserve billing slot for organization ${organization.slug}`
    );
  } catch (error) {
    try {
      await stripe.customers.del(customer.id);
    } catch {
      // no-op, preserve the original error
    }

    throw error;
  }
};

export const stripeBillingProvider: BillingProvider = {
  getCustomerId: getStripeCustomerId,
  async createCheckoutSession({
    customerId,
    price,
    quantity,
    metadata,
    successUrl,
    cancelUrl,
  }) {
    const stripeMetadata = metadata ? metadata : undefined;
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price,
          quantity,
        },
      ],
      metadata: stripeMetadata,
      subscription_data: stripeMetadata
        ? {
            metadata: stripeMetadata,
          }
        : undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return {
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    };
  },
  async createPortalSession({ customerId, returnUrl }) {
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  },
};
