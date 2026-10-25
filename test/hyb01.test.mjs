import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkManifest } from "../scripts/hybrid/verify-upstreams.mjs";

const manifest = JSON.parse(readFileSync(new URL("../config/hybrid/upstreams.lock.json", import.meta.url)));
test("HYB-01 pins three exact unqualified native source revisions", () => {
  assert.equal(checkManifest(manifest).length, 3);
});
test("reject mutable and unapproved source references", () => {
  for (const changed of [
    { commit: "main" }, { commit: "1234" },
    { repository: "someone-else/open_tms" },
    { implementationSupport: "CERTIFIED" }
  ]) {
    const copy = structuredClone(manifest);
    Object.assign(copy.upstreams[2], changed);
    assert.throws(() => checkManifest(copy));
  }
});
test("do not treat source pinning as release permission", () => {
  const copy = structuredClone(manifest);
  copy.releaseStatus = "ACTIVE";
  assert.throws(() => checkManifest(copy));
});
