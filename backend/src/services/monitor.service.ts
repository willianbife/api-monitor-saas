import prisma from "../lib/prisma";
import { io } from "../lib/socket";

export const checkEndpoint = async (endpointId: string) => {
  const endpoint = await prisma.apiEndpoint.findUnique({
    where: { id: endpointId },
  });

  if (!endpoint) return;

  const start = performance.now();
  let statusCode: number | null = null;
  let isError = false;

  try {
    const response = await fetch(endpoint.url, { method: "GET" });
    statusCode = response.status;
    if (!response.ok) {
      isError = true;
    }
  } catch (error) {
    isError = true;
  }

  const end = performance.now();
  const responseTime = Math.round(end - start);

  // Anomaly Detection: Moving Average + Standard Deviation
  const pastResults = await prisma.apiCheckResult.findMany({
    where: { endpointId: endpoint.id },
    orderBy: { createdAt: "desc" },
    take: 100, // Last 100 checks for moving average
  });

  let isAnomaly = false;

  if (pastResults.length >= 10 && !isError) {
    const times = pastResults.map((r) => r.responseTime);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    
    const squaredDiffs = times.map((t) => Math.pow(t - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(variance);

    // If current response time is > mean + 2 * stdDev, it's an anomaly (latency spike)
    if (responseTime > mean + 2 * stdDev) {
      isAnomaly = true;
    }
  } else if (isError) {
    isAnomaly = true; // Complete failures are anomalies
  }

  const result = await prisma.apiCheckResult.create({
    data: {
      endpointId: endpoint.id,
      statusCode,
      responseTime,
      isAnomaly,
    },
  });

  // Emit real-time update
  io.emit(`endpoint_update_${endpoint.id}`, result);

  return result;
};
