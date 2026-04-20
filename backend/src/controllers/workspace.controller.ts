import crypto from "crypto";
import { Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { HttpError } from "../utils/http-errors";
import { slugify } from "../utils/slug";
import { getActiveWorkspaceForUser, requireWorkspaceRole } from "../services/workspace.service";
import { recordAuditEvent } from "../services/audit.service";

const createWorkspaceSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
  })
  .strict();

const inviteMemberSchema = z
  .object({
    workspaceId: z.uuid(),
    email: z.string().trim().toLowerCase().email(),
    role: z.enum(["OWNER", "ADMIN", "VIEWER"]).default("VIEWER"),
  })
  .strict();

export const listWorkspaces = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId: req.userId },
    include: {
      workspace: {
        include: {
          _count: {
            select: {
              endpoints: true,
              memberships: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  res.json({
    workspaces: memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      plan: membership.workspace.plan,
      billingStatus: membership.workspace.billingStatus,
      role: membership.role,
      endpointCount: membership.workspace._count.endpoints,
      memberCount: membership.workspace._count.memberships,
    })),
  });
};

export const createWorkspace = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const { name } = createWorkspaceSchema.parse(req.body);
  const baseSlug = slugify(name) || "workspace";
  let slug = baseSlug;
  let counter = 1;

  while (await prisma.workspace.findUnique({ where: { slug } })) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      createdById: req.userId,
      memberships: {
        create: {
          userId: req.userId,
          role: "OWNER",
        },
      },
      statusPage: {
        create: {
          slug: `${slug}-status`,
          title: `${name} status`,
          isPublic: false,
        },
      },
    },
  });

  await recordAuditEvent({
    action: "WORKSPACE_CREATED",
    targetType: "workspace",
    targetId: workspace.id,
    userId: req.userId,
    workspaceId: workspace.id,
  });

  res.status(201).json({ workspace });
};

export const inviteWorkspaceMember = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const input = inviteMemberSchema.parse(req.body);
  const membership = await getActiveWorkspaceForUser(req.userId, input.workspaceId);
  requireWorkspaceRole("ADMIN", membership.role);

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId: membership.workspaceId,
      email: input.email,
      role: input.role,
      invitedById: req.userId,
      tokenHash: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await recordAuditEvent({
    action: "WORKSPACE_MEMBER_INVITED",
    targetType: "workspace_invitation",
    targetId: invitation.id,
    userId: req.userId,
    workspaceId: membership.workspaceId,
    metadata: {
      email: input.email,
      role: input.role,
    },
  });

  res.status(201).json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    },
  });
};
