#!/usr/bin/env python3
"""HYB-02 pinned native Open TMS schema smoke on two isolated PG17 instances.

This verifies actual vendor Prisma migration output, NOT application or worker
tenant isolation. Exit nonzero for unexpectedly missing or failed migrations.
"""
import json
import subprocess
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: verify-open-tms-pg17.py PRIVATE_ENV_FILE")
base = ["docker", "compose", "--env-file", sys.argv[1], "-f",
        "ops/hybrid/docker-compose.data-plane.yml"]


def query(tenant, sql):
    result = subprocess.run(
        base + ["exec", "-T", "postgres_" + tenant, "psql", "-U", "postgres",
                "-d", "opentms_" + tenant, "-v", "ON_ERROR_STOP=1",
                "-A", "-t", "-c", sql],
        text=True, capture_output=True, timeout=90, check=False,
    )
    if result.returncode:
        # Do not expose native provider SQL errors or private credentials.
        raise RuntimeError("PostgreSQL assertion failed for " + tenant)
    return result.stdout.strip()


histories = []
nullable_catalogue = {}
for tenant in ("a", "b"):
    version = int(query(tenant, "SHOW server_version_num"))
    if not 170000 <= version < 180000:
        raise RuntimeError("Expected PG17 for " + tenant)
    history = query(tenant, """
        SELECT COUNT(*) || ':' || COUNT(finished_at) || ':' ||
               COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL)
          FROM public._prisma_migrations
    """).split(":")
    if len(history) != 3 or int(history[0]) == 0 or history[0] != history[1] or history[2] != "0":
        raise RuntimeError("Incomplete upstream migration history in " + tenant)
    histories.append(int(history[0]))

    tables = set(query(tenant, """
        SELECT table_name FROM information_schema.tables
         WHERE table_schema='public' AND table_type='BASE TABLE'
    """).splitlines())
    required = {"Shipment", "Customer", "Organization", "Carrier",
                "Order", "Location", "Lane", "Driver", "Vehicle"}
    if not required.issubset(tables):
        raise RuntimeError("Missing native Open TMS domain tables in " + tenant)

    fields = query(tenant, """
        SELECT table_name || ':' || is_nullable
          FROM information_schema.columns
         WHERE table_schema='public' AND column_name='orgId' AND
               table_name IN ('Shipment','Customer','Carrier','Order',
                              'Location','Lane','Driver','Vehicle')
         ORDER BY table_name
    """).splitlines()
    scope = dict(f.split(":") for f in fields)
    if len(scope) != 8 or any(scope.get(t) != "NO" for t in
                               ("Shipment", "Customer", "Carrier", "Order")):
        raise RuntimeError("Pinned upstream core scope not enforced for " + tenant)

    # Upstream Phase 3 uses NULLABLE orgId catalogue columns. Record them
    # explicitly as a blocker, not as conclusive tenant isolation.
    nullable_catalogue[tenant] = sorted(
        name for name in ("Location", "Lane", "Driver", "Vehicle")
        if scope.get(name) != "NO"
    )

    query(tenant, "CREATE TABLE public._baobab_smoke (marker text NOT NULL)")
    query(tenant, "INSERT INTO public._baobab_smoke VALUES ('native-" + tenant + "')")

if histories[0] != histories[1]:
    raise RuntimeError("Different A/B native migration counts")
if query("a", "SELECT marker FROM public._baobab_smoke") != "native-a":
    raise RuntimeError("Incorrect data owner A")
if query("b", "SELECT marker FROM public._baobab_smoke") != "native-b":
    raise RuntimeError("Incorrect data owner B")

# Negative native DB network access: A network has no route to B.
cross_tenant_check_cmd = (
    'PGPASSWORD="$POSTGRES_PASSWORD" psql ' +
    '"host=postgres_b connect_timeout=3 user=postgres dbname=opentms_b" ' +
    '-c "SELECT 1"'
)
result = subprocess.run(
    base + ["exec", "-T", "postgres_a", "sh", "-ec",
            cross_tenant_check_cmd],
    capture_output=True, text=True, timeout=15, check=False
)
if result.returncode == 0:
    raise RuntimeError("Cross-tenant native database access unexpectedly succeeded")

print(json.dumps({
    "result": "PINNED_OPEN_TMS_PRISMA_NATIVE_SCHEMAS_ON_PG17",
    "upstream_migrations_per_tenant": histories[0],
    "native_catalogue_nullable_orgId": nullable_catalogue,
    "status": "PARTIAL_NATIVE_SCHEMA_PROOF_NOT_TENANT_CERTIFIED",
    "not_certified": ["native_http", "native_auth", "pg_boss", "edi",
                      "object_store", "fleetbase", "fleetops",
                      "cp_iam", "carrier_commit"]
}, sort_keys=True))
