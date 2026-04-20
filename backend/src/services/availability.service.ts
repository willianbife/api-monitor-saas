import prisma from "../lib/prisma";

const windows = [
  { key: "24h", durationMs: 24 * 60 * 60 * 1000 },
  { key: "7d", durationMs: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", durationMs: 30 * 24 * 60 * 60 * 1000 },
];

export const calculateAvailabilitySummary = async (endpointId: string) => {
  const now = Date.now();

  const results = await Promise.all(
    windows.map(async (window) => {
      const checks = await prisma.apiCheckResult.findMany({
        where: {
          endpointId,
          createdAt: {
            gte: new Date(now - window.durationMs),
          },
        },
        select: {
          state: true,
          createdAt: true,
        },
      });

      const totalChecks = checks.length;
      const healthyChecks = checks.filter((check) => check.state === "HEALTHY").length;
      const degradedChecks = checks.filter((check) => check.state === "DEGRADED").length;
      const downChecks = checks.filter((check) => check.state === "DOWN").length;
      const uptimePercentage = totalChecks
        ? Number(((healthyChecks + degradedChecks * 0.5) / totalChecks * 100).toFixed(2))
        : null;

      return {
        window: window.key,
        uptimePercentage,
        totalChecks,
        healthyChecks,
        degradedChecks,
        downChecks,
      };
    })
  );

  return results;
};

export const persistAvailabilityWindows = async (endpointId: string) => {
  const summaries = await calculateAvailabilitySummary(endpointId);

  await Promise.all(
    summaries.map((summary) =>
      prisma.endpointAvailabilityWindow.upsert({
        where: {
          endpointId_region_windowKey: {
            endpointId,
            region: "PRIMARY",
            windowKey: summary.window,
          },
        },
        update: {
          windowStart:
            summary.window === "24h"
              ? new Date(Date.now() - 24 * 60 * 60 * 1000)
              : summary.window === "7d"
                ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          windowEnd: new Date(),
          uptimePercentage: summary.uptimePercentage ?? 0,
          totalChecks: summary.totalChecks,
          healthyChecks: summary.healthyChecks,
          degradedChecks: summary.degradedChecks,
          downChecks: summary.downChecks,
        },
        create: {
          endpointId,
          region: "PRIMARY",
          windowKey: summary.window,
          windowStart:
            summary.window === "24h"
              ? new Date(Date.now() - 24 * 60 * 60 * 1000)
              : summary.window === "7d"
                ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          windowEnd: new Date(),
          uptimePercentage: summary.uptimePercentage ?? 0,
          totalChecks: summary.totalChecks,
          healthyChecks: summary.healthyChecks,
          degradedChecks: summary.degradedChecks,
          downChecks: summary.downChecks,
        },
      })
    )
  );

  return summaries;
};
