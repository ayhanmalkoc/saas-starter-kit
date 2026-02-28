import {
  ensureOrganizationAndProjectForTeam,
  getOrganizationById,
  setOrganizationBillingIfEmpty,
} from 'models/organization';
import { setTeamBillingIfEmpty } from 'models/team';

import { stripe } from '@/lib/stripe';

import type {
  BillingProvider,
  BillingSession,
  BillingTeamMember,
} from './types';

const getStripeCustomerId = async (
  teamMember: BillingTeamMember,
  session?: BillingSession
) => {
  const billingScope = await ensureOrganizationAndProjectForTeam(
    teamMember.teamId
  );

  if (!billingScope.organizationId) {
    throw new Error(
      `Billing scope missing organization for team ${teamMember.teamId}`
    );
  }

  const organization = await getOrganizationById(billingScope.organizationId);
  if (!organization) {
    throw new Error(
      `Organization not found while resolving billing scope: ${billingScope.organizationId}`
    );
  }

  if (organization.billingId) {
    return organization.billingId;
  }

  if (teamMember.team.billingId) {
    const didReserveLegacyId = await setOrganizationBillingIfEmpty(
      organization.id,
      teamMember.team.billingId,
      teamMember.team.billingProvider || 'stripe'
    );

    if (didReserveLegacyId) {
      return teamMember.team.billingId;
    }

    const latestOrganization = await getOrganizationById(organization.id);
    if (latestOrganization?.billingId) {
      return latestOrganization.billingId;
    }
  }

  const customerMetadata: Record<string, string> = {
    teamId: teamMember.teamId,
    organizationId: billingScope.organizationId,
  };
  if (billingScope.projectId) {
    customerMetadata.projectId = billingScope.projectId;
  }

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
      // Keep legacy team billing fields filled for backward compatibility.
      await setTeamBillingIfEmpty(teamMember.team.slug, customer.id, 'stripe');
      return customer.id;
    }

    const latestOrganization = await getOrganizationById(organization.id);

    if (latestOrganization?.billingId) {
      await stripe.customers.del(customer.id);
      await setTeamBillingIfEmpty(
        teamMember.team.slug,
        latestOrganization.billingId,
        latestOrganization.billingProvider || 'stripe'
      );
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
