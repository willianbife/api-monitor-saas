import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { monitorQueue, getMonitorQueueStatus } from "../workers/monitor.worker";

export const liveness = async (_req: Request, res: Response): Promise<void> => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
};

export const readiness = async (_req: Request, res: Response): Promise<void> => {
  const dbHealthy = await prisma.$queryRaw`SELECT 1`;
  const queueStatus = getMonitorQueueStatus();
  const repeatableJobs = queueStatus.available ? await monitorQueue.getRepeatableJobs() : [];

  res.json({
    status: "ready",
    dependencies: {
      database: Array.isArray(dbHealthy) ? "up" : "up",
      queue: queueStatus.available ? "up" : "degraded",
      worker: queueStatus.enabled ? "enabled" : "disabled",
    },
    queue: {
      ...queueStatus,
      repeatableJobs: repeatableJobs.length,
    },
  });
};

export const openApiSpec = async (_req: Request, res: Response): Promise<void> => {
  res.json({
    openapi: "3.1.0",
    info: {
      title: "API Monitor SaaS API",
      version: "2.0.0",
    },
    paths: {
      "/api/auth/login": {
        post: {
          summary: "Authenticate a user",
        },
      },
      "/api/endpoints": {
        get: {
          summary: "List endpoints with pagination, filters and availability metrics",
        },
        post: {
          summary: "Create a monitored endpoint",
        },
      },
      "/api/workspaces": {
        get: {
          summary: "List workspaces for the authenticated user",
        },
      },
      "/api/incidents": {
        get: {
          summary: "List incidents",
        },
        post: {
          summary: "Create an incident",
        },
      },
      "/api/alerts": {
        get: {
          summary: "List alert channels",
        },
        post: {
          summary: "Create an alert channel",
        },
      },
      "/api/status-pages/public/{slug}": {
        get: {
          summary: "Read a public status page",
        },
      },
    },
  });
};
