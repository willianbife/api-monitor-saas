import { formatDistanceToNowStrict } from "date-fns";
import type { Endpoint, CheckResult } from "../types/monitoring";
import type { MonitoringStatus } from "../components/ui/StatusBadge";

export const getAllResults = (endpoints: Endpoint[]) =>
  endpoints
    .flatMap((endpoint) => endpoint.results.map((result) => ({ ...result, endpointName: endpoint.name })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export const getMonitoringStatus = (result?: CheckResult | null): MonitoringStatus => {
  if (!result || result.statusCode === null || result.statusCode >= 500) {
    return "DOWN";
  }

  if (result.isAnomaly || result.statusCode >= 400 || result.responseTime > 1200) {
    return "DEGRADED";
  }

  return "HEALTHY";
};

export const getAverageLatency24h = (results: CheckResult[]) => {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = results.filter((result) => new Date(result.createdAt).getTime() >= dayAgo);

  if (recent.length === 0) {
    return null;
  }

  return Math.round(recent.reduce((sum, result) => sum + result.responseTime, 0) / recent.length);
};

export const getRelativeTimestamp = (date?: string | null) => {
  if (!date) {
    return "No checks yet";
  }

  return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
};

export const getLastFailure = (results: CheckResult[]) => {
  return results.find((result) => result.statusCode === null || result.statusCode >= 400) || null;
};

export const getUptimeSeries = (results: CheckResult[]) => {
  return results
    .slice()
    .reverse()
    .map((result) => ({
      time: new Date(result.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      uptime: result.statusCode && result.statusCode < 400 ? 100 : 0,
      anomaly: result.isAnomaly ? 100 : null,
    }));
};

export const getLatencySeries = (results: CheckResult[]) => {
  const latencyValues = results.map((result) => result.responseTime);
  const mean = latencyValues.length
    ? latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length
    : 0;
  const variance = latencyValues.length
    ? latencyValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / latencyValues.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const threshold = mean + stdDev * 2;

  return results
    .slice()
    .reverse()
    .map((result) => ({
      time: new Date(result.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      latency: result.responseTime,
      anomalyThreshold: Math.round(threshold),
      anomalyHit: result.responseTime > threshold ? result.responseTime : null,
    }));
};
