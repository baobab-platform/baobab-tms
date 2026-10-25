/**
 * Native provider eligibility is an INTERNAL TMS policy, not CP Capability
 * Resolution. CP resolves the Baobab TMS capability and attests context.
 * This function consumes verified/reconciled native-binding projections.
 *
 * No static "first provider", expired health, guessed certification or
 * unknown-outcome failover may authorise a material booking/dispatch.
 */

export const NATIVE_KINDS = Object.freeze(["FLEETBASE_FLEETOPS", "OPEN_TMS"]);

function same(value, expected) {
  return typeof value === "string" && value.length > 0 && value === expected;
}
function fresh(value, now) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    Date.parse(value) > now.getTime();
}

function eligible(binding, request, now) {
  if (!binding || !NATIVE_KINDS.includes(binding.nativeProviderKind)) return false;
  if (!same(binding.tenantId, request.tenantId) ||
      !same(binding.operatingOrganisationId, request.operatingOrganisationId) ||
      !same(binding.legalEntityId, request.legalEntityId) ||
      !same(binding.marketId, request.marketId) ||
      !same(binding.environment, request.environment)) return false;

  return binding.lifecycleState === "ACTIVE" &&
    binding.readiness === "READY" &&
    binding.observedHealth === "HEALTHY" &&
    fresh(binding.verifiedUntil, now) &&
    fresh(binding.healthExpiresAt, now) &&
    typeof binding.bindingId === "string" && binding.bindingId.length > 0 &&
    typeof binding.nativeProviderReleaseDigest === "string" &&
    /^sha256:[a-f0-9]{64}$/.test(binding.nativeProviderReleaseDigest) &&
    typeof binding.cpCapabilityBindingRevision === "string" &&
    binding.cpCapabilityBindingRevision.length > 0 &&
    typeof binding.policyDigest === "string" && binding.policyDigest.length > 0 &&
    typeof binding.nativeCredentialSecretRef === "string" &&
    binding.nativeCredentialSecretRef.length > 0 &&
    Array.isArray(binding.certifiedOperations) &&
    binding.certifiedOperations.includes(request.operation) &&
    Array.isArray(binding.supportedModes) &&
    binding.supportedModes.includes(request.mode);
}

/**
 * Pure decision only. Do not treat arbitrary HTTP or vendor input as verified
 * bindings. Production requires signed/validated CP + independent provider
 * observation and current authorization on the actual execution path.
 */
export function selectNativeProvider({ request, bindings, at = new Date() }) {
  const required = ["tenantId", "operatingOrganisationId", "legalEntityId",
    "marketId", "environment", "operation", "mode"];
  if (!request || required.some((field) =>
    typeof request[field] !== "string" || request[field].length === 0)) {
    return Object.freeze({ status: "BLOCKED", reason: "INVALID_GOVERNED_CONTEXT" });
  }
  if (!Array.isArray(bindings) || !Number.isFinite(at.getTime())) {
    return Object.freeze({ status: "BLOCKED", reason: "INVALID_PROVIDER_EVIDENCE" });
  }
  const matching = bindings.filter((binding) => eligible(binding, request, at));
  if (request.committedBindingId) {
    const pinned = matching.find((binding) =>
      binding.bindingId === request.committedBindingId);
    if (!pinned) {
      return Object.freeze({ status: "BLOCKED", reason: "PINNED_PROVIDER_UNAVAILABLE" });
    }
    return Object.freeze({
      status: "ELIGIBLE",
      bindingId: pinned.bindingId,
      nativeProviderKind: pinned.nativeProviderKind
    });
  }
  if (matching.length === 0) {
    return Object.freeze({ status: "BLOCKED", reason: "NO_VERIFIED_ELIGIBLE_PROVIDER" });
  }
  // Deterministic policy priority, with immutable binding ID as tie-break.
  matching.sort((a, b) => {
    const pa = Number.isSafeInteger(a.priority) ? a.priority : Number.MAX_SAFE_INTEGER;
    const pb = Number.isSafeInteger(b.priority) ? b.priority : Number.MAX_SAFE_INTEGER;
    return pa - pb || a.bindingId.localeCompare(b.bindingId);
  });
  const chosen = matching[0];
  return Object.freeze({
    status: "ELIGIBLE",
    bindingId: chosen.bindingId,
    nativeProviderKind: chosen.nativeProviderKind
  });
}
