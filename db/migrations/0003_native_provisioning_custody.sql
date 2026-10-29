-- HYB-03 / ADR-TMS-0021: first-party, DENY-ALL provisioning operation custody.
-- Not a CP plan store; TMS cannot make itself a CP approval or ACTIVE provider.
-- Only a CP/IAM authenticated future execution role may receive scoped policies.
BEGIN;
CREATE TABLE IF NOT EXISTS tms.native_provisioning_operation (
  tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 160),
  cp_operation_id text NOT NULL CHECK (length(cp_operation_id) BETWEEN 1 AND 160),
  native_provider_kind text NOT NULL CHECK
    (native_provider_kind IN ('FLEETBASE_FLEETOPS','OPEN_TMS')),
  environment text NOT NULL CHECK
    (environment IN ('development','test','staging','production')),
  operating_organisation_id text NOT NULL CHECK (length(operating_organisation_id) > 0),
  legal_entity_id text NOT NULL CHECK (length(legal_entity_id) > 0),
  market_participation_reference text NOT NULL CHECK (length(market_participation_reference) > 0),
  cp_binding_revision text NOT NULL CHECK (length(cp_binding_revision) > 0),
  plan_digest text NOT NULL CHECK (plan_digest ~ '^sha256:[0-9a-f]{64}$'),
  desired_state_digest text NOT NULL CHECK (desired_state_digest ~ '^sha256:[0-9a-f]{64}$'),
  provisioning_generation bigint NOT NULL CHECK (provisioning_generation > 0),
  lease_generation bigint NOT NULL CHECK (lease_generation > 0),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) > 0),
  state text NOT NULL DEFAULT 'PLANNED' CHECK
    (state IN ('PLANNED','CLAIMED','PARTIAL','PROVIDER_UNKNOWN','BLOCKED',
               'FAILED','READBACK_REQUIRED','READY','SUSPENDED','DEPROVISIONED')),
  -- Non-secret immutable receipts only; any signature/capability must be independently verified.
  observed_state_digest text CHECK
    (observed_state_digest IS NULL OR observed_state_digest ~ '^sha256:[0-9a-f]{64}$'),
  independent_observer_reference text,
  observed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, cp_operation_id),
  UNIQUE (tenant_id, native_provider_kind, environment,
          provisioning_generation, idempotency_key),
  CHECK (state <> 'READY' OR
    (observed_state_digest IS NOT NULL AND
     independent_observer_reference IS NOT NULL AND
     observed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_tms_native_provisioning_reconcile
  ON tms.native_provisioning_operation (tenant_id, state, updated_at)
  WHERE state IN ('PARTIAL','PROVIDER_UNKNOWN','READBACK_REQUIRED','BLOCKED');
ALTER TABLE tms.native_provisioning_operation ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.native_provisioning_operation FORCE ROW LEVEL SECURITY;
-- No runtime RLS allow policies. The app cannot bypass via a forged tenant header.
COMMIT;
