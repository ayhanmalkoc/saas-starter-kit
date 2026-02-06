import { prisma } from '@/lib/prisma';
import type Stripe from 'stripe';

export const upsertInvoiceFromStripe = async (
  invoice: Stripe.Invoice,
  teamId: string
) => {
  const amount =
    invoice.amount_due ?? invoice.amount_paid ?? invoice.total ?? 0;
  return await prisma.invoice.upsert({
    where: {
      id: invoice.id,
    },
    create: {
      id: invoice.id,
      teamId,
      status: invoice.status ?? 'unknown',
      amount,
      currency: invoice.currency,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    },
    update: {
      status: invoice.status ?? 'unknown',
      amount,
      currency: invoice.currency,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    },
  });
};

export const getByTeamId = async (teamId: string) => {
  return await prisma.invoice.findMany({
    where: {
      teamId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
