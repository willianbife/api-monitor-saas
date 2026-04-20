import prisma from "../lib/prisma";

const getMonthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
};

export const incrementUsageMetric = async (
  workspaceId: string,
  metric: "ENDPOINTS" | "CHECKS" | "INCIDENTS" | "ALERTS",
  amount = 1
) => {
  const monthStart = getMonthStart();

  await prisma.usageRecord.upsert({
    where: {
      workspaceId_monthStart_metric: {
        workspaceId,
        monthStart,
        metric,
      },
    },
    update: {
      quantity: {
        increment: amount,
      },
    },
    create: {
      workspaceId,
      monthStart,
      metric,
      quantity: amount,
    },
  });
};
