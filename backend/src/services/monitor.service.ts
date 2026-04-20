import http from "http";
import https from "https";
import { URL } from "url";
import prisma from "../lib/prisma";
import { io } from "../lib/socket";
import { decryptJson } from "../utils/crypto";
import { logger } from "../utils/logger";
import { openOrUpdateIncidentForFailure, resolveIncidentForRecovery } from "./incident.service";
import { queueAlertNotifications } from "./alert.service";
import { persistAvailabilityWindows } from "./availability.service";
import { incrementUsageMetric } from "./usage.service";
import { assertSafeMonitoringUrl } from "../utils/ssrf";

interface RequestMetrics {
  statusCode: number | null;
  responseTime: number;
  totalResponseMs: number;
  dnsLookupMs: number | null;
  tlsHandshakeMs: number | null;
  responseBody: string;
  errorMessage?: string | null;
}

const collectMetricsForRequest = async ({
  url,
  method,
  headers,
  body,
  timeoutMs,
}: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}): Promise<RequestMetrics> => {
  const targetUrl = new URL(url);
  const transport = targetUrl.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    const startAt = performance.now();
    let dnsLookupMs: number | null = null;
    let tlsHandshakeMs: number | null = null;
    let socketAssignedAt = 0;
    let secureConnectAt = 0;

    const request = transport.request(
      targetUrl,
      {
        method,
        headers,
        timeout: timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          if (chunks.reduce((sum, current) => sum + current.length, 0) < 8_192) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
        });

        response.on("end", () => {
          const endAt = performance.now();
          resolve({
            statusCode: response.statusCode || null,
            responseTime: Math.round(endAt - startAt),
            totalResponseMs: Math.round(endAt - startAt),
            dnsLookupMs,
            tlsHandshakeMs,
            responseBody: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    request.on("socket", (socket) => {
      socketAssignedAt = performance.now();

      socket.on("lookup", () => {
        dnsLookupMs = Math.round(performance.now() - socketAssignedAt);
      });

      socket.on("secureConnect", () => {
        secureConnectAt = performance.now();
        tlsHandshakeMs = dnsLookupMs
          ? Math.round(secureConnectAt - socketAssignedAt - dnsLookupMs)
          : Math.round(secureConnectAt - socketAssignedAt);
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error("Request timed out"));
    });

    request.on("error", (error) => {
      const endAt = performance.now();
      resolve({
        statusCode: null,
        responseTime: Math.round(endAt - startAt),
        totalResponseMs: Math.round(endAt - startAt),
        dnsLookupMs,
        tlsHandshakeMs,
        responseBody: "",
        errorMessage: error.message,
      });
    });

    if (body) {
      request.write(body);
    }

    request.end();
  });
};

const validateResponse = ({
  responseBody,
  responseValidation,
}: {
  responseBody: string;
  responseValidation: Record<string, unknown> | null;
}) => {
  if (!responseValidation) {
    return { validationPassed: true, failureReason: null as string | null };
  }

  if (
    typeof responseValidation.containsText === "string" &&
    !responseBody.includes(responseValidation.containsText)
  ) {
    return {
      validationPassed: false,
      failureReason: `Response did not contain "${responseValidation.containsText}"`,
    };
  }

  if (typeof responseValidation.regex === "string") {
    const pattern = new RegExp(responseValidation.regex);
    if (!pattern.test(responseBody)) {
      return {
        validationPassed: false,
        failureReason: `Response did not match regex ${responseValidation.regex}`,
      };
    }
  }

  if (
    typeof responseValidation.jsonPath === "string" &&
    responseValidation.equals !== undefined
  ) {
    try {
      const payload = JSON.parse(responseBody) as Record<string, unknown>;
      const keys = responseValidation.jsonPath.split(".").filter(Boolean);
      let current: unknown = payload;

      for (const key of keys) {
        if (typeof current !== "object" || current === null || !(key in current)) {
          return {
            validationPassed: false,
            failureReason: `JSON path ${responseValidation.jsonPath} was not found`,
          };
        }

        current = (current as Record<string, unknown>)[key];
      }

      if (current !== responseValidation.equals) {
        return {
          validationPassed: false,
          failureReason: `JSON path ${responseValidation.jsonPath} did not equal expected value`,
        };
      }
    } catch {
      return {
        validationPassed: false,
        failureReason: "Response body was not valid JSON for validation",
      };
    }
  }

  return { validationPassed: true, failureReason: null as string | null };
};

const getCheckState = ({
  statusCode,
  isAnomaly,
  validationPassed,
}: {
  statusCode: number | null;
  isAnomaly: boolean;
  validationPassed: boolean;
}) => {
  if (statusCode === null || statusCode >= 500 || !validationPassed) {
    return "DOWN" as const;
  }

  if (isAnomaly || statusCode >= 400) {
    return "DEGRADED" as const;
  }

  return "HEALTHY" as const;
};

export const checkEndpoint = async (endpointId: string) => {
  const endpoint = await prisma.apiEndpoint.findUnique({
    where: { id: endpointId },
  });

  if (!endpoint || !endpoint.isActive) {
    return;
  }

  try {
    await assertSafeMonitoringUrl(endpoint.url);
  } catch (error) {
    logger.warn("Blocked unsafe monitor target", {
      endpointId: endpoint.id,
      workspaceId: endpoint.workspaceId,
      reason: error instanceof Error ? error.message : "Unsafe target",
    });

    const result = await prisma.apiCheckResult.create({
      data: {
        endpointId: endpoint.id,
        region: "PRIMARY",
        statusCode: null,
        responseTime: 0,
        totalResponseMs: 0,
        attemptCount: 1,
        failureReason: "Blocked by SSRF protection",
        validationPassed: false,
        isAnomaly: false,
        state: "DOWN",
      },
    });

    await prisma.apiEndpoint.update({
      where: { id: endpoint.id },
      data: {
        currentState: "DOWN",
        lastCheckedAt: result.createdAt,
      },
    });

    return result;
  }

  const headers = decryptJson<Record<string, string>>(endpoint.requestHeadersEncrypted) || {};
  const bodyPayload = decryptJson<Record<string, unknown>>(endpoint.requestBodyEncrypted);
  const body =
    bodyPayload && endpoint.method !== "GET" ? JSON.stringify(bodyPayload) : undefined;

  const requestHeaders = {
    ...headers,
    ...(body ? { "Content-Type": "application/json" } : {}),
  };

  let metrics: RequestMetrics | null = null;
  let attemptCount = 0;
  let failureReason: string | null = null;

  for (let attempt = 1; attempt <= endpoint.retries + 1; attempt += 1) {
    attemptCount = attempt;
    metrics = await collectMetricsForRequest({
      url: endpoint.url,
      method: endpoint.method,
      headers: requestHeaders,
      body,
      timeoutMs: endpoint.timeoutMs,
    });

    const validation = validateResponse({
      responseBody: metrics.responseBody,
      responseValidation:
        endpoint.responseValidation && typeof endpoint.responseValidation === "object"
          ? (endpoint.responseValidation as Record<string, unknown>)
          : null,
    });

    if (
      metrics.statusCode !== null &&
      metrics.statusCode < 500 &&
      validation.validationPassed
    ) {
      failureReason = null;
      break;
    }

    failureReason = validation.failureReason || metrics.errorMessage || "Endpoint check failed";
  }

  if (!metrics) {
    return;
  }

  const pastResults = await prisma.apiCheckResult.findMany({
    where: { endpointId: endpoint.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      responseTime: true,
    },
  });

  const times = pastResults.map((result) => result.responseTime);
  const mean = times.length ? times.reduce((sum, value) => sum + value, 0) / times.length : 0;
  const variance = times.length
    ? times.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / times.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const isAnomaly = times.length >= 10 && metrics.responseTime > mean + 2 * stdDev;

  const validation = validateResponse({
    responseBody: metrics.responseBody,
    responseValidation:
      endpoint.responseValidation && typeof endpoint.responseValidation === "object"
        ? (endpoint.responseValidation as Record<string, unknown>)
        : null,
  });

  const state = getCheckState({
    statusCode: metrics.statusCode,
    isAnomaly,
    validationPassed: validation.validationPassed,
  });

  const previousState = endpoint.currentState;
  const result = await prisma.apiCheckResult.create({
    data: {
      endpointId: endpoint.id,
      region: "PRIMARY",
      statusCode: metrics.statusCode,
      responseTime: metrics.responseTime,
      totalResponseMs: metrics.totalResponseMs,
      dnsLookupMs: metrics.dnsLookupMs,
      tlsHandshakeMs: metrics.tlsHandshakeMs,
      attemptCount,
      failureReason: failureReason || validation.failureReason,
      responseSnippet: metrics.responseBody.slice(0, 1000) || null,
      validationPassed: validation.validationPassed,
      isAnomaly,
      state,
    },
  });

  await prisma.apiEndpoint.update({
    where: { id: endpoint.id },
    data: {
      currentState: state,
      lastCheckedAt: result.createdAt,
      lastHealthyAt: state === "HEALTHY" ? result.createdAt : endpoint.lastHealthyAt,
    },
  });

  if (state === "DOWN") {
    const incident = await openOrUpdateIncidentForFailure({
      workspaceId: endpoint.workspaceId,
      endpointId: endpoint.id,
      failureReason: result.failureReason,
    });

    await queueAlertNotifications({
      workspaceId: endpoint.workspaceId,
      endpointId: endpoint.id,
      eventType: "FAILURE",
      dedupeKey: `${endpoint.id}:failure:${incident.id}`,
      incidentId: incident.id,
      payload: {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        reason: result.failureReason,
        state,
      },
    });
  } else if (previousState === "DOWN" && state === "HEALTHY") {
    const incident = await resolveIncidentForRecovery({
      workspaceId: endpoint.workspaceId,
      endpointId: endpoint.id,
    });

    await queueAlertNotifications({
      workspaceId: endpoint.workspaceId,
      endpointId: endpoint.id,
      eventType: "RECOVERY",
      dedupeKey: `${endpoint.id}:recovery:${result.id}`,
      incidentId: incident?.id || null,
      payload: {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        state,
      },
    });
  }

  await persistAvailabilityWindows(endpoint.id);
  await incrementUsageMetric(endpoint.workspaceId, "CHECKS", 1);

  io.to(`user:${endpoint.userId}`).emit("endpoint_update", result);

  logger.info("Endpoint check completed", {
    endpointId: endpoint.id,
    workspaceId: endpoint.workspaceId,
    state,
    statusCode: result.statusCode,
    responseTime: result.responseTime,
    attemptCount,
  });

  return result;
};
