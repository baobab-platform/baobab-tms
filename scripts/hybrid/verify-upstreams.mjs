#!/usr/bin/env node
/**
 * HYB-01 exact-source evidence guard.
 *
 * Does not launch either provider, certify security or infer permission to
 * activate provider support. An upstream commit hash is provenance, not a
 * vendor image digest or a dependency SBOM.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const filename = new URL("../../config/hybrid/upstreams.lock.json", import.meta.url);
const approved = Object.freeze(new Map([
  ["fleetbase-core", "fleetbase/fleetbase"],
  ["fleetops-extension", "fleetbase/fleetops"],
  ["open-tms", "DominicFinn/open_tms"]
]));
const hash = /^[0-9a-f]{40}$/;

export function checkManifest(m) {
  if (m?.schemaVersion !== 1 || m.releaseStatus !== "UNQUALIFIED" ||
      !Array.isArray(m.upstreams) || m.upstreams.length !== 3) {
    throw new Error("HYB-01 requires exactly three UNQUALIFIED source records");
  }
  const seen = new Set();
  for (const item of m.upstreams) {
    if (!approved.has(item.key) || approved.get(item.key) !== item.repository ||
        !hash.test(item.commit) || seen.has(item.key) ||
        !["AGPL-3.0", "AGPL-3.0-or-later", "MIT"].includes(item.license) ||
        !Array.isArray(item.evidencePaths) || item.evidencePaths.length < 2 ||
        item.implementationSupport !== "SOURCE_CENSUS_ONLY") {
      throw new Error("Invalid source pin/provenance: " + String(item?.key));
    }
    seen.add(item.key);
  }
  return m.upstreams;
}

export function evidenceInspection(m, root) {
  const records = checkManifest(m);
  for (const item of records) {
    const sourceRoot = join(root, item.path);
    if (!existsSync(sourceRoot)) throw new Error("Source checkout missing: " + item.key);
    const actual = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    if (actual !== item.commit) throw new Error("Source revision mismatch: " + item.key);
    for (const relative of item.evidencePaths) {
      if (relative.startsWith("/") || relative.split("/").includes("..") ||
          !existsSync(join(sourceRoot, relative))) {
        throw new Error("Missing/unsafe evidence path " + item.key + ": " + relative);
      }
    }
  }
  const fleetbase = readFileSync(join(root, "fleetbase/docker-compose.yml"), "utf8");
  const fleetbaseLicense = readFileSync(join(root, "fleetbase/LICENSE.md"), "utf8");
  const openLicense = readFileSync(join(root, "open_tms/LICENCE.md"), "utf8");
  const fleetops = JSON.parse(readFileSync(join(root, "fleetops/composer.json"), "utf8"));
  const opentms = readFileSync(join(root, "open_tms/docs/MULTI_TENANCY_REMEDIATION_PLAN.md"), "utf8");
  const compose = readFileSync(join(root, "open_tms/docker-compose.yml"), "utf8");
  if (!/GNU Affero General Public License/.test(fleetbaseLicense) ||
      !/^MIT License/.test(openLicense) ||
      !/image:\s*mysql:8/.test(fleetbase) || !/redis/i.test(fleetbase) ||
      !/socket/i.test(fleetbase) || !/AGPL-3.0/.test(fleetops.license) ||
      !/postgres:16/.test(compose) || !/cross-tenant|multi-tenan/i.test(opentms)) {
    throw new Error("Upstream assumptions changed; re-audit, do not rubber-stamp");
  }
  return {
    status: "CENSUS_VERIFIED_NOT_RUNTIME_CERTIFIED",
    pinned: records.map((entry) => ({ repository: entry.repository, commit: entry.commit })),
    blocked: [
      "FLEETBASE_AGPL_COMMERCIAL_DISPOSITION",
      "NATIVE_BUILD_AND_LOCKED_SBOM",
      "OPEN_TMS_UNRESOLVED_TENANT_ISOLATION",
      "NATIVE_OPERATION_LEVEL_CAPABILITY_CERTIFICATION",
      "REAL_MYSQL_AND_POSTGRESQL_VENDOR_MIGRATIONS",
      "IAM_CP_AT_EXECUTION_AND_NATIVE_PROVIDER_READBACK"
    ]
  };
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  const manifest = JSON.parse(readFileSync(filename, "utf8"));
  checkManifest(manifest);
  const rootIdx = process.argv.indexOf("--upstream-root");
  if (rootIdx === -1) {
    process.stdout.write("HYB-01 source pins structurally valid; runtime UNQUALIFIED\n");
  } else {
    if (!process.argv[rootIdx + 1]) throw new Error("Missing --upstream-root argument");
    process.stdout.write(JSON.stringify(evidenceInspection(manifest, process.argv[rootIdx + 1]), null, 2) + "\n");
  }
}
