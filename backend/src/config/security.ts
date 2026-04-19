import { env } from "./env";

const allowedOriginSet = new Set(env.FRONTEND_URLS);

export const allowedOrigins = [...allowedOriginSet];
export const allowedMethods = ["GET", "POST", "DELETE", "OPTIONS"];
export const allowedHeaders = ["Content-Type", "X-CSRF-Token"];
export const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
export const sessionCookieName = "api_monitor_session";
export const csrfCookieName = "api_monitor_csrf";

export const isAllowedOrigin = (origin?: string | null) => {
  if (!origin) {
    return false;
  }

  return allowedOriginSet.has(origin.replace(/\/$/, ""));
};
