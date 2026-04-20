import { Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { HttpError } from "../utils/http-errors";
import { getPagination, createPaginationMeta } from "../utils/pagination";
import { getActiveWorkspaceForUser, requireWorkspaceRole } from "../services/workspace.service";
import { recordAuditEvent } from "../services/audit.service";

const incidentQuerySchema = z.object({
  workspaceId: z.uuid().optional(),
  endpointId: z.uuid().optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "MONITORING", "RESOLVED"]).optional(),
  period: z.enum(["24h", "7d", "30d"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const createIncidentSchema = z
  .object({
    workspaceId: z.uuid(),
    endpointId: z.uuid().optional(),
    title: z.string().trim().min(3).max(120),
    summary: z.string().trim().max(400).optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
    visibility: z.enum(["INTERNAL", "PUBLIC"]).default("INTERNAL"),
  })
  .strict();

const addNoteSchema = z
  .object({
    body: z.string().trim().min(1).max(5000),
    visibility: z.enum(["INTERNAL", "PUBLIC"]).default("INTERNAL"),
  })
  .strict();

export const listIncidents = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const query = incidentQuerySchema.parse(req.query);
  const membership = await getActiveWorkspaceForUser(req.userId, query.workspaceId);
  const { page, pageSize, skip, take } = getPagination(req.query);
  const now = Date.now();

  const where = {
    workspaceId: membership.workspaceId,
    ...(query.endpointId ? { endpointId: query.endpointId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.period
      ? {
          createdAt: {
            gte:
              query.period === "24h"
                ? new Date(now - 24 * 60 * 60 * 1000)
                : query.period === "7d"
                  ? new Date(now - 7 * 24 * 60 * 60 * 1000)
                  : new Date(now - 30 * 24 * 60 * 60 * 1000),
          },
        }
      : {}),
  };

  const [total, incidents] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        endpoint: {
          select: { id: true, name: true, url: true },
        },
        notes: {
          orderBy: { createdAt: "asc" },
          take: 50,
        },
      },
    }),
  ]);

  res.json({
    incidents,
    pagination: createPaginationMeta({ page, pageSize, total }),
  });
};

export const createIncident = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const input = createIncidentSchema.parse(req.body);
  const membership = await getActiveWorkspaceForUser(req.userId, input.workspaceId);
  requireWorkspaceRole("ADMIN", membership.role);

  const incident = await prisma.incident.create({
    data: {
      workspaceId: membership.workspaceId,
      endpointId: input.endpointId || null,
      createdById: req.userId,
      title: input.title,
      summary: input.summary,
      severity: input.severity,
      visibility: input.visibility,
    },
  });

  await recordAuditEvent({
    action: "INCIDENT_CREATED",
    targetType: "incident",
    targetId: incident.id,
    userId: req.userId,
    workspaceId: membership.workspaceId,
  });

  res.status(201).json({ incident });
};

export const addIncidentNote = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const incidentId = z.uuid().parse(req.params.id);
  const input = addNoteSchema.parse(req.body);

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
  });

  if (!incident) {
    throw new HttpError(404, "Incident not found");
  }

  const membership = await getActiveWorkspaceForUser(req.userId, incident.workspaceId);
  requireWorkspaceRole("ADMIN", membership.role);

  const note = await prisma.incidentNote.create({
    data: {
      incidentId,
      userId: req.userId,
      body: input.body,
      visibility: input.visibility,
    },
  });

  res.status(201).json({ note });
};
