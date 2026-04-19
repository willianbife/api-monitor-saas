import { Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { monitorQueue } from "../workers/monitor.worker";
import { HttpError } from "../utils/http-errors";
import { sanitizePlainText } from "../utils/sanitize";

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
    select: {
      id: true,
      name: true,
      url: true,
      interval: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ endpoints });
};

export const createEndpoint = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { name, url, interval } = createEndpointSchema.parse(req.body);

  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const endpoint = await prisma.apiEndpoint.create({
    data: {
      name,
      url,
      interval,
      userId: req.userId,
    },
  });

  await monitorQueue.add(
    "check-endpoint",
    { endpointId: endpoint.id },
    {
      repeat: {
        every: endpoint.interval * 1000,
      },
      jobId: `monitor_${endpoint.id}`,
    }
  );

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

  await prisma.apiEndpoint.delete({
    where: { id: endpoint.id },
  });

  res.status(204).send();
};
