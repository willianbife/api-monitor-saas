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
  } catch {
    isError = true;
  }

  const end = performance.now();
  const responseTime = Math.round(end - start);

  const pastResults = await prisma.apiCheckResult.findMany({
    where: { endpointId: endpoint.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  let isAnomaly = false;

  if (pastResults.length >= 10 && !isError) {
    const times = pastResults.map((r: { responseTime: number }) => r.responseTime);
    const mean = times.reduce((a: number, b: number) => a + b, 0) / times.length;

    const squaredDiffs = times.map((t: number) => Math.pow(t - mean, 2));
    const variance =
      squaredDiffs.reduce((a: number, b: number) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(variance);

    if (responseTime > mean + 2 * stdDev) {
      isAnomaly = true;
    }
  } else if (isError) {
    isAnomaly = true;
  }

  const result = await prisma.apiCheckResult.create({
    data: {
      endpointId: endpoint.id,
      statusCode,
      responseTime,
      isAnomaly,
    },
  });

  io.to(`user:${endpoint.userId}`).emit("endpoint_update", result);

  return result;
};
