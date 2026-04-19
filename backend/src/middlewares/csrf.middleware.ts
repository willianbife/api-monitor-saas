import { NextFunction, Request, Response } from "express";
import { csrfCookieName, isAllowedOrigin, safeMethods } from "../config/security";
import { getCookie } from "../utils/cookies";

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

  const csrfCookie = getCookie(req, csrfCookieName);
  const csrfHeader = req.header("X-CSRF-Token");

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }

  next();
};
