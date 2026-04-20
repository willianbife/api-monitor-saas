import crypto from "crypto";
import { env } from "../config/env";

const algorithm = "aes-256-gcm";
const key = crypto.createHash("sha256").update(env.APP_ENCRYPTION_KEY).digest();

export const generateOpaqueToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const encryptJson = (payload: unknown) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encoded = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encoded.toString("hex")].join(":");
};

export const decryptJson = <T>(value?: string | null): T | null => {
  if (!value) {
    return null;
  }

  const [ivHex, authTagHex, encryptedHex] = value.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    return null;
  }

  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
};
