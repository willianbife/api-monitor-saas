import test from "node:test";
import assert from "node:assert/strict";

test("encryptJson/decryptJson roundtrips payloads", async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://local:test@localhost:5432/test";
  process.env.JWT_SECRET_CURRENT =
    process.env.JWT_SECRET_CURRENT || "test-secret-value-that-is-at-least-thirty-two";

  const { decryptJson, encryptJson } = require("./crypto");
  const payload = { apiKey: "secret", enabled: true };
  const encrypted = encryptJson(payload);
  const decrypted = decryptJson(encrypted);

  assert.deepEqual(decrypted, payload);
});
