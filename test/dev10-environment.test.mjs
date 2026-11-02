// DEV-10 regression: source contract != certified TMS native runtime.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const image = "ghcr.io/baobab-platform/baobab-dev:1.4.4@sha256:9603f0e7402aa85771e904db1c20f2ecc02f705131b266cb4ec3d1c24ea58ae4";
const shared = "ef683c9f77d149c28f4ff3bcc59ca9aa2a514d7a";

test("engine remains experimental with Node/npm, Foundation and no runtime image", () => {
  const repo = source(".baobab/repository.yaml");
  assert.match(repo, /lifecycle:\s*experimental/);
  assert.match(repo, /- node\s/);
  assert.match(repo, /required:\s*true/);
  assert.match(repo, /profile:\s*full/);
  assert.match(repo, /node:\s*npm/);
  assert.match(repo, /container:\s*false/);
  assert.match(repo, /sast_provider:\s*codeql/);
});
test("declared full-profile development tools are not TMS business capabilities", () => {
  const contract = source(".baobab/environment.yaml");
  assert.match(contract, /name:\s*"baobab-tms"/);
  assert.match(contract, /version:\s*"0\.1\.0-foundation\.1"/);
  for (const cap of ["languages.node", "database.postgresql", "development.docker", "development.github_cli"]) {
    assert.ok(contract.includes(`- "${cap}"`), cap);
  }
  assert.doesNotMatch(contract, /logistics\.shipment\.manage/);
  const provider = source(".baobab/capability-provider.yaml");
  assert.match(provider, /proposal_status:\s*CANDIDATE/);
  assert.doesNotMatch(provider, /^providers:/m);
});
test("exact Node, immutable image, safe private ports and frozen onboarding", () => {
  const dc = JSON.parse(source(".devcontainer/devcontainer.json"));
  assert.equal(source(".node-version").trim(), "24.21.0");
  assert.equal(dc.image, image);
  assert.equal(dc.remoteUser, "vscode");
  assert.equal(dc.portsAttributes["4080"].visibility, "private");
  assert.equal(dc.otherPortsAttributes.visibility, "private");
  assert.equal(dc.waitFor, "postCreateCommand");
  assert.match(dc.postCreateCommand, /npm ci --ignore-scripts/);
  assert.match(dc.postCreateCommand, /npm run check/);
  assert.match(dc.postCreateCommand, /baobab-verify --contract/);
  assert.ok(!dc.dockerComposeFile && !dc.service, "HYB native providers must not auto-start");
});
test("no dependency resolution or changed runtime version in the frozen npm lock", () => {
  const manifest = JSON.parse(source("package.json"));
  const lock = JSON.parse(source("package-lock.json"));
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.name, manifest.name);
  assert.equal(lock.version, manifest.version);
  assert.deepEqual(Object.keys(lock.packages), [""]);
  assert.deepEqual(lock.packages[""].engines, manifest.engines);
});
test("Foundation pins an immutable Shared workflow and its exact policy checkout", () => {
  const ci = source(".github/workflows/foundation.yml");
  assert.ok(ci.includes(`foundation-repository-gates.yml@${shared}`));
  assert.ok(ci.includes(`foundation_ref: "${shared}"`));
  assert.match(ci, /dependency_review_enabled: true/);
  const checks = source(".github/workflows/dev10-environment.yml");
  assert.ok(checks.includes(image));
  assert.match(checks, /npm ci --ignore-scripts/);
  assert.match(checks, /--user vscode/);
});
