#!/usr/bin/env python3
"""PG17 proof for canonical TMS base + native worker custody schema.

No native provider database is touched. All SQL uses disposable independent
PostgreSQL 17 from ops/hybrid. Failed RLS insert is a required PASS condition.
"""
import subprocess
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: verify-canonical-ledger.py PRIVATE_DB_ENV")
base = ["docker", "compose", "--env-file", sys.argv[1], "-f",
        "ops/hybrid/docker-compose.data-plane.yml", "exec", "-T", "postgres_a",
        "psql", "-U", "postgres", "-d", "opentms_a", "-v", "ON_ERROR_STOP=1"]


def sql(statement, must_fail=False):
    proc = subprocess.run(base + ["-A", "-t", "-c", statement],
                          capture_output=True, text=True, timeout=30, check=False)
    if (proc.returncode != 0) != must_fail:
        raise AssertionError("Unexpected canonical ledger SQL acceptance result")
    return proc.stdout.strip()


if not (170000 <= int(sql("SHOW server_version_num")) < 180000):
    raise AssertionError("Expected native proof on PG17")
table = sql("SELECT to_regclass('tms.native_worker_execution')")
if table != "native_worker_execution":
    raise AssertionError("Canonical native worker ledger missing")
scope = sql("""SELECT relrowsecurity::int||':'||relforcerowsecurity::int
               FROM pg_class WHERE oid='tms.native_worker_execution'::regclass""")
if scope != "1:1":
    raise AssertionError("RLS + FORCE RLS required on worker custody")
policies = sql("""SELECT COUNT(*) FROM pg_policies
                  WHERE schemaname='tms' AND tablename='native_worker_execution'""")
if policies != "0":
    raise AssertionError("Do not admit a runtime RLS allow policy without CP")
sql("""INSERT INTO tms.native_execution_binding
       (tenant_id,binding_id,operating_organisation_id,legal_entity_id,market_id,
        environment,native_provider_kind)
       VALUES('synthetic-tenant','synthetic-bind','synthetic-org',
              'synthetic-legal','synthetic-market','development','OPEN_TMS')""")
sql("""CREATE ROLE tms_probe NOLOGIN;
       GRANT USAGE ON SCHEMA tms TO tms_probe;
       GRANT SELECT, INSERT ON tms.native_worker_execution TO tms_probe;""")
sql("""SET ROLE tms_probe;
       INSERT INTO tms.native_worker_execution
         (tenant_id,native_binding_id,operating_organisation_id,operation_id,
          native_worker_kind,payload_sha256,cp_fencing_generation,state,idempotency_key,
          cp_decision_reference,cp_verification_expires_at)
       VALUES('synthetic-tenant','synthetic-bind','synthetic-org','synthetic-op',
         'edi-retry',repeat('a',64),1,'CLAIMED','test-idem','synthetic-cp',now()+interval '5 seconds');""",
    must_fail=True)
if sql("SET ROLE tms_probe; SELECT COUNT(*) FROM tms.native_worker_execution") != "0":
    raise AssertionError("Runtime role must not see TMS worker custody")
sql("""INSERT INTO tms.native_worker_execution
       (tenant_id,native_binding_id,operating_organisation_id,operation_id,
        native_worker_kind,payload_sha256,cp_fencing_generation,state,idempotency_key,
        cp_decision_reference,cp_verification_expires_at)
       VALUES('synthetic-tenant','synthetic-bind','synthetic-org','synthetic-op',
         'edi-retry',repeat('a',64),1,'CLAIMED','test-idem','synthetic-cp',now()+interval '5 seconds')""")
if sql("SELECT COUNT(*) FROM tms.native_worker_execution") != "1":
    raise AssertionError("Canonical ledger evidence not persisted")
sql("""INSERT INTO tms.native_worker_execution
       (tenant_id,native_binding_id,operating_organisation_id,operation_id,
        native_worker_kind,payload_sha256,cp_fencing_generation,state,idempotency_key,
        cp_decision_reference,cp_verification_expires_at)
       VALUES('synthetic-tenant','synthetic-bind','synthetic-org','synthetic-op',
         'edi-retry',repeat('b',64),1,'CLAIMED','different','synthetic-cp',now()+interval '5 seconds')""",
    must_fail=True)
print("PASS: canonical TMS baseline and worker ledger on real PG17; "
      "FORCE RLS denies runtime; duplicate op fenced by primary key")
