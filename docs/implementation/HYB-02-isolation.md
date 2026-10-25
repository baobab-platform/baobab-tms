# HYB-02 — Independent tenant native data-plane proof

**Engineering runnable; full HYB-02 remains HELD.** Governed by ADR-TMS-0020/0021. This is not a vendor native application acceptance claim.

## Scope delivered

Four real Docker database servers: separate MySQL 8.0.44 for each synthetic Fleetbase tenant A and B; separate PostgreSQL 17.11 for each synthetic Open TMS tenant A and B. Each has a private database, named volume, least-privileged application user and Docker internal tenant network. No database exposes a host port. CI generates independent temporary credentials and destroys all test resources afterward.

The automated Python harness proves positive own-data reads, negative application DDL, cross-tenant connectivity denial, PostgreSQL/MySQL major compatibility and one-table backup/restore (A remains different from B). These tests exercise real database engines when CI runs, not Fleetbase or Open TMS schemas, migrations, APIs, workers or sockets.

## Local execution

Provide a private ephemeral env file with eight random strong values: HYB_MYSQL_A_ROOT, HYB_MYSQL_B_ROOT, HYB_MYSQL_A_APP, HYB_MYSQL_B_APP, HYB_PG_A_ROOT, HYB_PG_B_ROOT, HYB_PG_A_APP, HYB_PG_B_APP. Do not commit secrets and never target a real tenant.

~~~sh
docker compose --env-file /tmp/hyb02.env -f ops/hybrid/docker-compose.data-plane.yml up -d --wait
python3 scripts/hybrid/verify-db-isolation.py /tmp/hyb02.env
docker compose --env-file /tmp/hyb02.env -f ops/hybrid/docker-compose.data-plane.yml down -v --remove-orphans
~~~

The final step removes local synthetic volumes. CI runs that teardown even on failure.

## Status matrix

| Mandatory evidence | Qualification |
| --- | --- |
| A/B isolated native database families and least-privileged synthetic app roles | CI integration proof pending |
| Data restoration, scope access denial and container network isolation | CI integration proof pending |
| Fleetbase + Fleet-Ops application migration/build and native HTTP contract | BLOCKED — source/build/licence gate HYB-01 |
| Open TMS PostgreSQL 17 Prisma migrations, pg-boss and current-source tenancy proof | BLOCKED — full native source runtime |
| Fleetbase Redis worker, sockets, scheduler and per-tenant credential isolation | NOT DEMONSTRATED |
| Open TMS EDI worker, object store and tenant-scoped export/job boundary | NOT DEMONSTRATED |
| Native two-tenant negative web/API reads/writes, signed callbacks and replay | NOT DEMONSTRATED |
| Full vendor backup/restore, restart, active leg and independent teardown | NOT DEMONSTRATED |
| CP desired-state provisioning and real IAM/current context | HYB-03/04 dependency |

**Never equate a dedicated DB with secure native multi-tenancy.** A provider global admin token, ORM route, background job, shared socket channel or object-store key can still cross tenant boundaries. Those tests must pass on the actual pinned application releases before enabling any TMS capability or staging integration.
