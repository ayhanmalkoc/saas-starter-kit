import { updateTeam } from 'models/team';

import { stripe } from '@/lib/stripe';

import type { BillingProvider } from './types';

const getStripeCustomerId = async (teamMember, session?: any) => {
  let customerId = '';

  if (!teamMember.team.billingId) {
    const customerData: {
      metadata: { teamId: string };
      email?: string;
    } = {
      metadata: {
        teamId: teamMember.teamId,
      },
    };

    if (session?.user?.email) {
      customerData.email = session.user.email;
    }

    const customer = await stripe.customers.create({
      ...customerData,
      name: session?.user?.name as string,
    });

    await updateTeam(teamMember.team.slug, {
      billingId: customer.id,
      billingProvider: 'stripe',
    });

    customerId = customer.id;
  } else {
    customerId = teamMember.team.billingId;
  }

  return customerId;
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
    return stripe.checkout.sessions.create({
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
  },
  async createPortalSession({ customerId, returnUrl }) {
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  },
};
