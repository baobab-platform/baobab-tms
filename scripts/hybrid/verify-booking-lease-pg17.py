#!/usr/bin/env python3
"""Actual PostgreSQL17 lease-generation CAS; CP/IAM operation authority ABSENT."""
import concurrent.futures
import subprocess
import sys
if len(sys.argv)!=2: raise SystemExit("Usage: verify-booking-lease-pg17.py <private.env>")
cmd=["docker","compose","--env-file",sys.argv[1],"-f",
 "ops/hybrid/docker-compose.data-plane.yml","exec","-T","postgres_a",
 "psql","-U","postgres","-d","opentms_a","-A","-t","-v","ON_ERROR_STOP=1"]
def query(sql,fail=False):
 p=subprocess.run(cmd+["-c",sql],capture_output=True,text=True,timeout=40)
 if (p.returncode!=0)!=fail:
  raise AssertionError("Unexpected real PG17 fenced custody result (no secrets logged)")
 return p.stdout.strip()
def last(sql):return query(sql).splitlines()[-1]
assert 170000<=int(last("SHOW server_version_num"))<180000
query("""BEGIN;
 INSERT INTO tms.transport_plan(tenant_id,plan_id,operating_organisation_id,legal_entity_id,market_id)
 VALUES('tn_synthetica','plan-a','org-a','legal-a','market-za');
 INSERT INTO tms.transport_plan_revision
 (tenant_id,plan_id,revision,editor_reference,causation_reference,reason)
 VALUES('tn_synthetica','plan-a',1,'editor-a','demand-a','DRAFT');
 INSERT INTO tms.carrier_booking_intent
 (tenant_id,booking_id,operating_organisation_id,legal_entity_id,market_id,
 plan_id,plan_revision,carrier_organisation_reference,native_provider_kind,
 native_binding_reference,actor_reference,intent_digest,idempotency_key)
 VALUES('tn_synthetica','book-a','org-a','legal-a','market-za',
 'plan-a',1,'carrier-a','OPEN_TMS','binding-a','workload-a',
 'sha256:'||repeat('a',64),'client-key-a');
 COMMIT;""")
h="sha256:"+"a"*64
def claim(tenant="tn_synthetica",binding="binding-a",generation=1,owner="worker-a",expires=60):
 return "SELECT tms.claim_unverified_booking_lease(" + \
 f"'{tenant}','book-a','BOOKING_SUBMIT','{binding}','{h}',1,{generation}," + \
 f"'{owner}',now()+interval '{expires} seconds')"
def take(params):
 p=subprocess.run(cmd+["-c",claim(**params)],capture_output=True,text=True,timeout=45)
 return p.returncode==0
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 outcomes=list(pool.map(take,[{"owner":"worker-a"},{"owner":"worker-b"}]))
assert outcomes.count(True)==1,"Concurrent booking lease claim must have exactly one winner"
assert last("SELECT authority_status FROM tms.booking_operation_lease")=="UNVERIFIED"
assert last("SELECT lease_generation FROM tms.booking_operation_lease")=="1"
query(claim(generation=1,owner="replay"),True)
query(claim(generation=2,owner="early-other"),True)
query(claim(tenant="tn_other",generation=3),True)
query(claim(binding="binding-other",generation=3),True)
query("""UPDATE tms.booking_operation_lease SET lease_expires_at=now()-interval '1 second'
 WHERE booking_id='book-a'""")
query(claim(generation=1,owner="stale"),True)
assert last(claim(generation=2,owner="recovered"))=="UNVERIFIED_NOT_EXECUTABLE"
assert last("SELECT lease_generation FROM tms.booking_operation_lease")=="2"
query("""UPDATE tms.booking_operation_lease SET authority_status='VERIFIED'
 WHERE booking_id='book-a'""",True)
query("""CREATE ROLE tms_lease_runtime_probe NOLOGIN;
 GRANT USAGE ON SCHEMA tms TO tms_lease_runtime_probe;
 GRANT SELECT,INSERT,UPDATE ON tms.booking_operation_lease TO tms_lease_runtime_probe""")
assert last("""SELECT relrowsecurity::int||':'||relforcerowsecurity::int
 FROM pg_class WHERE oid='tms.booking_operation_lease'::regclass""")=="1:1"
assert last("""SELECT count(*) FROM pg_policies
 WHERE schemaname='tms' AND tablename='booking_operation_lease'""")=="0"
assert last("""SET ROLE tms_lease_runtime_probe;
 SELECT count(*) FROM tms.booking_operation_lease""")=="0"
query("SET ROLE tms_lease_runtime_probe; "+claim(generation=3,owner="forged"),True)
assert last("SELECT authority_status FROM tms.booking_operation_lease")=="UNVERIFIED"
print("PASS: real PG17 one-winner fenced claim, stale generation denial, expired-lease reclaim, forged scope rejection, no public function EXECUTE, FORCE RLS and PERMANENT UNVERIFIED operation state")
