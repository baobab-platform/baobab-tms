#!/usr/bin/env python3
"""HYB-02: two tenant native DATABASE isolation test (not vendor app certification).

Runs only after Docker Compose created four dedicated DB containers. Checks
least-privileged native users, absence of shared tenant networking, replayable
synthetic backup/restore and cross-tenant connection denial. This is NOT
evidence that Fleetbase Fleet-Ops/Open TMS application workers are isolated.
"""
import json
import subprocess
import sys

COMPOSE = "ops/hybrid/docker-compose.data-plane.yml"
if len(sys.argv) != 2:
    raise SystemExit("Usage: verify-db-isolation.py PRIVATE_ENV_FILE")
BASE = ["docker", "compose", "--env-file", sys.argv[1], "-f", COMPOSE]


def run(argv, *, expect_failure=False):
    completed = subprocess.run(
        argv, capture_output=True, text=True, timeout=120, check=False
    )
    if (completed.returncode != 0) != expect_failure:
        # Don't print potential passwords included in database error messages.
        raise RuntimeError(f"Unexpected exit code for {argv[0]} operation")
    return completed.stdout.strip()


def exec_in(service, shell, *, expect_failure=False):
    return run(
        BASE + ["exec", "-T", service, "sh", "-ec", shell],
        expect_failure=expect_failure,
    )


config = json.loads(run(BASE + ["config", "--format", "json"]))
expected = {
    "mysql_a": "tenant_a", "postgres_a": "tenant_a",
    "mysql_b": "tenant_b", "postgres_b": "tenant_b",
}
for name, network in expected.items():
    svc = config["services"][name]
    if svc.get("ports") or svc.get("privileged") or svc.get("network_mode") == "host":
        raise RuntimeError("Unsafe port/privilege exposure: " + name)
    if svc.get("networks") != [network]:
        raise RuntimeError("Unexpected network placement: " + name)
    if not config["networks"][network].get("internal"):
        raise RuntimeError("Tenant data network is not isolated: " + network)
assert config["services"]["mysql_a"]["image"] == "mysql:8.0.44"
assert config["services"]["mysql_b"]["image"] == "mysql:8.0.44"
assert config["services"]["postgres_a"]["image"] == "postgres:17.11-alpine3.23"
assert config["services"]["postgres_b"]["image"] == "postgres:17.11-alpine3.23"

for suffix, marker in [("a", "alpha-only"), ("b", "beta-only")]:
    mysql, pg = f"mysql_{suffix}", f"postgres_{suffix}"
    mysql_root = 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root'
    mysql_app = 'MYSQL_PWD="$MYSQL_APP_PASSWORD" mysql -h 127.0.0.1 -u tms_probe'
    pg_root = 'psql -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'
    pg_app = 'PGPASSWORD="$TMS_APP_PASSWORD" psql -h 127.0.0.1 -U tms_probe -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'

    if not exec_in(mysql, mysql_root + ' -N -s -e "SELECT VERSION()"').startswith("8.0."):
        raise RuntimeError("MySQL family drift: " + suffix)
    version = int(exec_in(pg, pg_root + ' -A -t -c "SHOW server_version_num"'))
    if version < 170000 or version >= 180000:
        raise RuntimeError("PostgreSQL family drift: " + suffix)

    # Database and user are scoped separately per synthetic tenant.
    sql_mysql = (
        "CREATE TABLE scope_proof (marker VARCHAR(40) NOT NULL);"
        f"INSERT INTO scope_proof VALUES ('{marker}');"
        "CREATE USER 'tms_probe'@'%' IDENTIFIED BY '$MYSQL_APP_PASSWORD';"
        "GRANT SELECT, INSERT, UPDATE, DELETE ON "
        "$MYSQL_DATABASE.* TO 'tms_probe'@'%';"
    )
    exec_in(mysql, mysql_root + ' "$MYSQL_DATABASE" -e "' + sql_mysql + '"')
    if exec_in(mysql, mysql_app + ' "$MYSQL_DATABASE" -N -s -e "SELECT marker FROM scope_proof"') != marker:
        raise RuntimeError("MySQL synthetic owner mismatch: " + suffix)
    exec_in(mysql, mysql_app + ' "$MYSQL_DATABASE" -e "CREATE TABLE forbidden(id INT)"',
            expect_failure=True)

    sql_pg = (
        "CREATE TABLE scope_proof(marker text NOT NULL);"
        f"INSERT INTO scope_proof VALUES ('{marker}');"
        "CREATE ROLE tms_probe LOGIN PASSWORD '$TMS_APP_PASSWORD';"
        'GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO tms_probe;'
        "GRANT USAGE ON SCHEMA public TO tms_probe;"
        "GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE scope_proof TO tms_probe;"
    )
    exec_in(pg, pg_root + ' -c "' + sql_pg + '"')
    if exec_in(pg, pg_app + ' -A -t -c "SELECT marker FROM scope_proof"') != marker:
        raise RuntimeError("PG synthetic owner mismatch: " + suffix)
    exec_in(pg, pg_app + ' -c "DROP TABLE scope_proof"', expect_failure=True)

    # One-table backup and restore proof with explicit cross-tenant readback.
    exec_in(mysql, mysql_root.replace("mysql -u root", "mysqldump -u root --no-tablespaces") +
            ' "$MYSQL_DATABASE" scope_proof > /tmp/tms-proof.sql')
    exec_in(mysql, mysql_root + ' "$MYSQL_DATABASE" -e "DROP TABLE scope_proof"')
    exec_in(mysql, mysql_root + ' "$MYSQL_DATABASE" < /tmp/tms-proof.sql && rm /tmp/tms-proof.sql')
    exec_in(pg, 'pg_dump -U postgres -d "$POSTGRES_DB" -t public.scope_proof > /tmp/tms-proof.sql')
    exec_in(pg, pg_root + ' -c "DROP TABLE scope_proof"')
    exec_in(pg, pg_root + ' -f /tmp/tms-proof.sql && rm /tmp/tms-proof.sql')
    exec_in(pg, pg_root + ' -c "GRANT SELECT ON TABLE scope_proof TO tms_probe"')

    if exec_in(mysql, mysql_app + ' "$MYSQL_DATABASE" -N -s -e "SELECT marker FROM scope_proof"') != marker:
        raise RuntimeError("MySQL restore drift: " + suffix)
    if exec_in(pg, pg_app + ' -A -t -c "SELECT marker FROM scope_proof"') != marker:
        raise RuntimeError("PostgreSQL restore drift: " + suffix)

# Explicit cross-network probes; a source tenant cannot discover or use B DB.
exec_in("mysql_a",
        'MYSQL_PWD="$MYSQL_APP_PASSWORD" mysql --connect-timeout=3 -h mysql_b '
        '-u tms_probe fleetbase_b -e "SELECT 1"', expect_failure=True)
exec_in("postgres_a",
        'PGPASSWORD="$TMS_APP_PASSWORD" psql '
        '"host=postgres_b connect_timeout=3 user=tms_probe dbname=opentms_b" '
        '-c "SELECT 1"', expect_failure=True)

print(json.dumps({
    "result": "SYNTHETIC_NATIVE_DATABASE_ISOLATION_ONLY",
    "tested": ["mysql8", "postgres17", "A_B_separate_networks",
               "least_privilege", "cross_tenant_denial", "backup_restore",
               "negative_schema_mutation"],
    "notQualified": ["Fleetbase", "Fleet-Ops", "Open_TMS_native_migrations",
                     "native_workers", "sockets", "object_storage",
                     "IAM_CP", "carrier_commit"]
}))
