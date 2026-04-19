import { Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { monitorQueue } from "../workers/monitor.worker";

const createEndpointSchema = z.object({
  name: z.string().trim().min(1),
  url: z.string().url(),
  interval: z.number().int().min(10).max(3600),
});

export const listEndpoints = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const endpoints = await prisma.apiEndpoint.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
    });

    res.json({ endpoints });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createEndpoint = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, url, interval } = createEndpointSchema.parse(req.body);

    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
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
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Failed to create endpoint" });
  }
};

export const deleteEndpoint = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const id = z.string().min(1).parse(req.params.id);

    await prisma.apiEndpoint.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Failed to delete endpoint" });
  }
};
