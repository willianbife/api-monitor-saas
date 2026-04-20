import { NextFunction, Request, Response } from "express";
import { isAllowedOrigin, safeMethods } from "../config/security";
import { verifySignedCsrfToken } from "../utils/csrf";

const normalizeOrigin = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, "");
  }
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  if (safeMethods.has(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin ?? req.headers.referer;
  if (!origin || !isAllowedOrigin(normalizeOrigin(origin.toString()))) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }

  const csrfHeader = req.header("X-CSRF-Token");

  if (!csrfHeader || !verifySignedCsrfToken(csrfHeader)) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }

  next();
};
