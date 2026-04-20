import test from "node:test";
import assert from "node:assert/strict";
import { assertSafeMonitoringUrl } from "./ssrf";

test("assertSafeMonitoringUrl blocks localhost targets", async () => {
  await assert.rejects(
    () => assertSafeMonitoringUrl("http://127.0.0.1:3000/health"),
    /not allowed|private or local/i
  );
});
