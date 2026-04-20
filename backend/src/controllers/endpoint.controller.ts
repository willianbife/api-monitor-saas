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
import { decryptJson, encryptJson } from "../utils/crypto";
import {
  getPagination,
  createPaginationMeta,
} from "../utils/pagination";
import {
  getActiveWorkspaceForUser,
  requireWorkspaceRole,
} from "../services/workspace.service";
import { recordAuditEvent } from "../services/audit.service";
import { calculateAvailabilitySummary } from "../services/availability.service";
import { incrementUsageMetric } from "../services/usage.service";
import { assertSafeMonitoringUrl } from "../utils/ssrf";

const endpointMethodSchema = z.enum(["GET", "POST", "PUT", "DELETE"]);
const regionSchema = z.enum(["PRIMARY", "US_EAST", "US_WEST", "EU_CENTRAL", "SA_EAST"]);

const responseValidationSchema = z
  .object({
    containsText: z.string().trim().optional(),
    jsonPath: z.string().trim().optional(),
    equals: z.union([z.string(), z.number(), z.boolean()]).optional(),
    regex: z.string().trim().optional(),
  })
  .strict()
  .optional();

const createEndpointSchema = z
  .object({
    workspaceId: z.uuid().optional(),
    name: z.string().trim().min(1).max(100).transform(sanitizePlainText),
    url: z
      .string()
      .trim()
      .url()
      .refine((value) => {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      }, "URL must use http or https"),
    method: endpointMethodSchema.default("GET"),
    interval: z.number().int().min(60).max(86400),
    timeoutMs: z.number().int().min(1000).max(60000).default(10000),
    retries: z.number().int().min(0).max(5).default(2),
    isPublic: z.boolean().optional().default(false),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.record(z.string(), z.any()).optional(),
    responseValidation: responseValidationSchema,
    regions: z.array(regionSchema).min(1).max(5).optional().default(["PRIMARY"]),
    alertCooldownSeconds: z.number().int().min(60).max(86400).optional().default(300),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.body && value.method === "GET") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "GET requests do not support a JSON body",
      });
    }
  });

const endpointIdSchema = z.object({
  id: z.uuid(),
});

const endpointListQuerySchema = z.object({
  workspaceId: z.uuid().optional(),
  endpointId: z.uuid().optional(),
  status: z.enum(["HEALTHY", "DEGRADED", "DOWN"]).optional(),
  period: z.enum(["24h", "7d", "30d"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const planLimits = {
  FREE: 3,
  PRO: 25,
  ENTERPRISE: 1000,
} as const;

const serializeEndpoint = async (
  endpoint: Awaited<ReturnType<typeof prisma.apiEndpoint.findFirstOrThrow>>
) => {
  const availability = await calculateAvailabilitySummary(endpoint.id);

  return {
    ...endpoint,
    headers: decryptJson<Record<string, string>>(endpoint.requestHeadersEncrypted),
    body: decryptJson<Record<string, unknown>>(endpoint.requestBodyEncrypted),
    availability,
  };
};

export const listEndpoints = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const query = endpointListQuerySchema.parse(req.query);
  const membership = await getActiveWorkspaceForUser(req.userId, query.workspaceId);
  const { page, pageSize, skip, take } = getPagination(req.query);

  const now = Date.now();
  const where = {
    workspaceId: membership.workspaceId,
    ...(query.endpointId ? { id: query.endpointId } : {}),
    ...(query.status ? { currentState: query.status } : {}),
    ...(query.period
      ? {
          results: {
            some: {
              createdAt: {
                gte:
                  query.period === "24h"
                    ? new Date(now - 24 * 60 * 60 * 1000)
                    : query.period === "7d"
                      ? new Date(now - 7 * 24 * 60 * 60 * 1000)
                      : new Date(now - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
        }
      : {}),
  } as const;

  const [total, endpoints] = await Promise.all([
    prisma.apiEndpoint.count({ where }),
    prisma.apiEndpoint.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        results: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            endpointId: true,
            statusCode: true,
            responseTime: true,
            totalResponseMs: true,
            dnsLookupMs: true,
            tlsHandshakeMs: true,
            attemptCount: true,
            failureReason: true,
            validationPassed: true,
            isAnomaly: true,
            state: true,
            createdAt: true,
          },
        },
        availabilityWindows: {
          where: {
            windowKey: {
              in: ["24h", "7d", "30d"],
            },
          },
          orderBy: { windowStart: "asc" },
        },
      },
    }),
  ]);

  const serializedEndpoints = await Promise.all(
    endpoints.map(async (endpoint) => ({
      ...endpoint,
      headers: decryptJson<Record<string, string>>(endpoint.requestHeadersEncrypted),
      body: decryptJson<Record<string, unknown>>(endpoint.requestBodyEncrypted),
      availability:
        endpoint.availabilityWindows.length > 0
          ? endpoint.availabilityWindows.map((window) => ({
              window: window.windowKey,
              uptimePercentage: window.uptimePercentage,
              healthyChecks: window.healthyChecks,
              degradedChecks: window.degradedChecks,
              downChecks: window.downChecks,
              totalChecks: window.totalChecks,
            }))
          : await calculateAvailabilitySummary(endpoint.id),
    }))
  );

  const onboarding = {
    needsFirstEndpoint: total === 0,
    nextSteps:
      total === 0
        ? [
            "Create your first endpoint",
            "Choose the HTTP method and validation rules",
            "Configure an alert channel",
            "Expose the status page if needed",
          ]
        : [],
  };

  res.json({
    endpoints: serializedEndpoints,
    monitoring: getMonitorQueueStatus(),
    pagination: createPaginationMeta({ page, pageSize, total }),
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      plan: membership.workspace.plan,
      role: membership.role,
    },
    onboarding,
  });
};

export const createEndpoint = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const input = createEndpointSchema.parse(req.body);

  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const membership = await getActiveWorkspaceForUser(req.userId, input.workspaceId);
  requireWorkspaceRole("ADMIN", membership.role);
  await assertSafeMonitoringUrl(input.url);

  const queueStatus = getMonitorQueueStatus();
  if (!queueStatus.enabled || !queueStatus.available) {
    throw new HttpError(
      503,
      "Monitoring service is temporarily unavailable",
      queueStatus.reason ? { reason: queueStatus.reason } : undefined
    );
  }

  const currentEndpointCount = await prisma.apiEndpoint.count({
    where: { workspaceId: membership.workspaceId },
  });

  if (currentEndpointCount >= planLimits[membership.workspace.plan]) {
    throw new HttpError(403, "Plan quota reached for endpoints", {
      plan: membership.workspace.plan,
      limit: planLimits[membership.workspace.plan],
    });
  }

  const endpoint = await prisma.apiEndpoint.create({
    data: {
      workspaceId: membership.workspaceId,
      userId: req.userId,
      name: input.name,
      url: input.url,
      method: input.method,
      interval: input.interval,
      timeoutMs: input.timeoutMs,
      retries: input.retries,
      isPublic: input.isPublic,
      requestHeadersEncrypted: input.headers ? encryptJson(input.headers) : null,
      requestBodyEncrypted: input.body ? encryptJson(input.body) : null,
      responseValidation: input.responseValidation,
      regions: input.regions,
      alertCooldownSeconds: input.alertCooldownSeconds,
    },
    include: {
      results: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  try {
    await scheduleEndpointMonitoring(endpoint.id, endpoint.interval);
  } catch {
    await prisma.apiEndpoint.delete({ where: { id: endpoint.id } });
    throw new HttpError(503, "Monitoring service is temporarily unavailable");
  }

  await recordAuditEvent({
    action: "ENDPOINT_CREATED",
    targetType: "endpoint",
    targetId: endpoint.id,
    userId: req.userId,
    workspaceId: membership.workspaceId,
    metadata: {
      method: endpoint.method,
      interval: endpoint.interval,
      isPublic: endpoint.isPublic,
    },
  });

  await incrementUsageMetric(membership.workspaceId, "ENDPOINTS", 1);

  res.status(201).json({
    endpoint: {
      ...(await serializeEndpoint(endpoint)),
      onboarding: {
        completedFirstEndpoint: currentEndpointCount === 0,
      },
    },
  });
};

export const deleteEndpoint = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const { id } = endpointIdSchema.parse(req.params);
  const membership = await getActiveWorkspaceForUser(
    req.userId,
    typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined
  );

  requireWorkspaceRole("ADMIN", membership.role);

  const endpoint = await prisma.apiEndpoint.findFirst({
    where: {
      id,
      workspaceId: membership.workspaceId,
    },
  });

  if (!endpoint) {
    throw new HttpError(404, "Endpoint not found");
  }

  await removeEndpointMonitoring(endpoint.id, endpoint.interval);

  await prisma.apiEndpoint.delete({
    where: { id: endpoint.id },
  });

  await recordAuditEvent({
    action: "ENDPOINT_DELETED",
    targetType: "endpoint",
    targetId: endpoint.id,
    userId: req.userId,
    workspaceId: membership.workspaceId,
  });

  res.status(204).send();
};
