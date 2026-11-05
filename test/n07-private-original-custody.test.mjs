import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, rmSync, symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { original } from "../scripts/n07-real-issuer-cp-observe.mjs";

test("N07 rejects symlinked private output directories without producing evidence", (t) => {
  const root = mkdtempSync(join(tmpdir(), "tms-n07-private-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const privateDir = join(root, "owner-private");
  mkdirSync(privateDir, { mode: 0o700 });
  const alias = join(root, "redirected");
  symlinkSync(privateDir, alias, "dir");
  assert.throws(() => original(alias, { fully_qualified: false }));
  assert.deepEqual(readdirSync(privateDir), []);
});

test("N07 writes checksum-bound owner-private originals exactly once", (t) => {
  const root = mkdtempSync(join(tmpdir(), "tms-n07-custody-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = join(root, "evidence");
  const receipt = { classification: "UNATTESTED", booking_accepted: false };
  original(output, receipt);
  const raw = readFileSync(join(output, "original.json"));
  const digest = readFileSync(join(output, "original.sha256"), "utf8");
  assert.deepEqual(JSON.parse(raw), receipt);
  assert.equal(digest, createHash("sha256").update(raw).digest("hex") + "\n");
  for (const path of [output, join(output, "original.json"), join(output, "original.sha256")]) {
    assert.equal(lstatSync(path).mode & 0o077, 0, "evidence must be owner-private");
  }
  assert.throws(() => original(output, { booking_accepted: true }));
  assert.deepEqual(readFileSync(join(output, "original.json")), raw);
  assert.equal(readFileSync(join(output, "original.sha256"), "utf8"), digest);
});

test("N07 refuses group-readable evidence directories", (t) => {
  const root = mkdtempSync(join(tmpdir(), "tms-n07-world-readable-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = join(root, "not-private");
  mkdirSync(output, { mode: 0o700 });
  chmodSync(output, 0o750);
  assert.throws(() => original(output, { fully_qualified: false }));
  assert.equal(existsSync(join(output, "original.json")), false);
});
