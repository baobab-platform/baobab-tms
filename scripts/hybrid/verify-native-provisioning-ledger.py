#!/usr/bin/env python3
"""HYB-03 actual PG17 native provision ledger and deny-all RLS proof.
Never connect to a real CP or provider; only isolated synthetic CI database.
"""
import subprocess
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: verify-native-provisioning-ledger.py <private.env>")
envfile=sys.argv[1]
cmd=["docker","compose","--env-file",envfile,"-f",
     "ops/hybrid/docker-compose.data-plane.yml","exec","-T","postgres_a",
     "psql","-U","postgres","-d","opentms_a","-v","ON_ERROR_STOP=1","-A","-t"]
def sql(statement,expect_failure=False):
    p=subprocess.run(cmd+["-c",statement],text=True,capture_output=True,timeout=40)
    if (p.returncode != 0)!=expect_failure:
        raise AssertionError("Unexpected SQL success/failure (details withheld)")
    return p.stdout.strip().splitlines()[-1] if p.stdout.strip() else ""

if not 170000<=int(sql("SHOW server_version_num"))<180000:
    raise AssertionError("Expected actual PostgreSQL 17")
if sql("SELECT to_regclass('tms.native_provisioning_operation')") not in (
    "native_provisioning_operation","tms.native_provisioning_operation"):
    raise AssertionError("Provisioning table absent")
if sql("""SELECT relrowsecurity::int || ':' || relforcerowsecurity::int
 FROM pg_class WHERE oid='tms.native_provisioning_operation'::regclass""")!="1:1":
    raise AssertionError("FORCE RLS and RLS required")
if sql("""SELECT COUNT(*) FROM pg_policies WHERE schemaname='tms'
 AND tablename='native_provisioning_operation'""")!="0":
    raise AssertionError("A permissive policy is not authorised")

tuple_fields="""(tenant_id,cp_operation_id,native_provider_kind,environment,
 operating_organisation_id,legal_entity_id,market_participation_reference,
 cp_binding_revision,plan_digest,desired_state_digest,provisioning_generation,
 lease_generation,idempotency_key,state)"""
def values(operation="synthetic-op",key="key-1",state="PLANNED"):
    return f"""('tenant-A','{operation}','FLEETBASE_FLEETOPS','development',
 'org-A','legal-A','ZA-market','cp-rev-3','sha256:{'a'*64}',
 'sha256:{'b'*64}',3,2,'{key}','{state}')"""
sql(f"INSERT INTO tms.native_provisioning_operation {tuple_fields} VALUES {values()}")
if sql("SELECT COUNT(*) FROM tms.native_provisioning_operation")!="1":
    raise AssertionError("No durable synthetic row")
sql(f"INSERT INTO tms.native_provisioning_operation {tuple_fields} VALUES {values()}",True)
sql(f"INSERT INTO tms.native_provisioning_operation {tuple_fields} VALUES {values('op2','key-1')}",True)
sql(f"INSERT INTO tms.native_provisioning_operation {tuple_fields} VALUES {values('op3','key-3','READY')}",True)
sql("""CREATE ROLE hyb03_runtime_probe NOLOGIN;
 GRANT USAGE ON SCHEMA tms TO hyb03_runtime_probe;
 GRANT SELECT,INSERT,UPDATE ON tms.native_provisioning_operation TO hyb03_runtime_probe""")
if sql("SET ROLE hyb03_runtime_probe; SELECT COUNT(*) FROM tms.native_provisioning_operation")!="0":
    raise AssertionError("Untrusted runtime could read provisioning history")
sql(f"SET ROLE hyb03_runtime_probe; INSERT INTO tms.native_provisioning_operation {tuple_fields} VALUES {values('op4','key-4')}",True)
print("PASS: real PG17 HYB-03 operation custody, uniqueness, READY-evidence requirement, "
      "FORCE RLS no-allow read/write denial")
