import { Request, Response, NextFunction } from "express";
import { sessionCookieName } from "../config/security";
import { getCookie } from "../utils/cookies";
import { verifyToken } from "../utils/jwt";

export interface AuthRequest extends Request {
  userId?: string;
}

export const extractSessionToken = (req: Request) => {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return getCookie(req, sessionCookieName);
};

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = extractSessionToken(req);

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
