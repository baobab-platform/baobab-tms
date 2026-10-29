-- TMS-BOOK-01/02/03, ADR-TMS-0004/0011/0012.
-- Canonical PostgreSQL 17 booking/capacity custody ONLY, no native provider
-- dispatch, CP-authorised claim, active binding or booking success on HTTP 202.
-- Migration owner has fixture DDL rights; no runtime RLS allow policies.
BEGIN;
CREATE TABLE IF NOT EXISTS tms.carrier_booking_intent (
 tenant_id text NOT NULL, booking_id text NOT NULL,
 operating_organisation_id text NOT NULL, legal_entity_id text NOT NULL,
 market_id text NOT NULL, plan_id text NOT NULL, plan_revision bigint NOT NULL,
 carrier_organisation_reference text NOT NULL CHECK(length(carrier_organisation_reference)>0),
 native_provider_kind text NOT NULL CHECK(native_provider_kind IN ('FLEETBASE_FLEETOPS','OPEN_TMS')),
 native_binding_reference text NOT NULL CHECK(length(native_binding_reference)>0),
 actor_reference text NOT NULL CHECK(length(actor_reference)>0),
 intent_digest text NOT NULL CHECK(intent_digest ~ '^sha256:[0-9a-f]{64}$'),
 idempotency_key text NOT NULL CHECK(length(idempotency_key)>0),
 state text NOT NULL DEFAULT 'REQUESTED' CHECK(state IN
  ('REQUESTED','PENDING_PROVIDER','PROVIDER_UNKNOWN','CONFIRMED','DISPATCHABLE',
   'IN_EXECUTION','FULFILLED','DECLINED','EXPIRED','CANCELLED','FAILED_RECONCILIATION')),
 provider_booking_reference text,
 provider_readback_reference text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,booking_id),
 UNIQUE(tenant_id,legal_entity_id,actor_reference,plan_id,idempotency_key),
 UNIQUE(tenant_id,booking_id,operating_organisation_id,legal_entity_id,market_id),
 FOREIGN KEY(tenant_id,plan_id,operating_organisation_id,legal_entity_id,market_id)
  REFERENCES tms.transport_plan(tenant_id,plan_id,operating_organisation_id,legal_entity_id,market_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,plan_id,plan_revision)
  REFERENCES tms.transport_plan_revision(tenant_id,plan_id,revision) ON DELETE RESTRICT,
 CHECK(provider_booking_reference IS NULL OR length(provider_booking_reference)>0),
 CHECK(provider_readback_reference IS NULL OR length(provider_readback_reference)>0),
 CHECK(state NOT IN('CONFIRMED','DISPATCHABLE','IN_EXECUTION','FULFILLED')
       OR (provider_booking_reference IS NOT NULL AND provider_readback_reference IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_booking_native_ref
 ON tms.carrier_booking_intent(tenant_id,native_binding_reference,provider_booking_reference)
 WHERE provider_booking_reference IS NOT NULL;
CREATE OR REPLACE FUNCTION tms.guard_booking_state()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
 IF (NEW.tenant_id,NEW.booking_id,NEW.plan_id,NEW.plan_revision,NEW.legal_entity_id,
   NEW.market_id,NEW.operating_organisation_id,NEW.carrier_organisation_reference,
   NEW.native_binding_reference,NEW.native_provider_kind,NEW.intent_digest,
   NEW.idempotency_key,NEW.actor_reference)
 IS DISTINCT FROM
 (OLD.tenant_id,OLD.booking_id,OLD.plan_id,OLD.plan_revision,OLD.legal_entity_id,
   OLD.market_id,OLD.operating_organisation_id,OLD.carrier_organisation_reference,
   OLD.native_binding_reference,OLD.native_provider_kind,OLD.intent_digest,
   OLD.idempotency_key,OLD.actor_reference) THEN
  RAISE EXCEPTION 'IMMUTABLE_BOOKING_IDENTITY';
 END IF;
 IF NEW.state = OLD.state THEN
  IF NEW.provider_booking_reference IS DISTINCT FROM OLD.provider_booking_reference OR
     NEW.provider_readback_reference IS DISTINCT FROM OLD.provider_readback_reference THEN
   RAISE EXCEPTION 'BOOKING_READBACK_IMMUTABLE';
  END IF;
  RETURN NEW;
 END IF;
 IF NOT (
  (OLD.state='REQUESTED' AND NEW.state IN ('PENDING_PROVIDER','CANCELLED')) OR
  (OLD.state='PENDING_PROVIDER' AND NEW.state IN
    ('PROVIDER_UNKNOWN','CONFIRMED','DECLINED','EXPIRED')) OR
  (OLD.state='PROVIDER_UNKNOWN' AND NEW.state IN
    ('CONFIRMED','DECLINED','FAILED_RECONCILIATION')) OR
  (OLD.state='CONFIRMED' AND NEW.state IN('DISPATCHABLE','CANCELLED')) OR
  (OLD.state='DISPATCHABLE' AND NEW.state IN('IN_EXECUTION','CANCELLED')) OR
  (OLD.state='IN_EXECUTION' AND NEW.state='FULFILLED')
 ) THEN
  RAISE EXCEPTION 'INVALID_BOOKING_TRANSITION';
 END IF;
 IF NEW.state='CONFIRMED' AND
   (NEW.provider_booking_reference IS NULL OR NEW.provider_readback_reference IS NULL) THEN
  RAISE EXCEPTION 'PROVIDER_CONFIRMATION_REQUIRES_READBACK';
 END IF;
 IF OLD.state='PROVIDER_UNKNOWN' AND NEW.state='DECLINED' AND
   NEW.provider_readback_reference IS NULL THEN
  RAISE EXCEPTION 'UNKNOWN_OUTCOME_REQUIRES_READBACK';
 END IF;
 IF OLD.provider_booking_reference IS NOT NULL AND
    NEW.provider_booking_reference IS DISTINCT FROM OLD.provider_booking_reference THEN
  RAISE EXCEPTION 'NATIVE_BOOKING_REF_IMMUTABLE';
 END IF;
 IF OLD.provider_readback_reference IS NOT NULL AND
    NEW.provider_readback_reference IS DISTINCT FROM OLD.provider_readback_reference THEN
  RAISE EXCEPTION 'PROVIDER_READBACK_IMMUTABLE';
 END IF;
 NEW.updated_at=now();
 RETURN NEW;
END$$;
CREATE TRIGGER guard_tms_booking_state
 BEFORE UPDATE ON tms.carrier_booking_intent
 FOR EACH ROW EXECUTE FUNCTION tms.guard_booking_state();

CREATE TABLE IF NOT EXISTS tms.carrier_booking_attempt (
 tenant_id text NOT NULL, booking_id text NOT NULL, attempt_id text NOT NULL,
 native_binding_reference text NOT NULL,
 request_digest text NOT NULL CHECK(request_digest ~ '^sha256:[0-9a-f]{64}$'),
 provider_idempotency_key text NOT NULL CHECK(length(provider_idempotency_key)>0),
 delivery_outcome text NOT NULL CHECK(delivery_outcome IN
    ('NOT_SENT','ACK_ACCEPTED_NOT_CONFIRMED','TIMEOUT_UNKNOWN','DELIVERY_FAILED','READBACK_CONFIRMED','READBACK_DECLINED')),
 external_message_reference text,
 observed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,booking_id,attempt_id),
 UNIQUE(tenant_id,native_binding_reference,provider_idempotency_key),
 FOREIGN KEY(tenant_id,booking_id)
  REFERENCES tms.carrier_booking_intent(tenant_id,booking_id) ON DELETE RESTRICT
);
CREATE TRIGGER guard_tms_booking_attempt_appendonly
 BEFORE UPDATE OR DELETE ON tms.carrier_booking_attempt
 FOR EACH ROW EXECUTE FUNCTION tms.reject_snapshot_mutation();

CREATE TABLE IF NOT EXISTS tms.carrier_capacity_pool (
 tenant_id text NOT NULL, pool_id text NOT NULL,
 operating_organisation_id text NOT NULL, legal_entity_id text NOT NULL, market_id text NOT NULL,
 carrier_organisation_reference text NOT NULL,
 service_reference text NOT NULL,
 capacity_unit text NOT NULL CHECK(length(capacity_unit)>0),
 capacity_limit numeric(28,9) NOT NULL CHECK(capacity_limit>0),
 held_quantity numeric(28,9) NOT NULL DEFAULT 0
  CHECK(held_quantity>=0 AND held_quantity<=capacity_limit),
 valid_from timestamptz NOT NULL, valid_until timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,pool_id),
 UNIQUE(tenant_id,pool_id,operating_organisation_id,legal_entity_id,market_id),
 CHECK(valid_until>valid_from)
);

CREATE TABLE IF NOT EXISTS tms.carrier_capacity_hold (
 tenant_id text NOT NULL,hold_id text NOT NULL,
 pool_id text NOT NULL,booking_id text NOT NULL,
 operating_organisation_id text NOT NULL,legal_entity_id text NOT NULL,market_id text NOT NULL,
 quantity numeric(28,9) NOT NULL CHECK(quantity>0),
 idempotency_key text NOT NULL CHECK(length(idempotency_key)>0),
 state text NOT NULL CHECK(state IN ('HELD','RELEASED')),
 created_at timestamptz NOT NULL DEFAULT now(),released_at timestamptz,
 PRIMARY KEY(tenant_id,hold_id),
 UNIQUE(tenant_id,pool_id,idempotency_key),
 FOREIGN KEY(tenant_id,pool_id,operating_organisation_id,legal_entity_id,market_id)
  REFERENCES tms.carrier_capacity_pool(tenant_id,pool_id,operating_organisation_id,legal_entity_id,market_id)
  ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,booking_id,operating_organisation_id,legal_entity_id,market_id)
  REFERENCES tms.carrier_booking_intent(tenant_id,booking_id,operating_organisation_id,legal_entity_id,market_id)
  ON DELETE RESTRICT,
 CHECK((state='HELD' AND released_at IS NULL) OR
       (state='RELEASED' AND released_at IS NOT NULL))
);
-- Only a privileged, separately authorised database operation role may use
-- functions later. PostgreSQL default public EXECUTE MUST be removed.
CREATE OR REPLACE FUNCTION tms.hold_canonical_capacity(
 p_tenant text,p_pool text,p_booking text,p_hold text,
 p_quantity numeric,p_key text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE poolrow tms.carrier_capacity_pool%ROWTYPE;
        existing tms.carrier_capacity_hold%ROWTYPE;
        booking tms.carrier_booking_intent%ROWTYPE;
BEGIN
 SELECT * INTO poolrow FROM tms.carrier_capacity_pool
 WHERE tenant_id=p_tenant AND pool_id=p_pool FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CAPACITY_POOL_UNAVAILABLE'; END IF;
 IF p_quantity IS NULL OR p_quantity::text IN ('NaN','Infinity','-Infinity') OR
    p_quantity<=0 OR p_quantity>=10000000000000000000 OR
    p_quantity<>trunc(p_quantity,9) THEN
  RAISE EXCEPTION 'INVALID_EXACT_CAPACITY_QUANTITY';
 END IF;
 SELECT * INTO booking FROM tms.carrier_booking_intent
 WHERE tenant_id=p_tenant AND booking_id=p_booking FOR UPDATE;
 IF NOT FOUND OR booking.carrier_organisation_reference IS DISTINCT FROM
    poolrow.carrier_organisation_reference THEN
  RAISE EXCEPTION 'CAPACITY_CARRIER_MISMATCH';
 END IF;
 SELECT * INTO existing FROM tms.carrier_capacity_hold
 WHERE tenant_id=p_tenant AND pool_id=p_pool AND idempotency_key=p_key;
 IF FOUND THEN
   IF existing.hold_id=p_hold AND existing.booking_id=p_booking AND
      existing.quantity=p_quantity THEN RETURN existing.state; END IF;
   RAISE EXCEPTION 'CAPACITY_IDEMPOTENCY_CONFLICT';
 END IF;
 IF clock_timestamp()<poolrow.valid_from OR clock_timestamp()>=poolrow.valid_until OR
    poolrow.held_quantity+p_quantity>poolrow.capacity_limit THEN
   RAISE EXCEPTION 'CAPACITY_UNAVAILABLE';
 END IF;
 INSERT INTO tms.carrier_capacity_hold
 (tenant_id,hold_id,pool_id,booking_id,operating_organisation_id,legal_entity_id,
  market_id,quantity,idempotency_key,state)
 VALUES(p_tenant,p_hold,p_pool,p_booking,poolrow.operating_organisation_id,
  poolrow.legal_entity_id,poolrow.market_id,p_quantity,p_key,'HELD');
 UPDATE tms.carrier_capacity_pool SET held_quantity=held_quantity+p_quantity
 WHERE tenant_id=p_tenant AND pool_id=p_pool;
 RETURN 'HELD';
END$$;
CREATE OR REPLACE FUNCTION tms.release_canonical_capacity(
 p_tenant text,p_pool text,p_hold text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE poolrow tms.carrier_capacity_pool%ROWTYPE;
        h tms.carrier_capacity_hold%ROWTYPE;
BEGIN
 SELECT * INTO poolrow FROM tms.carrier_capacity_pool
 WHERE tenant_id=p_tenant AND pool_id=p_pool FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CAPACITY_POOL_UNAVAILABLE'; END IF;
 SELECT * INTO h FROM tms.carrier_capacity_hold
 WHERE tenant_id=p_tenant AND pool_id=p_pool AND hold_id=p_hold FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CAPACITY_HOLD_UNKNOWN'; END IF;
 IF h.state='RELEASED' THEN RETURN 'RELEASED'; END IF;
 UPDATE tms.carrier_capacity_hold SET state='RELEASED',released_at=now()
 WHERE tenant_id=p_tenant AND hold_id=p_hold;
 UPDATE tms.carrier_capacity_pool SET held_quantity=held_quantity-h.quantity
 WHERE tenant_id=p_tenant AND pool_id=p_pool;
 RETURN 'RELEASED';
END$$;
REVOKE ALL ON FUNCTION tms.hold_canonical_capacity(text,text,text,text,numeric,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION tms.release_canonical_capacity(text,text,text) FROM PUBLIC;

DO $$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['carrier_booking_intent','carrier_booking_attempt',
 'carrier_capacity_pool','carrier_capacity_hold'] LOOP
  EXECUTE format('ALTER TABLE tms.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE tms.%I FORCE ROW LEVEL SECURITY',tbl);
 END LOOP;
END$$;
COMMIT;
