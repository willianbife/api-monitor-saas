import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { HttpError } from "../utils/http-errors";
import { getActiveWorkspaceForUser, requireWorkspaceRole } from "../services/workspace.service";
import { calculateAvailabilitySummary } from "../services/availability.service";

const updateStatusPageSchema = z
  .object({
    workspaceId: z.uuid(),
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    isPublic: z.boolean().optional(),
    endpointIds: z.array(z.uuid()).optional(),
  })
  .strict();

export const getStatusPage = async (req: Request, res: Response): Promise<void> => {
  const slug = z.string().min(3).parse(req.params.slug);

  const statusPage = await prisma.statusPage.findUnique({
    where: { slug },
    include: {
      workspace: true,
      endpoints: {
        where: { isVisible: true },
        orderBy: { sortOrder: "asc" },
        include: {
          endpoint: {
            include: {
              results: {
                orderBy: { createdAt: "desc" },
                take: 20,
              },
            },
          },
        },
      },
    },
  });

  if (!statusPage || !statusPage.isPublic) {
    throw new HttpError(404, "Status page not found");
  }

  const incidents = await prisma.incident.findMany({
    where: {
      workspaceId: statusPage.workspaceId,
      visibility: "PUBLIC",
    },
    include: {
      notes: {
        where: { visibility: "PUBLIC" },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const services = await Promise.all(
    statusPage.endpoints.map(async (item) => ({
      id: item.endpoint.id,
      name: item.endpoint.name,
      url: item.endpoint.url,
      state: item.endpoint.currentState,
      lastCheckedAt: item.endpoint.lastCheckedAt,
      recentResults: item.endpoint.results,
      availability: await calculateAvailabilitySummary(item.endpoint.id),
    }))
  );

  res.json({
    statusPage: {
      slug: statusPage.slug,
      title: statusPage.title,
      description: statusPage.description,
      workspace: {
        name: statusPage.workspace.name,
        slug: statusPage.workspace.slug,
      },
    },
    services,
    incidents,
  });
};

export const updateStatusPage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const input = updateStatusPageSchema.parse(req.body);
  const membership = await getActiveWorkspaceForUser(req.userId, input.workspaceId);
  requireWorkspaceRole("ADMIN", membership.role);

  const statusPage = await prisma.statusPage.upsert({
    where: { workspaceId: membership.workspaceId },
    update: {
      title: input.title,
      description: input.description,
      isPublic: input.isPublic,
    },
    create: {
      workspaceId: membership.workspaceId,
      slug: `${membership.workspace.slug}-status`,
      title: input.title || `${membership.workspace.name} status`,
      description: input.description,
      isPublic: input.isPublic ?? false,
    },
  });

  if (input.endpointIds) {
    await prisma.statusPageEndpoint.deleteMany({
      where: { statusPageId: statusPage.id },
    });

    await prisma.statusPageEndpoint.createMany({
      data: input.endpointIds.map((endpointId, index) => ({
        statusPageId: statusPage.id,
        endpointId,
        sortOrder: index,
      })),
    });
  }

  res.json({ statusPage });
};
