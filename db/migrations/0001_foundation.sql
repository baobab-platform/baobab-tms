-- FND-01 / ADR-TMS-0001/0002/0020/0021: canonical PostgreSQL 17 schema foundation.
-- Not yet runtime-applied or production qualified. No native-provider DB shares this schema.
-- IMPORTANT: No RLS allow policies are installed. Runtime SQL access remains DENIED
-- until IAM/CP-backed transaction context and adversarial PG17 integration tests exist.
-- Execute migrations with a separate unprivileged owner; runtime MUST NOT be owner,
-- superuser, or have BYPASSRLS. All timestamps are source-labelled and time-zone aware.

BEGIN;
CREATE SCHEMA IF NOT EXISTS tms;

CREATE TABLE IF NOT EXISTS tms.logistics_shipment (
  tenant_id text NOT NULL,
  shipment_id text NOT NULL,
  operating_organisation_id text NOT NULL,
  legal_entity_id text NOT NULL,
  market_id text NOT NULL,
  lifecycle_state text NOT NULL DEFAULT 'DRAFT'
    CHECK (lifecycle_state IN ('DRAFT','BLOCKED')),
  aggregate_version bigint NOT NULL DEFAULT 1 CHECK (aggregate_version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, shipment_id),
  UNIQUE (tenant_id, shipment_id, operating_organisation_id, legal_entity_id, market_id),
  CHECK (
    length(tenant_id) > 0 AND length(shipment_id) > 0 AND
    length(operating_organisation_id) > 0 AND
    length(legal_entity_id) > 0 AND length(market_id) > 0
  )
);

CREATE TABLE IF NOT EXISTS tms.consignment (
  tenant_id text NOT NULL,
  consignment_id text NOT NULL,
  operating_organisation_id text NOT NULL,
  legal_entity_id text NOT NULL,
  market_id text NOT NULL,
  consignor_reference text NOT NULL,
  consignee_reference text NOT NULL,
  lifecycle_state text NOT NULL DEFAULT 'DRAFT'
    CHECK (lifecycle_state IN ('DRAFT','BLOCKED')),
  aggregate_version bigint NOT NULL DEFAULT 1 CHECK (aggregate_version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, consignment_id),
  UNIQUE (tenant_id, consignment_id, operating_organisation_id, legal_entity_id, market_id),
  CHECK (length(consignor_reference) > 0 AND length(consignee_reference) > 0 AND
    length(tenant_id) > 0 AND length(consignment_id) > 0 AND
    length(operating_organisation_id) > 0 AND
    length(legal_entity_id) > 0 AND length(market_id) > 0)
);

-- Cross-engine source lineage is not interchangeable with shipment identity.
CREATE TABLE IF NOT EXISTS tms.shipment_source_requirement (
  tenant_id text NOT NULL,
  shipment_id text NOT NULL,
  source_type text NOT NULL,
  source_reference text NOT NULL,
  PRIMARY KEY (tenant_id, shipment_id, source_type, source_reference),
  FOREIGN KEY (tenant_id, shipment_id)
    REFERENCES tms.logistics_shipment (tenant_id, shipment_id)
    ON DELETE RESTRICT
);

-- CargoItem is a shipment snapshot, NOT an ERP inventory or Trade Product.
CREATE TABLE IF NOT EXISTS tms.cargo_item (
  tenant_id text NOT NULL,
  shipment_id text NOT NULL,
  cargo_item_id text NOT NULL,
  description text NOT NULL,
  quantity numeric(28,9) NOT NULL CHECK (quantity > 0),
  unit_of_measure text NOT NULL CHECK (length(unit_of_measure) > 0),
  PRIMARY KEY (tenant_id, shipment_id, cargo_item_id),
  FOREIGN KEY (tenant_id, shipment_id)
    REFERENCES tms.logistics_shipment (tenant_id, shipment_id)
    ON DELETE RESTRICT
);

-- Many-to-many with EXACT same tenant, operating actor, legal entity and market.
-- Cargo-specific allocation remains explicit, not an ambiguous single FK.
CREATE TABLE IF NOT EXISTS tms.shipment_consignment_allocation (
  tenant_id text NOT NULL,
  shipment_id text NOT NULL,
  consignment_id text NOT NULL,
  operating_organisation_id text NOT NULL,
  legal_entity_id text NOT NULL,
  market_id text NOT NULL,
  cargo_item_id text NOT NULL,
  allocation_quantity numeric(28,9) CHECK (allocation_quantity > 0),
  allocation_unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, shipment_id, consignment_id, cargo_item_id),
  FOREIGN KEY (tenant_id, shipment_id, operating_organisation_id, legal_entity_id, market_id)
    REFERENCES tms.logistics_shipment
      (tenant_id, shipment_id, operating_organisation_id, legal_entity_id, market_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, consignment_id, operating_organisation_id, legal_entity_id, market_id)
    REFERENCES tms.consignment
      (tenant_id, consignment_id, operating_organisation_id, legal_entity_id, market_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, shipment_id, cargo_item_id)
    REFERENCES tms.cargo_item (tenant_id, shipment_id, cargo_item_id)
    ON DELETE RESTRICT,
  CHECK ((allocation_quantity IS NULL AND allocation_unit IS NULL)
      OR (allocation_quantity IS NOT NULL AND allocation_unit IS NOT NULL AND length(allocation_unit) > 0))
);

-- One internal native-binding identity per scoped execution provider record.
-- Vendor native organisations/driver accounts must never become CP tenants.
CREATE TABLE IF NOT EXISTS tms.native_execution_binding (
  tenant_id text NOT NULL,
  binding_id text NOT NULL,
  operating_organisation_id text NOT NULL,
  legal_entity_id text NOT NULL,
  market_id text NOT NULL,
  environment text NOT NULL,
  native_provider_kind text NOT NULL
    CHECK (native_provider_kind IN ('FLEETBASE_FLEETOPS','OPEN_TMS')),
  native_provider_release_digest text,
  native_credential_secret_ref text, -- Reference only, never actual secret material.
  cp_capability_binding_revision text,
  policy_digest text,
  verified_until timestamptz,
  health_expires_at timestamptz,
  readiness text NOT NULL DEFAULT 'UNKNOWN',
  lifecycle_state text NOT NULL DEFAULT 'CREATED',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, binding_id),
  CHECK (lifecycle_state IN ('CREATED','CONFIGURING','VERIFYING','READY',
                             'ACTIVE','DEGRADED','SUSPENDED','MIGRATING',
                             'RETIRING','DEPROVISIONED','BLOCKED','FAILED')),
  CHECK (length(tenant_id) > 0 AND length(binding_id) > 0 AND
    length(operating_organisation_id) > 0 AND
    length(legal_entity_id) > 0 AND length(market_id) > 0),
  CHECK (lifecycle_state <> 'ACTIVE' OR (
    readiness = 'READY' AND
    verified_until IS NOT NULL AND health_expires_at IS NOT NULL AND
    native_provider_release_digest IS NOT NULL AND
    native_provider_release_digest ~ '^sha256:[a-f0-9]{64}$' AND
    native_credential_secret_ref IS NOT NULL AND
    cp_capability_binding_revision IS NOT NULL AND policy_digest IS NOT NULL
  ))
);

-- Deliberately NO RLS policies. Even permissive-scoped policies would be
-- deceptive without verified IAM/CP context and transaction role mapping.
ALTER TABLE tms.logistics_shipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.consignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.shipment_source_requirement ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.cargo_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.shipment_consignment_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.native_execution_binding ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.logistics_shipment FORCE ROW LEVEL SECURITY;
ALTER TABLE tms.consignment FORCE ROW LEVEL SECURITY;
ALTER TABLE tms.shipment_source_requirement FORCE ROW LEVEL SECURITY;
ALTER TABLE tms.cargo_item FORCE ROW LEVEL SECURITY;
ALTER TABLE tms.shipment_consignment_allocation FORCE ROW LEVEL SECURITY;
ALTER TABLE tms.native_execution_binding FORCE ROW LEVEL SECURITY;

COMMIT;
