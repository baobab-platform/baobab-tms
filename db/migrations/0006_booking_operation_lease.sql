-- TMS-API-02 / BOOK-03 / HYB-04: non-authorising operation lease custody.
-- A claimed SQL lease is NOT CP authority; no effect executor is wired.
-- Only migration/fixture owners can create records. Every runtime read/write,
-- including leaked tokens or forged CP readbacks, stays DENY-ALL via FORCE RLS.
BEGIN;
CREATE TABLE IF NOT EXISTS tms.booking_operation_lease (
 tenant_id text NOT NULL,booking_id text NOT NULL,
 operation text NOT NULL CHECK(operation IN
  ('BOOKING_SUBMIT','BOOKING_RECONCILE','CAPACITY_HOLD','CAPACITY_RELEASE','BOOKING_CANCEL')),
 native_binding_reference text NOT NULL CHECK(length(native_binding_reference)>0),
 intent_digest text NOT NULL CHECK(intent_digest ~ '^sha256:[0-9a-f]{64}$'),
 plan_revision bigint NOT NULL CHECK(plan_revision>0),
 lease_generation bigint NOT NULL CHECK(lease_generation>0),
 lease_owner_reference text NOT NULL CHECK(length(lease_owner_reference)>0),
 lease_expires_at timestamptz NOT NULL,
 -- Deliberately *cannot* become ACTIVE/VERIFIED through this schema version:
 -- real IAM+CP issuer/mandate/readback is still unimplemented.
 authority_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK(authority_status='UNVERIFIED'),
 claimed_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,booking_id,operation),
 FOREIGN KEY(tenant_id,booking_id)
  REFERENCES tms.carrier_booking_intent(tenant_id,booking_id) ON DELETE RESTRICT
);
CREATE OR REPLACE FUNCTION tms.claim_unverified_booking_lease(
 p_tenant text,p_booking text,p_operation text,p_binding text,
 p_intent_digest text,p_plan_revision bigint,p_generation bigint,
 p_owner text,p_expires_at timestamptz)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE booking tms.carrier_booking_intent%ROWTYPE;
        lease tms.booking_operation_lease%ROWTYPE;
BEGIN
 IF p_operation NOT IN ('BOOKING_SUBMIT','BOOKING_RECONCILE',
   'CAPACITY_HOLD','CAPACITY_RELEASE','BOOKING_CANCEL') OR
   p_generation IS NULL OR p_generation<=0 OR
   p_owner IS NULL OR length(p_owner)=0 OR
   p_expires_at IS NULL OR p_expires_at<=now() OR
   p_expires_at>now()+interval '5 minutes' THEN
   RAISE EXCEPTION 'INVALID_BOUNDED_LEASE';
 END IF;
 -- This is serialization, not authentication: caller with DB privileges
 -- alone is still not permitted to dispatch.
 SELECT * INTO booking FROM tms.carrier_booking_intent
  WHERE tenant_id=p_tenant AND booking_id=p_booking FOR UPDATE;
 IF NOT FOUND OR booking.native_binding_reference IS DISTINCT FROM p_binding OR
    booking.intent_digest IS DISTINCT FROM p_intent_digest OR
    booking.plan_revision IS DISTINCT FROM p_plan_revision THEN
   RAISE EXCEPTION 'BOOKING_SCOPE_OR_INTENT_MISMATCH';
 END IF;
 IF p_operation='BOOKING_SUBMIT' AND booking.state<>'REQUESTED' THEN
   RAISE EXCEPTION 'BOOKING_SUBMISSION_ALREADY_ATTEMPTED';
 END IF;
 SELECT * INTO lease FROM tms.booking_operation_lease
  WHERE tenant_id=p_tenant AND booking_id=p_booking AND operation=p_operation
  FOR UPDATE;
 IF FOUND THEN
   IF lease.lease_expires_at>now() THEN
     RAISE EXCEPTION 'OPERATION_LEASE_BUSY';
   END IF;
   IF p_generation<=lease.lease_generation THEN
     RAISE EXCEPTION 'STALE_OPERATION_GENERATION';
   END IF;
   UPDATE tms.booking_operation_lease
    SET lease_generation=p_generation,lease_owner_reference=p_owner,
        lease_expires_at=p_expires_at,claimed_at=now(),updated_at=now()
    WHERE tenant_id=p_tenant AND booking_id=p_booking AND operation=p_operation;
 ELSE
   INSERT INTO tms.booking_operation_lease
    (tenant_id,booking_id,operation,native_binding_reference,intent_digest,
     plan_revision,lease_generation,lease_owner_reference,lease_expires_at)
   VALUES(p_tenant,p_booking,p_operation,p_binding,p_intent_digest,
     p_plan_revision,p_generation,p_owner,p_expires_at);
 END IF;
 RETURN 'UNVERIFIED_NOT_EXECUTABLE';
END$$;
REVOKE ALL ON FUNCTION tms.claim_unverified_booking_lease(
 text,text,text,text,text,bigint,bigint,text,timestamptz) FROM PUBLIC;
ALTER TABLE tms.booking_operation_lease ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms.booking_operation_lease FORCE ROW LEVEL SECURITY;
COMMIT;
