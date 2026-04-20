import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";

interface AuditInput {
  action: string;
  targetType: string;
  targetId?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const recordAuditEvent = async ({
  action,
  targetType,
  targetId,
  userId,
  workspaceId,
  metadata,
}: AuditInput) => {
  await prisma.auditLog.create({
    data: {
      action: action as never,
      targetType,
      targetId: targetId || null,
      userId: userId || null,
      workspaceId: workspaceId || null,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  });
};
