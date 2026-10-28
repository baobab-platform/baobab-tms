#!/usr/bin/env python3
"""TMS-PLAN-02 real PostgreSQL17 canonical plan and movement custody test.

This runs only against disposable synthetic PG17, never native Fleetbase or
Open TMS. The table owner creates fixtures; a separate runtime role receives
table privileges but is DENIED by RLS/FORCE RLS. No CP/IAM grant is simulated.
"""
import concurrent.futures
import subprocess
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: verify-transport-plan-pg17.py <disposable.env>")
base = ["docker", "compose", "--env-file", sys.argv[1], "-f",
        "ops/hybrid/docker-compose.data-plane.yml", "exec", "-T", "postgres_a",
        "psql", "-U", "postgres", "-d", "opentms_a", "-v", "ON_ERROR_STOP=1", "-A", "-t"]


def run(statement, must_fail=False):
    result = subprocess.run(base + ["-c", statement], capture_output=True,
                            text=True, timeout=45, check=False)
    if (result.returncode != 0) != must_fail:
        raise AssertionError("Unexpected PG17 operation result (details withheld)")
    return result.stdout.strip()


def last(statement):
    answer = run(statement).splitlines()
    return answer[-1] if answer else ""


assert 170000 <= int(last("SHOW server_version_num")) < 180000
seed = """
BEGIN;
INSERT INTO tms.transport_plan
 (tenant_id,plan_id,operating_organisation_id,legal_entity_id,market_id)
VALUES ('tn_alpha','plan-a','org-a','legal-a','market-za');
INSERT INTO tms.transport_plan_revision
 (tenant_id,plan_id,revision,editor_reference,causation_reference,reason)
VALUES ('tn_alpha','plan-a',1,'actor-a','demand-a','INITIAL');
INSERT INTO tms.transport_plan_source_requirement
 (tenant_id,plan_id,revision,source_type,source_reference)
VALUES ('tn_alpha','plan-a',1,'LogisticsShipment','shipment-a');
INSERT INTO tms.transport_route (tenant_id,plan_id,revision,route_id)
VALUES ('tn_alpha','plan-a',1,'route-a');
INSERT INTO tms.transport_route_waypoint
 (tenant_id,plan_id,revision,route_id,waypoint_id,sequence,node_reference)
VALUES ('tn_alpha','plan-a',1,'route-a','w1',1,'port-cape'),
       ('tn_alpha','plan-a',1,'route-a','w2',2,'port-durban');
INSERT INTO tms.transport_route_corridor_reference
 (tenant_id,plan_id,revision,route_id,corridor_reference)
VALUES ('tn_alpha','plan-a',1,'route-a','corridor-coastal');
INSERT INTO tms.transport_movement
 (tenant_id,movement_id,operating_organisation_id,legal_entity_id,market_id,
  mode,operator_reference)
VALUES ('tn_alpha','movement-a','org-a','legal-a','market-za','ROAD','operator-a'),
       ('tn_alpha','movement-reposition','org-a','legal-a','market-za','ROAD','operator-a')
       ON CONFLICT DO NOTHING;
INSERT INTO tms.transport_call
 (tenant_id,movement_id,call_id,sequence,facility_reference,
  planned_departure_at,planned_departure_original,original_zone)
VALUES ('tn_alpha','movement-a','call-1',1,'port-cape',
        '2026-11-02 11:00+02','2026-11-02T11:00:00+02:00','Africa/Johannesburg');
INSERT INTO tms.transport_call
 (tenant_id,movement_id,call_id,sequence,facility_reference,
  planned_arrival_at,planned_arrival_original,original_zone)
VALUES ('tn_alpha','movement-a','call-2',2,'port-durban',
        '2026-11-03 13:00+02','2026-11-03T13:00:00+02:00','Africa/Johannesburg');
INSERT INTO tms.transport_leg
 (tenant_id,movement_id,leg_id,sequence,origin_call_id,destination_call_id,mode)
VALUES ('tn_alpha','movement-a','leg-1',1,'call-1','call-2','ROAD');
INSERT INTO tms.consignment
 (tenant_id,consignment_id,operating_organisation_id,legal_entity_id,market_id,
  consignor_reference,consignee_reference)
VALUES ('tn_alpha','consignment-a','org-a','legal-a','market-za','supplier-a','buyer-a');
INSERT INTO tms.movement_consignment_segment
 (tenant_id,movement_id,consignment_id,leg_id,operating_organisation_id,
  legal_entity_id,market_id)
VALUES ('tn_alpha','movement-a','consignment-a','leg-1','org-a','legal-a','market-za');
COMMIT;
"""
run(seed)
assert last("SELECT current_revision FROM tms.transport_plan WHERE plan_id='plan-a'") == "1"
assert last("SELECT count(*) FROM tms.transport_route_waypoint WHERE route_id='route-a'") == "2"
assert last("SELECT count(*) FROM tms.movement_consignment_segment") == "1"
assert last("SELECT planned_departure_at AT TIME ZONE 'UTC' FROM tms.transport_call "
            "WHERE movement_id='movement-a' AND call_id='call-1'").startswith("2026-11-02 09:00:00")

# An untrusted role is granted ordinary SQL privileges, yet still sees no
# rows and cannot insert; no permissive row policies are installed.
tables = [
    "transport_plan", "transport_plan_revision", "transport_plan_source_requirement",
    "transport_route", "transport_route_waypoint", "transport_route_corridor_reference",
    "transport_movement", "transport_call", "transport_leg", "movement_consignment_segment"
]
for table in tables:
    assert last(f"""SELECT relrowsecurity::int||':'||relforcerowsecurity::int
       FROM pg_class WHERE oid='tms.{table}'::regclass""") == "1:1"
    assert last(f"""SELECT count(*) FROM pg_policies WHERE schemaname='tms'
       AND tablename='{table}'""") == "0"
run("CREATE ROLE tms_plan_runtime_probe NOLOGIN; "
    "GRANT USAGE ON SCHEMA tms TO tms_plan_runtime_probe; "
    "GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA tms TO tms_plan_runtime_probe")
assert last("SET ROLE tms_plan_runtime_probe; "
            "SELECT count(*) FROM tms.transport_plan").endswith("0")
run("""SET ROLE tms_plan_runtime_probe;
 INSERT INTO tms.transport_movement
 (tenant_id,movement_id,operating_organisation_id,legal_entity_id,market_id,
  mode,operator_reference)
 VALUES ('tn_alpha','forbidden','org-a','legal-a','market-za','ROAD','operator-a')""", True)

# Snapshot history is immutable, even to a privileged schema-writing fixture.
run("UPDATE tms.transport_plan_revision SET reason='rewritten' "
    "WHERE tenant_id='tn_alpha' AND plan_id='plan-a' AND revision=1", True)
run("DELETE FROM tms.transport_route_waypoint WHERE waypoint_id='w1'", True)
run("""INSERT INTO tms.transport_route
 (tenant_id,plan_id,revision,route_id)
 VALUES ('tn_alpha','plan-a',2,'route-without-version')""", True)
run("""INSERT INTO tms.transport_leg
 (tenant_id,movement_id,leg_id,sequence,origin_call_id,destination_call_id,mode)
 VALUES ('tn_alpha','movement-a','wrong-direction',2,'call-2','call-1','ROAD')""", True)
run("""INSERT INTO tms.transport_leg
 (tenant_id,movement_id,leg_id,sequence,origin_call_id,destination_call_id,mode)
 VALUES ('tn_alpha','movement-a','wrong-mode',2,'call-1','call-2','SEA')""", True)

# Even on the same canonical PG database, a synthetic other Tenant/legal
# actor cannot be joined to the first Tenant's movement and its leg.
run("""INSERT INTO tms.consignment
 (tenant_id,consignment_id,operating_organisation_id,legal_entity_id,market_id,
  consignor_reference,consignee_reference)
 VALUES ('tn_beta','consignment-b','org-b','legal-b','market-ug','supplier-b','buyer-b')""")
run("""INSERT INTO tms.movement_consignment_segment
 (tenant_id,movement_id,consignment_id,leg_id,operating_organisation_id,legal_entity_id,market_id)
 VALUES ('tn_alpha','movement-a','consignment-b','leg-1','org-a','legal-a','market-za')""", True)

# Create the next revision before fencing the head pointer. A stale version
# must never win two independent PG17 sessions that race the SAME CAS.
run("""INSERT INTO tms.transport_plan_revision
 (tenant_id,plan_id,revision,previous_revision,editor_reference,causation_reference,reason)
 VALUES ('tn_alpha','plan-a',2,1,'actor-b','disruption','new-alternative')""")
cas = """UPDATE tms.transport_plan SET current_revision=2,updated_at=now()
 WHERE tenant_id='tn_alpha' AND plan_id='plan-a' AND current_revision=1
 RETURNING current_revision"""
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    outcomes = list(pool.map(lambda _: run(cas), (1, 2)))
assert sum(1 for value in outcomes if "UPDATE 1" in value) == 1, \
    "Two writers must not both acquire the same plan revision"
assert last("SELECT current_revision FROM tms.transport_plan "
            "WHERE tenant_id='tn_alpha' AND plan_id='plan-a'") == "2"
run("""UPDATE tms.transport_plan SET current_revision=99
 WHERE tenant_id='tn_alpha' AND plan_id='plan-a'""", True)

print("PASS: TMS-PLAN-02 real PG17 domain migrations, immutable snapshots, "
      "same-movement leg integrity, scoped consignment FK, forced no-allow RLS, "
      "one-winner concurrent revision CAS and deferred current-head integrity")
