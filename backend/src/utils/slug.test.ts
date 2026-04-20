import test from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slug";

test("slugify normalizes accents and spaces", () => {
  assert.equal(slugify("Status da Aplicação"), "status-da-aplicacao");
});
