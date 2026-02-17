import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function getWebhookEventById(eventId: string) {
  return prisma.webhookEvent.findUnique({
    where: { eventId },
  });
}

export async function createWebhookEvent(
  eventId: string,
  eventType: string,
  payload?: Prisma.InputJsonValue
) {
  return prisma.webhookEvent.create({
    data: {
      eventId,
      eventType,
      payload,
    },
  });
}
