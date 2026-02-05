import { prisma } from '@/lib/prisma';

export async function getWebhookEventById(eventId: string) {
  return prisma.webhookEvent.findUnique({
    where: { eventId },
  });
}

export async function createWebhookEvent(eventId: string, eventType: string) {
  return prisma.webhookEvent.create({
    data: {
      eventId,
      eventType,
    },
  });
}
