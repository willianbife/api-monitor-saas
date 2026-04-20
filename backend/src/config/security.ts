import { env } from "./env";

const allowedOriginSet = new Set(env.FRONTEND_URLS);

export const allowedOrigins = [...allowedOriginSet];
export const allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
export const allowedHeaders = ["Content-Type", "X-CSRF-Token", "Authorization"];
export const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
export const sessionCookieName = "api_monitor_session";
export const refreshCookieName = "api_monitor_refresh";
export const csrfCookieName = "api_monitor_csrf";

export const securityHeaders = {
  frameOptions: "DENY",
  contentTypeOptions: "nosniff",
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: "camera=(), microphone=(), geolocation=()",
  contentSecurityPolicy: [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${allowedOrigins.join(" ")}`.trim(),
    "form-action 'self'",
    "manifest-src 'self'",
    "script-src 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
};

export const isAllowedOrigin = (origin?: string | null) => {
  if (!origin) {
    return false;
  }

  return allowedOriginSet.has(origin.replace(/\/$/, ""));
};
