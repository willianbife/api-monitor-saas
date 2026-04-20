import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import prisma from "../lib/prisma";
import {
  clearRefreshCookie,
  clearSessionCookie,
  getCookie,
  setRefreshCookie,
  setSessionCookie,
} from "../utils/cookies";
import { generateToken, verifyToken } from "../utils/jwt";
import { sanitizePlainText } from "../utils/sanitize";
import { HttpError } from "../utils/http-errors";
import { AuthRequest, extractSessionToken } from "../middlewares/auth.middleware";
import { generateSignedCsrfToken } from "../utils/csrf";
import { refreshCookieName } from "../config/security";
import { generateOpaqueToken, hashToken } from "../utils/crypto";
import { env } from "../config/env";
import { createPersonalWorkspace } from "../services/workspace.service";
import { recordAuditEvent } from "../services/audit.service";

const DUMMY_PASSWORD_HASH =
  "$2b$12$k.HXoyXnYSKVpUDP2oBuReb1ELUYWYrvFByX0zDgbV08mFR4UlHeO";

const invalidCredentialsError = () => new HttpError(401, "Invalid credentials");

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128)
  .regex(/[A-Z]/, "Password must contain at least one uppercase character")
  .regex(/[a-z]/, "Password must contain at least one lowercase character")
  .regex(/[0-9]/, "Password must contain at least one number");

const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: passwordSchema,
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

const requestResetSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();

const resetPasswordSchema = z
  .object({
    token: z.string().min(20),
    password: passwordSchema,
  })
  .strict();

const verifyEmailSchema = z
  .object({
    token: z.string().min(20),
  })
  .strict();

const buildAuthPayload = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      defaultWorkspaceId: true,
      memberships: {
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
              billingStatus: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    defaultWorkspaceId: user.defaultWorkspaceId,
    workspaces: user.memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      plan: membership.workspace.plan,
      billingStatus: membership.workspace.billingStatus,
      role: membership.role,
    })),
  };
};

const issueRefreshToken = async (userId: string, req: Request, res: Response) => {
  const refreshToken = generateOpaqueToken(48);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      userAgent: req.get("user-agent") || null,
      ipAddress: req.ip || null,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  setRefreshCookie(res, refreshToken);
};

const issueSession = async (req: Request, res: Response, userId: string) => {
  const sessionToken = generateToken(userId);
  const csrfToken = generateSignedCsrfToken();

  setSessionCookie(res, sessionToken);
  await issueRefreshToken(userId, req, res);

  return csrfToken;
};

const sanitizeEmail = (email: string) => sanitizePlainText(email);

const serializeTokenForResponse = (token: string) =>
  env.NODE_ENV === "production" ? undefined : token;

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = registerSchema.parse(req.body);
  const sanitizedEmail = sanitizeEmail(email);

  const existingUser = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
  if (existingUser) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    res.status(202).json({
      success: true,
      user: null,
      csrfToken: generateSignedCsrfToken(),
    });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: sanitizedEmail,
      password: hashedPassword,
    },
  });

  await createPersonalWorkspace(user.id, user.email);

  const verificationToken = generateOpaqueToken(32);
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(verificationToken),
      expiresAt: new Date(
        Date.now() + env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES * 60 * 1000
      ),
    },
  });

  const csrfToken = await issueSession(req, res, user.id);
  const authUser = await buildAuthPayload(user.id);

  await recordAuditEvent({
    action: "USER_REGISTERED",
    targetType: "user",
    targetId: user.id,
    userId: user.id,
    workspaceId: authUser.defaultWorkspaceId,
  });

  res.status(202).json({
    success: true,
    user: authUser,
    csrfToken,
    emailVerificationToken: serializeTokenForResponse(verificationToken),
  });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = loginSchema.parse(req.body);
  const sanitizedEmail = sanitizeEmail(email);

  const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw invalidCredentialsError();
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw invalidCredentialsError();
  }

  const csrfToken = await issueSession(req, res, user.id);
  const authUser = await buildAuthPayload(user.id);

  await recordAuditEvent({
    action: "USER_LOGGED_IN",
    targetType: "user",
    targetId: user.id,
    userId: user.id,
    workspaceId: authUser.defaultWorkspaceId,
  });

  res.status(200).json({
    user: authUser,
    csrfToken,
  });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = getCookie(req, refreshCookieName);

  if (!refreshToken) {
    throw new HttpError(401, "Session is invalid or expired");
  }

  const tokenHash = hashToken(refreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
    throw new HttpError(401, "Session is invalid or expired");
  }

  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: {
      revokedAt: new Date(),
      lastUsedAt: new Date(),
    },
  });

  const csrfToken = await issueSession(req, res, storedToken.userId);
  const authUser = await buildAuthPayload(storedToken.userId);

  res.status(200).json({
    user: authUser,
    csrfToken,
  });
};

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const user = await buildAuthPayload(req.userId);
  const csrfToken = generateSignedCsrfToken();

  res.json({ user, csrfToken });
};

export const session = async (req: Request, res: Response): Promise<void> => {
  const token = extractSessionToken(req);

  if (!token) {
    res.status(200).json({
      authenticated: false,
      user: null,
      csrfToken: generateSignedCsrfToken(),
    });
    return;
  }

  try {
    const { userId } = verifyToken(token);
    const user = await buildAuthPayload(userId);

    res.status(200).json({
      authenticated: true,
      user,
      csrfToken: generateSignedCsrfToken(),
    });
  } catch {
    res.status(200).json({
      authenticated: false,
      user: null,
      csrfToken: generateSignedCsrfToken(),
    });
  }
};

export const csrf = async (_req: Request, res: Response): Promise<void> => {
  const csrfToken = generateSignedCsrfToken();
  res.status(200).json({ csrfToken });
};

export const requestPasswordReset = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email } = requestResetSchema.parse(req.body);
  const sanitizedEmail = sanitizeEmail(email);

  const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
  if (!user) {
    res.status(202).json({ success: true });
    return;
  }

  const rawToken = generateOpaqueToken(32);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(
        Date.now() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000
      ),
    },
  });

  await recordAuditEvent({
    action: "PASSWORD_RESET_REQUESTED",
    targetType: "user",
    targetId: user.id,
    userId: user.id,
  });

  res.status(202).json({
    success: true,
    resetToken: serializeTokenForResponse(rawToken),
  });
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { token, password } = resetPasswordSchema.parse(req.body);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    throw new HttpError(400, "Reset token is invalid or expired");
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await recordAuditEvent({
    action: "PASSWORD_RESET_COMPLETED",
    targetType: "user",
    targetId: resetToken.userId,
    userId: resetToken.userId,
  });

  res.status(200).json({ success: true });
};

export const requestEmailVerification = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const rawToken = generateOpaqueToken(32);

  await prisma.emailVerificationToken.create({
    data: {
      userId: req.userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(
        Date.now() + env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES * 60 * 1000
      ),
    },
  });

  await recordAuditEvent({
    action: "EMAIL_VERIFICATION_REQUESTED",
    targetType: "user",
    targetId: req.userId,
    userId: req.userId,
  });

  res.status(202).json({
    success: true,
    verificationToken: serializeTokenForResponse(rawToken),
  });
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const { token } = verifyEmailSchema.parse(req.body);
  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (
    !verificationToken ||
    verificationToken.usedAt ||
    verificationToken.expiresAt < new Date()
  ) {
    throw new HttpError(400, "Verification token is invalid or expired");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await recordAuditEvent({
    action: "EMAIL_VERIFIED",
    targetType: "user",
    targetId: verificationToken.userId,
    userId: verificationToken.userId,
  });

  res.status(200).json({ success: true });
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  const refreshToken = getCookie(req, refreshCookieName);

  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashToken(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  clearSessionCookie(res);
  clearRefreshCookie(res);

  if (req.userId) {
    await recordAuditEvent({
      action: "USER_LOGGED_OUT",
      targetType: "user",
      targetId: req.userId,
      userId: req.userId,
    });
  }

  res.status(204).send();
};
