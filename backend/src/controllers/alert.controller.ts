import { Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { HttpError } from "../utils/http-errors";
import { encryptJson, decryptJson } from "../utils/crypto";
import { getActiveWorkspaceForUser, requireWorkspaceRole } from "../services/workspace.service";
import { recordAuditEvent } from "../services/audit.service";

const createAlertChannelSchema = z
  .object({
    workspaceId: z.uuid(),
    endpointId: z.uuid().optional(),
    name: z.string().trim().min(1).max(80),
    type: z.enum(["EMAIL", "DISCORD", "TELEGRAM", "WHATSAPP"]),
    target: z.string().trim().min(1).max(300),
    config: z.record(z.string(), z.any()).optional(),
    cooldownSeconds: z.number().int().min(60).max(86400).optional().default(300),
  })
  .strict();

export const listAlertChannels = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const workspaceId = z.uuid().parse(req.query.workspaceId);
  const membership = await getActiveWorkspaceForUser(req.userId, workspaceId);

  const channels = await prisma.alertChannel.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    channels: channels.map((channel) => ({
      ...channel,
      config: decryptJson<Record<string, unknown>>(channel.configEncrypted),
    })),
  });
};

export const createAlertChannel = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const input = createAlertChannelSchema.parse(req.body);
  const membership = await getActiveWorkspaceForUser(req.userId, input.workspaceId);
  requireWorkspaceRole("ADMIN", membership.role);

  const channel = await prisma.alertChannel.create({
    data: {
      workspaceId: membership.workspaceId,
      endpointId: input.endpointId || null,
      name: input.name,
      type: input.type,
      target: input.target,
      configEncrypted: input.config ? encryptJson(input.config) : null,
      cooldownSeconds: input.cooldownSeconds,
    },
  });

  await recordAuditEvent({
    action: "ALERT_CHANNEL_CREATED",
    targetType: "alert_channel",
    targetId: channel.id,
    userId: req.userId,
    workspaceId: membership.workspaceId,
    metadata: {
      type: channel.type,
      endpointId: channel.endpointId,
    },
  });

  res.status(201).json({
    channel: {
      ...channel,
      config: input.config || null,
    },
  });
};
