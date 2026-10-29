#!/usr/bin/env python3
"""TMS-BOOK-03 real PG17 concurrent capacity, idempotency, readback and RLS.
No carrier network, fake CP context grants or positive runtime authorisation.
"""
import concurrent.futures
import subprocess
import sys
if len(sys.argv)!=2: raise SystemExit("Usage: verify-carrier-capacity-pg17.py <private.env>")
cmd=["docker","compose","--env-file",sys.argv[1],"-f","ops/hybrid/docker-compose.data-plane.yml",
     "exec","-T","postgres_a","psql","-U","postgres","-d","opentms_a","-A","-t","-v","ON_ERROR_STOP=1"]
def check(statement,fail=False):
    p=subprocess.run(cmd+["-c",statement],capture_output=True,text=True,timeout=45)
    if (p.returncode!=0)!=fail:
        raise AssertionError("Unexpected PG17 booking/capacity outcome (values and credentials withheld)")
    return p.stdout.strip()
def last(statement): return check(statement).splitlines()[-1]
assert 170000<=int(last("SHOW server_version_num"))<180000
# Explicit canonical plan and revision; only disposable owner fixture bypasses
# RLS. This is NOT a CP-authorised real booking.
check("""BEGIN;
 INSERT INTO tms.transport_plan
 (tenant_id,plan_id,operating_organisation_id,legal_entity_id,market_id)
 VALUES ('tn_synthetica','plan-a','org-a','legal-a','market-za');
 INSERT INTO tms.transport_plan_revision
 (tenant_id,plan_id,revision,editor_reference,causation_reference,reason)
 VALUES ('tn_synthetica','plan-a',1,'actor-a','demand-a','INITIAL');
 INSERT INTO tms.carrier_booking_intent
 (tenant_id,booking_id,operating_organisation_id,legal_entity_id,market_id,
 plan_id,plan_revision,carrier_organisation_reference,native_provider_kind,
 native_binding_reference,actor_reference,intent_digest,idempotency_key)
 VALUES
 ('tn_synthetica','booking-a','org-a','legal-a','market-za',
  'plan-a',1,'carrier-a','OPEN_TMS','binding-a','workload-a','sha256:'||repeat('a',64),'client-key-a'),
 ('tn_synthetica','booking-b','org-a','legal-a','market-za',
  'plan-a',1,'carrier-a','OPEN_TMS','binding-a','workload-a','sha256:'||repeat('b',64),'client-key-b');
 INSERT INTO tms.carrier_capacity_pool
 (tenant_id,pool_id,operating_organisation_id,legal_entity_id,market_id,
 carrier_organisation_reference,service_reference,capacity_unit,capacity_limit,
 valid_from,valid_until)
 VALUES('tn_synthetica','pool-a','org-a','legal-a','market-za',
 'carrier-a','road-service-a','places',1,'2026-10-01+00','2027-10-01+00');
 COMMIT;""")
assert last("SELECT count(*) FROM tms.carrier_booking_intent")=="2"
check("""INSERT INTO tms.carrier_booking_intent
 (tenant_id,booking_id,operating_organisation_id,legal_entity_id,market_id,
 plan_id,plan_revision,carrier_organisation_reference,native_provider_kind,
 native_binding_reference,actor_reference,intent_digest,idempotency_key)
 VALUES('tn_synthetica','booking-forged','org-a','legal-a','market-za',
 'plan-a',1,'carrier-a','OPEN_TMS','binding-a','workload-a','sha256:'||repeat('f',64),'client-key-a')""",True)
# Carrier 202 or timeout do NOT make booking confirmed.
check("""UPDATE tms.carrier_booking_intent SET state='PENDING_PROVIDER'
 WHERE booking_id='booking-a'""")
check("""INSERT INTO tms.carrier_booking_attempt
 (tenant_id,booking_id,attempt_id,native_binding_reference,request_digest,
  provider_idempotency_key,delivery_outcome)
 VALUES('tn_synthetica','booking-a','attempt-1','binding-a',
 'sha256:'||repeat('a',64),'carrier-idempotency-a','ACK_ACCEPTED_NOT_CONFIRMED')""")
check("""UPDATE tms.carrier_booking_intent SET state='CONFIRMED'
 WHERE booking_id='booking-a'""",True)
check("""UPDATE tms.carrier_booking_intent SET state='PROVIDER_UNKNOWN'
 WHERE booking_id='booking-a'""")
check("""UPDATE tms.carrier_booking_intent SET state='CANCELLED'
 WHERE booking_id='booking-a'""",True)
check("""UPDATE tms.carrier_booking_intent
 SET state='CONFIRMED',provider_booking_reference='carrier-order-a',
     provider_readback_reference='provider-readback-a'
 WHERE booking_id='booking-a'""")
check("""UPDATE tms.carrier_booking_intent SET state='PROVIDER_UNKNOWN'
 WHERE booking_id='booking-a'""",True)
check("""UPDATE tms.carrier_booking_attempt SET delivery_outcome='READBACK_CONFIRMED'
 WHERE booking_id='booking-a'""",True)
check("""INSERT INTO tms.carrier_booking_attempt
 (tenant_id,booking_id,attempt_id,native_binding_reference,request_digest,
 provider_idempotency_key,delivery_outcome)
 VALUES('tn_synthetica','booking-a','attempt-2','binding-a',
 'sha256:'||repeat('b',64),'carrier-idempotency-a','TIMEOUT_UNKNOWN')""",True)
assert last("SELECT state FROM tms.carrier_booking_intent WHERE booking_id='booking-a'")=="CONFIRMED"
# Scoped wrong legal actor/market/binding/plan join is refused by actual FK.
check("""INSERT INTO tms.carrier_capacity_pool
 (tenant_id,pool_id,operating_organisation_id,legal_entity_id,market_id,
 carrier_organisation_reference,service_reference,capacity_unit,capacity_limit,
 valid_from,valid_until)
 VALUES('tn_synthetica','pool-other','org-other','legal-other','market-ug',
 'carrier-b','service-b','places',2,'2026-10-01+00','2027-10-01+00')""")
check("""SELECT tms.hold_canonical_capacity('tn_synthetica','pool-other',
 'booking-a','hold-foreign',1,'other-key')""",True)
# Two true independent sessions racing the SAME row; precisely one can hold 1
# unit, the losing transaction cannot oversubscribe.
def take(args):
    book,hold,key=args
    p=subprocess.run(cmd+["-c",f"SELECT tms.hold_canonical_capacity('tn_synthetica','pool-a','{book}','{hold}',1,'{key}')"],
      capture_output=True,text=True,timeout=45)
    return p.returncode==0
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(take,[("booking-a","hold-a","hold-key-a"),("booking-b","hold-b","hold-key-b")]))
assert results.count(True)==1,"Concurrent capacity hold must admit only one writer"
assert last("SELECT held_quantity FROM tms.carrier_capacity_pool WHERE pool_id='pool-a'")=="1.000000000"
holder="hold-a" if results[0] else "hold-b"
booking="booking-a" if results[0] else "booking-b"
key="hold-key-a" if results[0] else "hold-key-b"
assert last(f"SELECT tms.hold_canonical_capacity('tn_synthetica','pool-a','{booking}','{holder}',1,'{key}')")=="HELD"
check(f"SELECT tms.hold_canonical_capacity('tn_synthetica','pool-a','{booking}','{holder}',0.5,'{key}')",True)
assert last("SELECT held_quantity FROM tms.carrier_capacity_pool WHERE pool_id='pool-a'")=="1.000000000"
assert last(f"SELECT tms.release_canonical_capacity('tn_synthetica','pool-a','{holder}')")=="RELEASED"
assert last(f"SELECT tms.release_canonical_capacity('tn_synthetica','pool-a','{holder}')")=="RELEASED"
assert last("SELECT held_quantity FROM tms.carrier_capacity_pool WHERE pool_id='pool-a'")=="0.000000000"

# Same tenant/legal/market with a different carrier must still deny.
check("""INSERT INTO tms.carrier_capacity_pool
 (tenant_id,pool_id,operating_organisation_id,legal_entity_id,market_id,
 carrier_organisation_reference,service_reference,capacity_unit,capacity_limit,valid_from,valid_until)
 VALUES('tn_synthetica','pool-wrong-carrier','org-a','legal-a','market-za',
 'carrier-b','road-b','places',1,now()-interval '1 day',now()+interval '1 day')""")
check("SELECT tms.hold_canonical_capacity('tn_synthetica','pool-wrong-carrier','booking-a','bad-carrier',1,'bad-carrier')",True)
for value in ("0.1234567894", "'NaN'::numeric", "'Infinity'::numeric", "10000000000000000000"):
    check(f"SELECT tms.hold_canonical_capacity('tn_synthetica','pool-a','booking-a','bad-precision',{value},'bad-precision')",True)
assert last("SELECT held_quantity FROM tms.carrier_capacity_pool WHERE pool_id='pool-a'")=="0.000000000"
for _ in range(2):
    assert last("SELECT tms.hold_canonical_capacity('tn_synthetica','pool-a','booking-a','fraction',0.123456789,'fraction')")=="HELD"
assert last("SELECT held_quantity FROM tms.carrier_capacity_pool WHERE pool_id='pool-a'")=="0.123456789"
assert last("SELECT tms.release_canonical_capacity('tn_synthetica','pool-a','fraction')")=="RELEASED"
# Runtime has ordinary table permissions, yet always receives zero rows and
# cannot call a privileged hold or tamper with booking state.
check("""CREATE ROLE tms_booking_runtime_probe NOLOGIN;
 GRANT USAGE ON SCHEMA tms TO tms_booking_runtime_probe;
 GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA tms TO tms_booking_runtime_probe""")
for table in ["carrier_booking_intent","carrier_booking_attempt","carrier_capacity_pool","carrier_capacity_hold"]:
    assert last(f"SELECT relrowsecurity::int||':'||relforcerowsecurity::int FROM pg_class WHERE oid='tms.{table}'::regclass")=="1:1"
    assert last(f"SELECT count(*) FROM pg_policies WHERE schemaname='tms' AND tablename='{table}'")=="0"
    assert last(f"SET ROLE tms_booking_runtime_probe; SELECT count(*) FROM tms.{table}")=="0"
check("""SET ROLE tms_booking_runtime_probe;
 SELECT tms.hold_canonical_capacity('tn_synthetica','pool-a','booking-a','forged',1,'forged')""",True)
check("""SET ROLE tms_booking_runtime_probe;
 UPDATE tms.carrier_booking_intent SET state='CONFIRMED' WHERE booking_id='booking-b'""")
assert last("SELECT state FROM tms.carrier_booking_intent WHERE booking_id='booking-b'")=="REQUESTED"
print("PASS: actual PostgreSQL17 concurrent capacity fencing, unknown-outcome readback, idempotency, legal-scope FK, immutable attempt and FORCE RLS runtime denial (no CP authority or real carrier)")
