import crypto from "crypto";
import { env } from "../config/env";

const CSRF_TTL_MS = 1000 * 60 * 60 * 8;

const sign = (payload: string) =>
  crypto.createHmac("sha256", env.JWT_SECRET_CURRENT).update(payload).digest("hex");

export const generateSignedCsrfToken = () => {
  const expiresAt = Date.now() + CSRF_TTL_MS;
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${expiresAt}.${nonce}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
};

export const verifySignedCsrfToken = (token: string) => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [expiresAtRaw, nonce, providedSignature] = parts;
  const expiresAt = Number(expiresAtRaw);

  if (!Number.isFinite(expiresAt) || !nonce || expiresAt < Date.now()) {
    return false;
  }

  const payload = `${expiresAt}.${nonce}`;
  const expectedSignature = sign(payload);

  return crypto.timingSafeEqual(
    Buffer.from(providedSignature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
};
