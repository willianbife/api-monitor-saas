import { Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { HttpError } from "../utils/http-errors";
import { sanitizePlainText } from "../utils/sanitize";
import {
  getMonitorQueueStatus,
  removeEndpointMonitoring,
  scheduleEndpointMonitoring,
} from "../workers/monitor.worker";

const createEndpointSchema = z
  .object({
    name: z.string().trim().min(1).max(100).transform(sanitizePlainText),
    url: z
      .string()
      .trim()
      .url()
      .refine((value) => {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      }, "URL must use http or https"),
    interval: z.number().int().min(60).max(86400),
  })
  .strict();

const endpointIdSchema = z.object({
  id: z.uuid(),
});

export const listEndpoints = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const endpoints = await prisma.apiEndpoint.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    include: {
      results: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          endpointId: true,
          statusCode: true,
          responseTime: true,
          isAnomaly: true,
          createdAt: true,
        },
      },
    },
  });

  res.json({
    endpoints,
    monitoring: getMonitorQueueStatus(),
  });
};

export const createEndpoint = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { name, url, interval } = createEndpointSchema.parse(req.body);

  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const queueStatus = getMonitorQueueStatus();
  if (!queueStatus.enabled || !queueStatus.available) {
    throw new HttpError(
      503,
      "Monitoring service is temporarily unavailable",
      queueStatus.reason ? { reason: queueStatus.reason } : undefined
    );
  }

  const endpoint = await prisma.apiEndpoint.create({
    data: {
      name,
      url,
      interval,
      userId: req.userId,
    },
  });

  try {
    await scheduleEndpointMonitoring(endpoint.id, endpoint.interval);
  } catch {
    await prisma.apiEndpoint.delete({ where: { id: endpoint.id } });
    throw new HttpError(503, "Monitoring service is temporarily unavailable");
  }

  res.status(201).json({ endpoint });
};

export const deleteEndpoint = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const { id } = endpointIdSchema.parse(req.params);
  const endpoint = await prisma.apiEndpoint.findFirst({
    where: {
      id,
      userId: req.userId,
    },
  });

  if (!endpoint) {
    throw new HttpError(404, "Endpoint not found");
  }

  await removeEndpointMonitoring(endpoint.id, endpoint.interval);

  await prisma.apiEndpoint.delete({
    where: { id: endpoint.id },
  });

  res.status(204).send();
};
