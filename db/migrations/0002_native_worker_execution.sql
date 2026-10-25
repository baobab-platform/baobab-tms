-- HYB-02, ADR-TMS-0020/0021: durable native operation replay custody.
-- First-party canonical TMS database only. NEVER run this in native Open TMS.
-- No RLS allow policies until current CP/IAM transaction executor is certified.
BEGIN;
CREATE TABLE IF NOT EXISTS tms.native_worker_execution (
  tenant_id text NOT NULL CHECK (length(tenant_id) > 0),
  native_binding_id text NOT NULL CHECK (length(native_binding_id) > 0),
  operating_organisation_id text NOT NULL CHECK (length(operating_organisation_id) > 0),
  operation_id text NOT NULL CHECK (length(operation_id) > 0),
  native_worker_kind text NOT NULL CHECK (length(native_worker_kind) > 0),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  -- Real CP plan generation and worker lease generation must not be conflated.
  cp_fencing_generation bigint NOT NULL CHECK (cp_fencing_generation > 0),
  lease_generation bigint NOT NULL DEFAULT 1 CHECK (lease_generation > 0),
  state text NOT NULL CHECK (state IN
    ('CLAIMED','COMPLETED','UNKNOWN','RECONCILIATION_REQUIRED','CANCELLED')),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) > 0),
  cp_decision_reference text NOT NULL CHECK (length(cp_decision_reference) > 0),
  cp_verification_expires_at timestamptz NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_reconciled_at timestamptz,
  PRIMARY KEY (tenant_id, native_binding_id, operation_id),
  UNIQUE (tenant_id, native_binding_id, idempotency_key),
  FOREIGN KEY (tenant_id, native_binding_id) REFERENCES
    tms.native_execution_binding (tenant_id, binding_id) ON DELETE RESTRICT,
  CHECK ((state = 'COMPLETED' AND completed_at IS NOT NULL) OR
         (state <> 'COMPLETED' AND completed_at IS NULL))
);
CREATE INDEX IF NOT EXISTS ix_native_worker_execution_reconciliation
  ON tms.native_worker_execution(tenant_id, state, started_at)
  WHERE state IN ('UNKNOWN','RECONCILIATION_REQUIRED');
ALTER TABLE tms.native_worker_execution ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.native_worker_execution FORCE ROW LEVEL SECURITY;
-- DENY BY DEFAULT. Qualified CP/Audit ownership must implement the
-- transactional admission and completion functions, not ad-hoc SQL writes.
COMMIT;
