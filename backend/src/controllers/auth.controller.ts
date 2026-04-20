import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import prisma from "../lib/prisma";
import {
  clearSessionCookie,
  setSessionCookie,
} from "../utils/cookies";
import { generateToken } from "../utils/jwt";
import { sanitizePlainText } from "../utils/sanitize";
import { HttpError } from "../utils/http-errors";
import { AuthRequest } from "../middlewares/auth.middleware";
import { generateSignedCsrfToken } from "../utils/csrf";

const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128)
      .regex(/[A-Z]/, "Password must contain at least one uppercase character")
      .regex(/[a-z]/, "Password must contain at least one lowercase character")
      .regex(/[0-9]/, "Password must contain at least one number"),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

const issueSession = (res: Response, userId: string) => {
  const sessionToken = generateToken(userId);
  const csrfToken = generateSignedCsrfToken();

  setSessionCookie(res, sessionToken);

  return csrfToken;
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = registerSchema.parse(req.body);
  const sanitizedEmail = sanitizePlainText(email);

  const existingUser = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
  if (existingUser) {
    throw new HttpError(409, "Email already in use");
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: sanitizedEmail,
      password: hashedPassword,
    },
    select: {
      id: true,
      email: true,
    },
  });

  const csrfToken = issueSession(res, user.id);
  res.status(201).json({ user, csrfToken });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = loginSchema.parse(req.body);
  const sanitizedEmail = sanitizePlainText(email);

  const user = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new HttpError(401, "Invalid credentials");
  }

  const csrfToken = issueSession(res, user.id);
  res.status(200).json({
    user: { id: user.id, email: user.email },
    csrfToken,
  });
};

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, createdAt: true },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  const csrfToken = generateSignedCsrfToken();

  res.json({ user, csrfToken });
};

export const csrf = async (_req: Request, res: Response): Promise<void> => {
  const csrfToken = generateSignedCsrfToken();
  res.status(200).json({ csrfToken });
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  clearSessionCookie(res);
  res.status(204).send();
};
