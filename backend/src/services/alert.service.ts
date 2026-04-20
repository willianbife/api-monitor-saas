import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { logger } from "../utils/logger";

interface AlertEventInput {
  workspaceId: string;
  endpointId: string;
  eventType: "FAILURE" | "RECOVERY" | "INCIDENT_OPENED" | "INCIDENT_RESOLVED";
  dedupeKey: string;
  incidentId?: string | null;
  payload: Record<string, unknown>;
}

export const queueAlertNotifications = async ({
  workspaceId,
  endpointId,
  eventType,
  dedupeKey,
  incidentId,
  payload,
}: AlertEventInput) => {
  const channels = await prisma.alertChannel.findMany({
    where: {
      workspaceId,
      isEnabled: true,
      OR: [{ endpointId: null }, { endpointId }],
    },
  });

  if (channels.length === 0) {
    return [];
  }

  const deliveries = await Promise.all(
    channels.map((channel) =>
      prisma.alertDelivery.upsert({
        where: {
          channelId_dedupeKey: {
            channelId: channel.id,
            dedupeKey,
          },
        },
        update: {
          payload: payload as Prisma.InputJsonValue,
        },
        create: {
          channelId: channel.id,
          endpointId,
          incidentId: incidentId || null,
          eventType,
          dedupeKey,
          payload: payload as Prisma.InputJsonValue,
        },
      })
    )
  );

  logger.info("Alert deliveries queued", {
    workspaceId,
    endpointId,
    eventType,
    deliveries: deliveries.length,
  });

  return deliveries;
};
