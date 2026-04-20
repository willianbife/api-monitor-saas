import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { HttpError } from "../utils/http-errors";
import { getActiveWorkspaceForUser, requireWorkspaceRole } from "../services/workspace.service";
import { recordAuditEvent } from "../services/audit.service";

const updateBillingSchema = z
  .object({
    workspaceId: z.uuid(),
    plan: z.enum(["FREE", "PRO", "ENTERPRISE"]),
    billingStatus: z.enum(["INACTIVE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"]),
    stripeCustomerId: z.string().trim().optional(),
    stripeSubscriptionId: z.string().trim().optional(),
  })
  .strict();

const webhookSchema = z
  .object({
    type: z.string().trim(),
    data: z
      .object({
        workspaceId: z.uuid(),
        plan: z.enum(["FREE", "PRO", "ENTERPRISE"]).optional(),
        billingStatus: z.enum(["INACTIVE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"]).optional(),
        stripeCustomerId: z.string().optional(),
        stripeSubscriptionId: z.string().optional(),
      })
      .strict(),
  })
  .strict();

export const getBillingOverview = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const workspaceId = z.uuid().parse(req.query.workspaceId);
  const membership = await getActiveWorkspaceForUser(req.userId, workspaceId);

  const usage = await prisma.usageRecord.findMany({
    where: { workspaceId: membership.workspaceId },
    orderBy: { monthStart: "desc" },
    take: 12,
  });

  res.json({
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      plan: membership.workspace.plan,
      billingStatus: membership.workspace.billingStatus,
      stripeCustomerId: membership.workspace.stripeCustomerId,
      stripeSubscriptionId: membership.workspace.stripeSubscriptionId,
    },
    usage,
  });
};

export const updateBilling = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const input = updateBillingSchema.parse(req.body);
  const membership = await getActiveWorkspaceForUser(req.userId, input.workspaceId);
  requireWorkspaceRole("OWNER", membership.role);

  const workspace = await prisma.workspace.update({
    where: { id: membership.workspaceId },
    data: {
      plan: input.plan,
      billingStatus: input.billingStatus,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    },
  });

  await recordAuditEvent({
    action: "BILLING_UPDATED",
    targetType: "workspace",
    targetId: workspace.id,
    userId: req.userId,
    workspaceId: workspace.id,
    metadata: {
      plan: workspace.plan,
      billingStatus: workspace.billingStatus,
    },
  });

  res.json({ workspace });
};

export const stripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const payload = webhookSchema.parse(req.body);

  if (payload.data.plan || payload.data.billingStatus) {
    await prisma.workspace.update({
      where: { id: payload.data.workspaceId },
      data: {
        ...(payload.data.plan ? { plan: payload.data.plan } : {}),
        ...(payload.data.billingStatus ? { billingStatus: payload.data.billingStatus } : {}),
        ...(payload.data.stripeCustomerId
          ? { stripeCustomerId: payload.data.stripeCustomerId }
          : {}),
        ...(payload.data.stripeSubscriptionId
          ? { stripeSubscriptionId: payload.data.stripeSubscriptionId }
          : {}),
      },
    });
  }

  res.status(200).json({ received: true });
};
