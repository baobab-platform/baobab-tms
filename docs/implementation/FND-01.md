# FND-01 — TMS canonical kernel, hybrid-provider ports and fail-closed foundation

**Architecture:** ADR-TMS-0001..0021 Accepted, reconciled 2026-10-25. ADR-TMS-0020/0021 govern hybrid provider/runtime conflicts.  
**Stage:** Component scaffold only. There is **no live provider**, IAM/CP integration, registered Shared logistics capability, canonical event producer, externally confirmed booking or protected deployment.  
**Readiness:** NOT READY / BLOCKED for logistics execution, regardless of passing tests.

## Implementation map

| Item | Code/evidence | Result and limit |
| --- | --- | --- |
| Distinct shipment/consignment identities, cargo/source snapshots | \`src/domain/shipment.mjs\` and tests | Pure immutable drafts only; not transactional commands |
| Shipment-to-consignment many-to-many and scope | \`associateConsignment\` and negative tests | Explicit cargo associations; SQL transaction/quantity enforcement still needed |
| Native provider eligibility and pinned no-fallback | \`src/domain/provider-selection.mjs\` and tests | Pure selection over **trusted** projected evidence only |
| Native adaptation | \`src/adapters/native-providers.mjs\` | Explicit UNSUPPORTED; NO Fleetbase/Open TMS integration claims |
| Probes | \`src/http/development-server.mjs\` and tests | Loopback-only development \`/livez\`; \`/readyz\` always 503; no business API or production server |
| SQL design | \`db/migrations/0001_foundation.sql\` | Initial, unexecuted schema; fail-closed RLS, no write policies; requires PG17 integration proof before use |
| Platform capabilities | \`.baobab/capability-provider.yaml\` | CANDIDATE planned intentions, **no providers or activation** |
| Foundation CI | \`.github/workflows/tms-foundation.yml\` | Node 24 stdlib tests; not source of runtime or provider certification |

## Running locally

Node.js 24 is required:

~~~sh
npm run check
npm run dev
curl -i http://127.0.0.1:4080/livez   # 200: process alive, not ready
curl -i http://127.0.0.1:4080/readyz  # 503: deliberately NOT READY
~~~

The \`dev\` probe explicitly refuses NODE_ENV=production and all operational routes; it does not consume a real IAM credential or CP grant. Real command routes MUST NOT be added until their authority/transactional boundaries exist. No external dependencies or package lock are needed by this pure Node stdlib scaffold.

## Non-negotiable next engineering sequence

1. **HYB-01:** Pin exact Fleetbase Fleet-Ops and DominicFinn/open_tms upstream commit SHAs, licence terms (including Fleetbase AGPL vs commercial deployment), SBOM, vulnerabilities, supported APIs and feature-level qualification. Do not vendor code prematurely.
2. **HYB-02:** Native Fleetbase MySQL 8-compatible environment and Open TMS PG17 compatibility proof, with two independent synthetic tenants, separate DB roles, scoped workers/queue/socket/cache/object-store and negative exports/recovery tests. Resource state is not safe simply because it has a tenant column.
3. **HYB-03:** Actual CP plans/operations, desired-state digests, native binding provenance and generation/fencing, secrets by reference, independent observed/readback and safe orphan/deprovision handling. Use development-only synthetic approvals; staging/production retain independent approvals.
4. **HYB-04:** Validate IAM-issued token (issuer/audience/expiry/revocation) and current CP-resolved Principal, legal actor, Market and capability before any domain command. Authorise again at material native effect, not only at ingress. A typed context object in this pure module is NOT authenticated authority.
5. **HYB-05:** Obtain Shared logistics namespace, event/capability definition and producer governance; add durable scoped inbox/outbox, retry/DLQ, optimistic write versions, booking PENDING/UNKNOWN reconciliation. Existing trade.shipment producer remains Trade.
6. **HYB-06:** Implement bounded road/last-mile and freight booking flows; require real provider acceptance, controlled carrier rebook, regulatory/Trade Docs pinned gates, reliable custody and truthful position/ETA/POD.
7. **HYB-07/08:** BFF-consumed tracking with role/field privacy and source freshness; real runtime qualification, legal hold/restore and independent teardown. CP only activates provider when all applicable gates pass.

## Foundational security rules

- No direct digital estate/browser access to native vendor credentials or databases.
- Never use vendor organisation or JWT as a Baobab Tenant or Principal; no parent-to-subsidiary inherited access.
- No native booking is CONFIRMED by HTTP 202, and an uncertain prior commitment must not fail over to another provider.
- No sovereign Customs release is inferred from vehicle position; no delivery/POD from carrier text alone.
- Cross-engine identity and event grammar belong to Shared; CP owns global entitlement/routing; TMS owns operational execution and its internal native routing.
- SQL row-level security is intentionally enabled **without permissive policies** until authenticated database role and CP-backed context transactions are implemented and verified. Migration ownership must be separate from runtime role, with no superuser/BYPASSRLS in runtime.
- Do not promote this scaffold, generated tests, health response or architectural acceptance to certified runtime evidence.

## Acceptance evidence still missing

Real PG17 migrations and concurrency tests; full typed Shared contract pins and conformance; IAM+CP authenticated positive/negative runtime proof; source-code licence review; Fleetbase native DB isolation; Open TMS current-source tenant audit; sealed secrets and signed webhook evidence; native booking UNKNOWN reconciliation; operational SLO, storage/cost, restoring and teardown. These are recorded as outstanding, not inferred from this PR.
