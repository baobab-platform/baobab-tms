-- ADR-TMS-0003 TMS-PLAN-02: canonical transport plan and movement PG17 custody.
-- Accepted ADR-TMS-0020/0021: NOT Fleetbase/Open TMS native DBs.
-- No permissive runtime RLS policies, CP authorisation, carrier effects or events.
BEGIN;

CREATE TABLE IF NOT EXISTS tms.transport_plan (
  tenant_id text NOT NULL CHECK (length(tenant_id) > 0),
  plan_id text NOT NULL CHECK (length(plan_id) > 0),
  operating_organisation_id text NOT NULL CHECK (length(operating_organisation_id) > 0),
  legal_entity_id text NOT NULL CHECK (length(legal_entity_id) > 0),
  market_id text NOT NULL CHECK (length(market_id) > 0),
  current_revision bigint NOT NULL DEFAULT 1 CHECK (current_revision > 0),
  lifecycle_state text NOT NULL DEFAULT 'DRAFT' CHECK (
    lifecycle_state IN ('DRAFT','PROPOSED','APPROVED','COMMITTED','SUPERSEDED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, plan_id),
  UNIQUE (tenant_id,plan_id,operating_organisation_id,legal_entity_id,market_id)
);

CREATE TABLE IF NOT EXISTS tms.transport_plan_revision (
  tenant_id text NOT NULL,
  plan_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  previous_revision bigint,
  lifecycle_state text NOT NULL DEFAULT 'DRAFT' CHECK (
    lifecycle_state IN ('DRAFT','PROPOSED','APPROVED','COMMITTED','SUPERSEDED','CANCELLED')),
  editor_reference text NOT NULL CHECK (length(editor_reference) > 0),
  causation_reference text NOT NULL CHECK (length(causation_reference) > 0),
  reason text NOT NULL CHECK (length(reason) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,plan_id,revision),
  FOREIGN KEY (tenant_id,plan_id) REFERENCES tms.transport_plan(tenant_id,plan_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id,plan_id,previous_revision)
    REFERENCES tms.transport_plan_revision(tenant_id,plan_id,revision)
    ON DELETE RESTRICT,
  CHECK ((revision = 1 AND previous_revision IS NULL) OR
         (revision > 1 AND previous_revision = revision-1))
);
-- The parent plan and the referenced revision are inserted atomically.
-- Deferred FK avoids falsely accepting a plan head without an actual revision.
ALTER TABLE tms.transport_plan ADD CONSTRAINT fk_tms_plan_current_revision
  FOREIGN KEY (tenant_id,plan_id,current_revision)
  REFERENCES tms.transport_plan_revision(tenant_id,plan_id,revision)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS tms.transport_plan_source_requirement (
  tenant_id text NOT NULL,
  plan_id text NOT NULL,
  revision bigint NOT NULL,
  source_type text NOT NULL CHECK (length(source_type) > 0),
  source_reference text NOT NULL CHECK (length(source_reference) > 0),
  PRIMARY KEY(tenant_id,plan_id,revision,source_type,source_reference),
  FOREIGN KEY(tenant_id,plan_id,revision)
    REFERENCES tms.transport_plan_revision(tenant_id,plan_id,revision)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS tms.transport_route (
  tenant_id text NOT NULL,
  plan_id text NOT NULL,
  revision bigint NOT NULL,
  route_id text NOT NULL CHECK (length(route_id) > 0),
  alternative_estimate_value numeric(28,9) CHECK (alternative_estimate_value > 0),
  alternative_estimate_unit text,
  alternative_estimate_source text,
  alternative_estimated_at timestamptz,
  alternative_estimate_confidence text CHECK
    (alternative_estimate_confidence IN ('LOW','MEDIUM','HIGH')),
  alternative_policy_version text,
  PRIMARY KEY(tenant_id,plan_id,revision,route_id),
  FOREIGN KEY(tenant_id,plan_id,revision)
    REFERENCES tms.transport_plan_revision(tenant_id,plan_id,revision)
    ON DELETE RESTRICT,
  CHECK (
    (alternative_estimate_value IS NULL AND alternative_estimate_unit IS NULL AND
     alternative_estimate_source IS NULL AND alternative_estimated_at IS NULL AND
     alternative_estimate_confidence IS NULL AND alternative_policy_version IS NULL)
    OR
    (alternative_estimate_value IS NOT NULL AND
     length(alternative_estimate_unit) > 0 AND length(alternative_estimate_source) > 0 AND
     alternative_estimated_at IS NOT NULL AND alternative_estimate_confidence IS NOT NULL AND
     length(alternative_policy_version) > 0))
);

CREATE TABLE IF NOT EXISTS tms.transport_route_waypoint (
  tenant_id text NOT NULL,
  plan_id text NOT NULL,
  revision bigint NOT NULL,
  route_id text NOT NULL,
  waypoint_id text NOT NULL CHECK (length(waypoint_id) > 0),
  sequence integer NOT NULL CHECK (sequence > 0),
  node_reference text NOT NULL CHECK (length(node_reference) > 0),
  PRIMARY KEY (tenant_id,plan_id,revision,route_id,waypoint_id),
  UNIQUE (tenant_id,plan_id,revision,route_id,sequence),
  FOREIGN KEY(tenant_id,plan_id,revision,route_id)
    REFERENCES tms.transport_route(tenant_id,plan_id,revision,route_id)
    ON DELETE RESTRICT
);
-- Corridor references are neither trade-lane law nor customs authorisation.
CREATE TABLE IF NOT EXISTS tms.transport_route_corridor_reference (
  tenant_id text NOT NULL,plan_id text NOT NULL,revision bigint NOT NULL,
  route_id text NOT NULL,corridor_reference text NOT NULL CHECK (length(corridor_reference) > 0),
  PRIMARY KEY(tenant_id,plan_id,revision,route_id,corridor_reference),
  FOREIGN KEY(tenant_id,plan_id,revision,route_id)
    REFERENCES tms.transport_route(tenant_id,plan_id,revision,route_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS tms.transport_movement (
  tenant_id text NOT NULL CHECK (length(tenant_id) > 0),
  movement_id text NOT NULL CHECK (length(movement_id) > 0),
  operating_organisation_id text NOT NULL CHECK (length(operating_organisation_id) > 0),
  legal_entity_id text NOT NULL CHECK (length(legal_entity_id) > 0),
  market_id text NOT NULL CHECK (length(market_id) > 0),
  mode text NOT NULL CHECK (mode IN ('ROAD','RAIL','SEA','AIR','INLAND_WATERWAY')),
  operator_reference text NOT NULL CHECK (length(operator_reference) > 0),
  repositioning_only boolean NOT NULL DEFAULT false,
  lifecycle_state text NOT NULL DEFAULT 'DRAFT' CHECK
    (lifecycle_state IN ('DRAFT','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED','EXCEPTION')),
  aggregate_version bigint NOT NULL DEFAULT 1 CHECK (aggregate_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,movement_id),
  UNIQUE(tenant_id,movement_id,mode),
  UNIQUE(tenant_id,movement_id,operating_organisation_id,legal_entity_id,market_id)
);

CREATE TABLE IF NOT EXISTS tms.transport_call (
  tenant_id text NOT NULL,movement_id text NOT NULL,
  call_id text NOT NULL CHECK (length(call_id) > 0),
  sequence integer NOT NULL CHECK (sequence > 0),
  facility_reference text NOT NULL CHECK (length(facility_reference) > 0),
  original_zone text,
  planned_arrival_at timestamptz,
  planned_arrival_original text,
  planned_departure_at timestamptz,
  planned_departure_original text,
  PRIMARY KEY(tenant_id,movement_id,call_id),
  UNIQUE(tenant_id,movement_id,sequence),
  FOREIGN KEY(tenant_id,movement_id)
    REFERENCES tms.transport_movement(tenant_id,movement_id) ON DELETE RESTRICT,
  CHECK ((planned_arrival_at IS NULL) = (planned_arrival_original IS NULL)),
  CHECK ((planned_departure_at IS NULL) = (planned_departure_original IS NULL)),
  CHECK ((planned_arrival_at IS NULL AND planned_departure_at IS NULL) OR
    (original_zone IS NOT NULL AND length(original_zone)>0)),
  CHECK (planned_arrival_at IS NULL OR planned_departure_at IS NULL OR
    planned_arrival_at <= planned_departure_at)
);

CREATE TABLE IF NOT EXISTS tms.transport_leg (
  tenant_id text NOT NULL,movement_id text NOT NULL,
  leg_id text NOT NULL CHECK (length(leg_id) > 0),
  sequence integer NOT NULL CHECK (sequence > 0),
  origin_call_id text NOT NULL,destination_call_id text NOT NULL,
  mode text NOT NULL,
  PRIMARY KEY(tenant_id,movement_id,leg_id),
  UNIQUE(tenant_id,movement_id,sequence),
  FOREIGN KEY(tenant_id,movement_id,mode)
    REFERENCES tms.transport_movement(tenant_id,movement_id,mode) ON DELETE RESTRICT,
  FOREIGN KEY(tenant_id,movement_id,origin_call_id)
    REFERENCES tms.transport_call(tenant_id,movement_id,call_id) ON DELETE RESTRICT,
  FOREIGN KEY(tenant_id,movement_id,destination_call_id)
    REFERENCES tms.transport_call(tenant_id,movement_id,call_id) ON DELETE RESTRICT,
  CHECK (origin_call_id <> destination_call_id)
);

CREATE OR REPLACE FUNCTION tms.reject_unrelated_movement_leg()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE origin_number integer; destination_number integer;
BEGIN
 SELECT sequence INTO origin_number FROM tms.transport_call
 WHERE tenant_id=NEW.tenant_id AND movement_id=NEW.movement_id AND call_id=NEW.origin_call_id;
 SELECT sequence INTO destination_number FROM tms.transport_call
 WHERE tenant_id=NEW.tenant_id AND movement_id=NEW.movement_id AND call_id=NEW.destination_call_id;
 IF origin_number IS NULL OR destination_number IS NULL OR
    destination_number <> origin_number+1 THEN
   RAISE EXCEPTION 'INVALID_MOVEMENT_LEG_ORDER';
 END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER guard_tms_leg_sequence
 BEFORE INSERT OR UPDATE ON tms.transport_leg
 FOR EACH ROW EXECUTE FUNCTION tms.reject_unrelated_movement_leg();

CREATE TABLE IF NOT EXISTS tms.movement_consignment_segment (
  tenant_id text NOT NULL,movement_id text NOT NULL,
  consignment_id text NOT NULL,leg_id text NOT NULL,
  operating_organisation_id text NOT NULL,legal_entity_id text NOT NULL,market_id text NOT NULL,
  PRIMARY KEY(tenant_id,movement_id,consignment_id,leg_id),
  FOREIGN KEY(tenant_id,movement_id,operating_organisation_id,legal_entity_id,market_id)
    REFERENCES tms.transport_movement
      (tenant_id,movement_id,operating_organisation_id,legal_entity_id,market_id)
      ON DELETE RESTRICT,
  FOREIGN KEY(tenant_id,consignment_id,operating_organisation_id,legal_entity_id,market_id)
    REFERENCES tms.consignment
      (tenant_id,consignment_id,operating_organisation_id,legal_entity_id,market_id)
      ON DELETE RESTRICT,
  FOREIGN KEY(tenant_id,movement_id,leg_id)
    REFERENCES tms.transport_leg(tenant_id,movement_id,leg_id) ON DELETE RESTRICT
);
CREATE OR REPLACE FUNCTION tms.reject_repositioning_allocation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT repositioning_only FROM tms.transport_movement
     WHERE tenant_id=NEW.tenant_id AND movement_id=NEW.movement_id) THEN
   RAISE EXCEPTION 'REPOSITIONING_CANNOT_CARRY_CONSIGNMENT';
 END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER guard_repositioning_cargo
 BEFORE INSERT OR UPDATE ON tms.movement_consignment_segment
 FOR EACH ROW EXECUTE FUNCTION tms.reject_repositioning_allocation();

-- Version snapshots and route facts are append-only. Promotion of a plan to
-- APPROVED/COMMITTED is separately CP-governed; no runtime role can perform it.
CREATE OR REPLACE FUNCTION tms.reject_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'IMMUTABLE_TMS_TRANSPORT_SNAPSHOT';
END$$;
CREATE TRIGGER guard_tms_plan_revision_immutable
 BEFORE UPDATE OR DELETE ON tms.transport_plan_revision
 FOR EACH ROW EXECUTE FUNCTION tms.reject_snapshot_mutation();
CREATE TRIGGER guard_tms_plan_source_immutable
 BEFORE UPDATE OR DELETE ON tms.transport_plan_source_requirement
 FOR EACH ROW EXECUTE FUNCTION tms.reject_snapshot_mutation();
CREATE TRIGGER guard_tms_route_immutable
 BEFORE UPDATE OR DELETE ON tms.transport_route
 FOR EACH ROW EXECUTE FUNCTION tms.reject_snapshot_mutation();
CREATE TRIGGER guard_tms_waypoint_immutable
 BEFORE UPDATE OR DELETE ON tms.transport_route_waypoint
 FOR EACH ROW EXECUTE FUNCTION tms.reject_snapshot_mutation();
CREATE TRIGGER guard_tms_corridor_immutable
 BEFORE UPDATE OR DELETE ON tms.transport_route_corridor_reference
 FOR EACH ROW EXECUTE FUNCTION tms.reject_snapshot_mutation();

-- All canonical data remains DENY-ALL to a runtime role; CP/IAM transactional
-- authority and scoped RLS policies require separate accepted implementation.
DO $$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY[
   'transport_plan','transport_plan_revision','transport_plan_source_requirement',
   'transport_route','transport_route_waypoint','transport_route_corridor_reference',
   'transport_movement','transport_call','transport_leg','movement_consignment_segment'
 ] LOOP
   EXECUTE format('ALTER TABLE tms.%I ENABLE ROW LEVEL SECURITY',tbl);
   EXECUTE format('ALTER TABLE tms.%I FORCE ROW LEVEL SECURITY',tbl);
 END LOOP;
END$$;
COMMIT;
