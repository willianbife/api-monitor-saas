import prisma from "../lib/prisma";
import { HttpError } from "../utils/http-errors";
import { slugify } from "../utils/slug";

const ensureUniqueWorkspaceSlug = async (name: string) => {
  const baseSlug = slugify(name) || "workspace";
  let candidate = baseSlug;
  let suffix = 1;

  while (await prisma.workspace.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return candidate;
};

export const createPersonalWorkspace = async (userId: string, email: string) => {
  const workspaceName = `${email.split("@")[0] || "my"} workspace`;
  const slug = await ensureUniqueWorkspaceSlug(workspaceName);

  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      slug,
      createdById: userId,
      memberships: {
        create: {
          userId,
          role: "OWNER",
        },
      },
      statusPage: {
        create: {
          slug: `${slug}-status`,
          title: `${workspaceName} status`,
          isPublic: false,
        },
      },
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { defaultWorkspaceId: workspace.id },
  });

  return workspace;
};

export const getActiveWorkspaceForUser = async (userId: string, workspaceId?: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultWorkspaceId: true },
  });

  const targetWorkspaceId = workspaceId || user?.defaultWorkspaceId;
  if (!targetWorkspaceId) {
    throw new HttpError(400, "No active workspace found");
  }

  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: targetWorkspaceId,
        userId,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership) {
    throw new HttpError(403, "You do not have access to this workspace");
  }

  return membership;
};

export const requireWorkspaceRole = (
  role: "OWNER" | "ADMIN" | "VIEWER",
  currentRole: "OWNER" | "ADMIN" | "VIEWER"
) => {
  const order = {
    VIEWER: 1,
    ADMIN: 2,
    OWNER: 3,
  } as const;

  if (order[currentRole] < order[role]) {
    throw new HttpError(403, "Insufficient permissions for this workspace");
  }
};
