# HYB-02 increment — pinned Open TMS native PostgreSQL 17 migration proof

**Governing:** Accepted ADR-TMS-0020/0021. **Status:** integration CI evidence required; full HYB-02 remains HELD.

Previous HYB-02 checks tested synthetic SQL isolation. This increment tests the actual pinned upstream Open TMS multi-file Prisma schema and full native migration chain independently on PostgreSQL 17 tenant A and tenant B servers. The source is DominicFinn/open_tms@623adec1370f1a85a92766cd0a028f7a451dab95; changes to this SHA need a fresh licence/security and migration review.

CI uses Node 24, the upstream npm lockfile, native Prisma generate / Prisma validate, and Prisma migrate deploy within temporary containers on tenant-specific private Docker networks, with no host SQL ports or vendor seed data. It independently reads actual _prisma_migrations histories, native domain tables and org-scope nullability. It verifies A/B marker non-interference and that an A client cannot open the B database. Disposable resources and synthetic credentials are always destroyed.

## Upstream compatibility caveat

The pinned Open TMS phase-3 migration 20260509_phase3_orgid adds orgId on Location, Lane, Driver, Vehicle and Device, but does NOT add NOT NULL constraints to those five native catalogue tables. Our checker requires Shipment, Customer, Carrier and Order to have nonnullable orgId and reports any nullable operational catalogue tables as a hold. This is an upstream schema observation; do not silently rewrite upstream migration history or construe it as successful route-/worker-level isolation.

The pinned Fleetbase api/composer.json declares php >=8.0 <8.3, uses a Laravel 10 base and references fleetbase/fleetops-api. Therefore a modern generic PHP 8.3/8.4/8.5 image is not an accepted drop-in and the vendor PHP lifecycle/security/upgrades need independent disposition. Fleetbase source remains AGPL; nothing here certifies distribution, hosting or a commercial licence.

## Gate register

- [x] HYB-01 pinned source census and negative revision checks (PR #8)
- [x] HYB-02 synthetic A/B MySQL 8/PostgreSQL 17 database isolation (PR #8)
- [ ] This increment: execute and preserve green CI for exact-source native Prisma migrations on both PG17 tenants
- [ ] Native Open TMS Fastify API with two actual orgs, concurrent current-context IAM identities, ID guessing, exports, audit and cross-tenant denial
- [ ] Native pg-boss job queue and consumer isolation, EDI and document/object-store scoping, replay/receipt evidence
- [ ] Fleetbase/Fleet-Ops build on supported pinned PHP/MySQL 8/Redis/SocketCluster stack, including native worker/socket and credential isolation
- [ ] Operator-approved provider licences, SBOM, CVE and image digest/signer evidence; CP-owned binding lifecycle; independently witnessed teardown

Passing these migrations is a significant schema-compatibility proof, but not an admission permit. Canonical TMS capability bindings, carrier confirmations and staging/production activation remain refused.
