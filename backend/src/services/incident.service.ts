import prisma from "../lib/prisma";

export const openOrUpdateIncidentForFailure = async ({
  workspaceId,
  endpointId,
  failureReason,
}: {
  workspaceId: string;
  endpointId: string;
  failureReason?: string | null;
}) => {
  const openIncident = await prisma.incident.findFirst({
    where: {
      workspaceId,
      endpointId,
      status: {
        in: ["OPEN", "INVESTIGATING", "MONITORING"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (openIncident) {
    return prisma.incident.update({
      where: { id: openIncident.id },
      data: {
        status: "INVESTIGATING",
        lastDetectedAt: new Date(),
        summary: failureReason || openIncident.summary,
      },
    });
  }

  return prisma.incident.create({
    data: {
      workspaceId,
      endpointId,
      title: "Endpoint outage detected",
      summary: failureReason || "The endpoint is failing health checks.",
      severity: "HIGH",
      visibility: "PUBLIC",
      status: "OPEN",
      startedAt: new Date(),
      lastDetectedAt: new Date(),
    },
  });
};

export const resolveIncidentForRecovery = async ({
  workspaceId,
  endpointId,
}: {
  workspaceId: string;
  endpointId: string;
}) => {
  const openIncident = await prisma.incident.findFirst({
    where: {
      workspaceId,
      endpointId,
      status: {
        in: ["OPEN", "INVESTIGATING", "MONITORING"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!openIncident) {
    return null;
  }

  return prisma.incident.update({
    where: { id: openIncident.id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      lastDetectedAt: new Date(),
    },
  });
};
