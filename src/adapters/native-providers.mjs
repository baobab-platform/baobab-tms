/**
 * Anti-corruption ports are intentionally disconnected until HYB-01..04
 * proves upstream licensing, API semantics, native tenant/worker isolation,
 * carrier authority, signed callbacks and reconciliation.
 *
 * Never infer CONFIRMED booking from a 200/202 HTTP response.
 */
export class UnsupportedNativeOperationError extends Error {
  constructor(operation, provider) {
    super("UNSUPPORTED_NATIVE_OPERATION: " + provider + ":" + operation);
    this.name = "UnsupportedNativeOperationError";
    this.code = "UNSUPPORTED_NATIVE_OPERATION";
  }
}

function disabledAdapter(provider) {
  return Object.freeze({
    provider,
    async provision() { throw new UnsupportedNativeOperationError("provision", provider); },
    async book() { throw new UnsupportedNativeOperationError("book", provider); },
    async dispatch() { throw new UnsupportedNativeOperationError("dispatch", provider); },
    async ingestTracking() { throw new UnsupportedNativeOperationError("ingestTracking", provider); },
    async reconcile() { throw new UnsupportedNativeOperationError("reconcile", provider); }
  });
}

export const fleetbaseFleetOps = disabledAdapter("FLEETBASE_FLEETOPS");
export const openTms = disabledAdapter("OPEN_TMS");
