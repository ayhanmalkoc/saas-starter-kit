import { getTeam, setTeamBillingIfEmpty } from 'models/team';

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
  if (teamMember.team.billingId) {
    return teamMember.team.billingId;
  }

  const customerData: {
    metadata: { teamId: string };
    email?: string;
    name?: string;
  } = {
    metadata: {
      teamId: teamMember.teamId,
    },
  };

  if (session?.user?.email) {
    customerData.email = session.user.email;
  }

  if (session?.user?.name) {
    customerData.name = session.user.name;
  }

  const customer = await stripe.customers.create(customerData);

  try {
    const didReserveBillingSlot = await setTeamBillingIfEmpty(
      teamMember.team.slug,
      customer.id,
      'stripe'
    );

    if (didReserveBillingSlot) {
      return customer.id;
    }

    const latestTeam = await getTeam({ slug: teamMember.team.slug });

    if (latestTeam.billingId) {
      await stripe.customers.del(customer.id);
      return latestTeam.billingId;
    }

    throw new Error(
      `Failed to reserve billing slot for team ${teamMember.team.slug}`
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
    successUrl,
    cancelUrl,
  }) {
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price,
          quantity,
        },
      ],
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
