import { Request, Response } from "express";
import crypto from "crypto";
import { refreshCookieName, sessionCookieName } from "../config/security";
import { env, isProduction } from "../config/env";

const baseCookieOptions = {
  path: "/",
  secure: isProduction,
};

export const parseCookies = (cookieHeader?: string) => {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) {
    return cookies;
  }

  for (const pair of cookieHeader.split(";")) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();

    if (!name) {
      continue;
    }

    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
};

export const getCookie = (req: Request, name: string) => {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[name];
};

export const generateCsrfToken = () => crypto.randomBytes(32).toString("hex");

export const setSessionCookie = (res: Response, token: string) => {
  res.cookie(sessionCookieName, token, {
    ...baseCookieOptions,
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * env.ACCESS_TOKEN_TTL_MINUTES,
  });
};

export const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(refreshCookieName, token, {
    ...baseCookieOptions,
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * env.REFRESH_TOKEN_TTL_DAYS,
  });
};

export const clearSessionCookie = (res: Response) => {
  res.clearCookie(sessionCookieName, {
    ...baseCookieOptions,
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
  });
};

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie(refreshCookieName, {
    ...baseCookieOptions,
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
  });
};
