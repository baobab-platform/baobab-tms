import test from "node:test";
import assert from "node:assert/strict";
import { selectNativeProvider } from "../src/domain/provider-selection.mjs";
import { fleetbaseFleetOps, openTms, UnsupportedNativeOperationError } from "../src/adapters/native-providers.mjs";

const request = {
  tenantId: "tenant-a", operatingOrganisationId: "org-a",
  legalEntityId: "legal-a", marketId: "market-ug",
  environment: "development", operation: "dispatch", mode: "ROAD"
};
const at = new Date("2026-10-25T12:00:00Z");
const binding = {
  bindingId: "native-binding-a",
  nativeProviderKind: "FLEETBASE_FLEETOPS",
  tenantId: "tenant-a", operatingOrganisationId: "org-a",
  legalEntityId: "legal-a", marketId: "market-ug", environment: "development",
  lifecycleState: "ACTIVE", readiness: "READY", observedHealth: "HEALTHY",
  verifiedUntil: "2026-10-26T12:00:00Z",
  healthExpiresAt: "2026-10-25T12:05:00Z",
  nativeProviderReleaseDigest: "sha256:" + "a".repeat(64),
  cpCapabilityBindingRevision: "rev-1", policyDigest: "policy-1",
  nativeCredentialSecretRef: "secret-reference-only",
  certifiedOperations: ["dispatch"], supportedModes: ["ROAD"], priority: 2
};

test("no providers always blocks transport commitments", () => {
  assert.deepEqual(selectNativeProvider({ request, bindings: [], at }),
    { status: "BLOCKED", reason: "NO_VERIFIED_ELIGIBLE_PROVIDER" });
});

test("only exact, fresh, verified native binding can be selected", () => {
  assert.deepEqual(selectNativeProvider({ request, bindings: [binding], at }),
    { status: "ELIGIBLE", bindingId: "native-binding-a", nativeProviderKind: "FLEETBASE_FLEETOPS" });
  for (const changed of [
    { tenantId: "tenant-b" }, { legalEntityId: "other-legal" },
    { marketId: "market-za" }, { environment: "staging" },
    { lifecycleState: "SUSPENDED" }, { readiness: "UNKNOWN" },
    { observedHealth: "UNKNOWN" }, { healthExpiresAt: "2026-10-25T11:59:59Z" },
    { verifiedUntil: "2026-10-25T11:59:59Z" }, { certifiedOperations: [] },
    { supportedModes: ["SEA"] }, { nativeProviderReleaseDigest: "" },
    { cpCapabilityBindingRevision: "" }, { nativeCredentialSecretRef: "" }
  ]) {
    const result = selectNativeProvider({ request, bindings: [{ ...binding, ...changed }], at });
    assert.equal(result.status, "BLOCKED", JSON.stringify(changed));
  }
});

test("committed booking never silently falls through to other native provider", () => {
  const secondary = {
    ...binding, bindingId: "native-binding-b", nativeProviderKind: "OPEN_TMS",
    priority: 1
  };
  const result = selectNativeProvider({
    request: { ...request, committedBindingId: "native-binding-previous" },
    bindings: [binding, secondary], at
  });
  assert.deepEqual(result, { status: "BLOCKED", reason: "PINNED_PROVIDER_UNAVAILABLE" });
});

test("mock native adapter ports do not simulate booking or dispatch success", async () => {
  await assert.rejects(fleetbaseFleetOps.dispatch({}), UnsupportedNativeOperationError);
  await assert.rejects(openTms.book({}), UnsupportedNativeOperationError);
  await assert.rejects(openTms.provision({}), /UNSUPPORTED_NATIVE_OPERATION/);
});
