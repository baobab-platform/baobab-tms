# TMS-TECH-01 — Headless, Self-Hosted Transportation Runtime and OSS Reuse Strategy

**Status:** Proposed — technology decision for review; NOT implemented, certified, activated or production-ready  
**Date:** 2026-10-08  
**Repository:** baobab-platform/baobab-tms  
**Decision scope:** engine-local technology, build/adopt boundary, operability, open-source selection and implementation gates  
**Depends on:** Accepted ADR-TMS-0001, ADR-TMS-0002; Shared ADR-SHARED-017/018/019/021; Control Plane and IAM authority  
**Consumers:** Thamani, ZuriBeans, any future entitled tenant  
**Implementation baseline:** repository currently contains accepted ADRs and Foundation-0 template material, not an executable TMS

## 1. Decision proposed

Build **one Baobab-owned, API-first, event-capable, headless TMS** that is **self-hosted** inside Baobab infrastructure. The proposed reference runtime is **Node.js 24 + TypeScript + Fastify + PostgreSQL 17**, subject to TMS-TECH-01 gate verification and security/operations review. Use the existing Baobab deployment/container conventions and compatible Node 24 Alpine images where feasible.

The engine owns its canonical logistics domain, persistency, execution state transitions, authoritative logistics event publication, and provider-neutral adapter ports. Open-source projects are **candidate sources for selective, attributable component reuse**, not another whole product to operate or an alternative canonical database. **No PHP/Laravel, Ember, MySQL, fleet-suite runtime, separate frontend, or unrelated technology stack is approved by this proposal.**

Do not call this a commercially complete TMS. Road dispatch is the initial implementation slice; multimodal capability is the **target domain**, and maritime, air, rail, inland waterways, cross-carrier routing and booking require independently proven adapters.

## 2. Inherited, non-negotiable authority

| Business concern | Authority | This engine's rule |
|---|---|---|
| Commerce order, trade shipment and customer commercial commitment | baobab-trade / Medusa | Consume events/commands; do not re-own them |
| Physical transport and delivery execution | baobab-tms | Own LogisticsShipment, Consignment, Plan, Movement and verified operational facts |
| Canonical contract definitions / namespace / producer governance | shared | Propose keys; never self-activate |
| Capability resolution, tenant context, provider bindings and certification state | baobab-cp | Fail closed on unauthorised context; never create local global tenants |
| Authentication and workload identity | baobab-iam | Validate caller and workload identities |
| Documentary evidence, transport documents and customs workflow | baobab-trade-docs | Reference pinned documents, no duplicated document authority |
| Regulatory applicability / legal sufficiency | baobab-regulations | Consume decisions, enforce transport constraints, do not reinterpret law |
| Inventory, invoices, GL and settlement | baobab-erp | Emit physical facts, never post financial records |
| External carrier and customs/issuing authority | Their real-world authority | Preserve original assertions, identifiers, timestamps and source |

In particular, `TradeShipment != LogisticsShipment != Consignment != TransportMovement`; shipment identity does not imply consignment, booking, a customs release or delivered goods. Existing `contracts/shipment/v1` and `com.baobab-platform.trade.shipment.*` remain Trade-owned until a separately governed Shared migration. This document is **not** that migration.

## 3. Candidate assessment (evidence, not a selection claim)

| Candidate | Code/licence observed at assessment | Potential reuse | Fit gap and gate |
|---|---|---|---|
| [Freight & Logistics SCM API](https://github.com/HanyMedhat10/freight-api) | MIT; TypeScript/NestJS/Fastify/PostgreSQL | Freight shipment status transitions, tracking and contract-domain design | Young and small codebase; no demonstrated full multimodal booking, carrier execution or security evidence; do not import a whole auth system |
| [Warp Tools](https://github.com/wearewarp/warp-tools) | MIT; TypeScript/Next.js/SQLite | Load dispatch, carrier management, rate comparison and dock workflow algorithms | SQLite and UI-centric application boundaries conflict with this headless PostgreSQL engine; extract only proven domain logic |
| [OwnFleet](https://github.com/Volodymyr4K/ownfleet) | MIT; NestJS, PostgreSQL/PostGIS, Redis and client apps | Real-time road dispatch, ETA, tracking and POD approaches/tests | Courier / local-delivery focus; auxiliary Redis/client/runtime assumptions require a strict fit-gap review |
| [Fleetbase](https://github.com/fleetbase/fleetbase) | Full-stack logistics suite, Laravel/PHP/Ember/MySQL assumptions | Extensive operational reference experience | **Rejected as baseline**: introduces an additional technology/deployment family |
| Baobab domain implementation | Existing TypeScript/PostgreSQL competence | Precise ADR-TMS-0002 semantic control, event provenance, tenant isolation | Greater initial engineering effort; mitigated by selective MIT-licenced source reuse |

These are **evaluation candidates**. Before importing any source, pin exact upstream commit, verify its licence and transitive licences, establish provenance, scan dependencies, confirm test coverage, check security and maintainability, and document attribution and modification strategy. Repo names, READMEs and claimed features are not production validation. No OSS package is approved for deployment by this ADR.

## 4. Logical architecture

~~~text
Thamani / ZuriBeans / entitled digital estate
  -> Control Plane capability resolution, IAM workload/user context
  -> Baobab TMS headless HTTP command/query boundary (Fastify candidate)
       -> trusted tenant/legal-entity/context enforcement
       -> canonical logistics application/domain modules
          LogisticsShipment / Consignment / Cargo / Plan / Movement / Leg / Event
       -> per-engine PostgreSQL 17 transactions and history
       -> durable inbox + outbox + idempotency + background worker
       -> ports: routing, carrier booking, dispatch, tracking, evidence resolution
             -> adapters: self-hosted algorithms / authorised external carriers
  -> canonical logistics facts -> Shared event contracts -> Trade, ERP, Trade Docs
~~~

A domain service, not a third-party TMS record, is the owner of a Baobab LogisticsShipment ID. External IDs are typed ExternalReferences. Persistent cross-engine links use Shared `CrossEngineObjectReference` where the canonical contract calls for them. Business events describe immutable occurrences rather than disguising commands.

**Ports-first** means an adapter can be absent and the domain still runs in a reduced, honest mode: manual planning or explicitly non-optimised dispatch must not be represented as certified route optimisation; missing mandatory carrier eligibility or customs/release evidence blocks the applicable transition.

## 5. Runtime and data decisions subject to proof

- **Headless:** OpenAPI HTTP commands and queries, authenticated provider callbacks, event consumers and producers. No required TMS web app; Thamani and ZuriBeans own their user experiences.
- **One language family:** Node 24 TypeScript for API, application, adapters and queue worker. Prefer Fastify over introducing a new full-stack framework; whether to use a narrow NestJS library is subject to dependency/security review.
- **Database:** isolated PostgreSQL 17 schema/database owned by TMS; normalized write model, append-only event history, operational projections, optimistic revisions, uniqueness and partitioning by tenant/legal entity as appropriate. No cross-engine joins.
- **Spatial:** begin with latitude/longitude and governed location references; consider PostGIS only after an accepted need and compatible infrastructure support. Routing solver/OSRM/VROOM is NOT a mandatory deployment dependency at Foundation-1.
- **Events:** outbox in the same business transaction, publisher retries, dead-letter/repair, deterministic idempotency and recorded provenance (`occurred_at`, `recorded_at`, external source and trust). Inbox deduplicates external events and rejects unauthorized tenant switches.
- **Identity:** redeem CP context from authenticated caller; scopes and subject relationships enforced at API, workers, SQL, caches, event payloads and external carrier credentials.
- **Operations:** health/readiness signals must be separate from runtime capability certification. Structured logs, traces, metrics, backups/restore and retention policies before staging admission.
- **Build:** pinned dependencies, reproducible container and DevContainer, GitHub Actions, SBOM, secret scanning, licence scan and architecture tests. No vendor credentials in repository.
- **Market/corridors:** Uganda and South Africa are initial consumer contexts, not conditional branches in canonical TMS code. The engine is reusable for independently entitled subsidiaries.
- **Privacy:** classified GPS, driver and route data with role-scoped projections, limited retention, explicit consent/legal basis as relevant, and tenant/market residency review.

## 6. Adapter contracts and failure semantics

| Port | Inputs/outputs (conceptual, not Shared keys) | Failure rule |
|---|---|---|
| `RoutePlanningPort` | constrained transport-plan request -> candidate version and provenance | Return `UNAVAILABLE` / `UNOPTIMISED` honestly; do not invent travel times |
| `CarrierBookingPort` | eligible provider + shipment allocation -> booking attempt/result/external ref | No booking confirmed until trusted provider acknowledgement |
| `TrackingIngestPort` | authenticated observation -> normalized transport event | Deduplicate by source observation, retain occurrence and ingest times |
| `DispatchPort` | approved transport plan/resource/capacity -> assignment/execution | Guard against capacity conflicts and cross-tenant allocations |
| `DeliveryEvidencePort` | delivery event + pinned documentary reference | Delivery fact is not document verification or recipient acceptance |
| `EligibilityDecisionPort` | carrier, route, cargo, customs/regulatory pinned decisions | Block guarded transitions when authoritative evidence is missing |

TMS must distinguish `BUSINESS_BLOCK`, `REGULATORY_BLOCK`, `CUSTOMS_BLOCK`, `CAPACITY_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`, `INTEGRATION_FAILURE` and `UNKNOWN`. No unsafe implicit "success" fallbacks. Time-window and unit arithmetic must be decimal/zone safe where authoritative.

## 7. Distinct implementation gates

Gates are **sequential evidence checkpoints**, not claims that software already exists. A passing PR does not imply a passing production gate.

| Gate | Output and acceptance evidence | Exit condition |
|---|---|---|
| **TMS-TECH-01A — Licence/fit gap** | Exact upstream versions and licence matrix; ADR-TMS-0002 field-by-field mapping, missing maritime/air/road functions, maintenance/security analysis | Named reviewer accepts reuse/rewrite choices; no mandatory new stack |
| **TMS-TECH-01B — Runtime selection** | Node24/TypeScript/Fastify/PostgreSQL17 spike; measured container boot, migration, DevContainer, baseline CI and compatibility checks | Reproducible self-hosted development stack approved |
| **TMS-IMP-01 — Domain kernel** | Shipment/consignment/cargo, scope, canonical IDs, immutable history, deterministic lifecycle tests and concurrency tests | Model satisfies accepted TMS-0002 invariants, including many-to-many allocations |
| **TMS-IMP-02 — Contract boundary** | Shared reconciliation proposal for `trade.shipment` vs `logistics`, capability and event definitions, version compatibility | Shared-approved keys/contracts and producer authority before canonical publication |
| **TMS-IMP-03 — API/security** | Context-bound commands/queries, IAM authentication, tenant/actor policies, field-level and isolation tests | No authority bypass, cross-tenant read/write or anonymous mutation |
| **TMS-IMP-04 — Dispatch/road slice** | Booking/dispatch adapter, accepted statuses, physical tracking events and POD reference; external IDs mapped | TradeShipment -> LogisticsShipment -> Consignment -> assigned transport -> delivery proven by integration test |
| **TMS-IMP-05 — Durable operations** | Transactional outbox/inbox, replay, retry/DLQ, reconciliation, telemetry and backup-restore tests | Failures neither silently lose facts nor duplicate material transitions |
| **TMS-IMP-06 — Multimodal extension** | Independently tested road/sea/air/rail/corridor adapter contracts, as prioritised by demand | Never label unsupported transport modes implemented |
| **TMS-REL-01 — Provider readiness** | Declaration evidence, Shared conformance, security/pentest review, CP registration and EA-09 certification procedure, deployment proof | Production permitted/activated ONLY by respective governance authorities after real proof |

Consumer-specific route changes for Thamani or ZuriBeans must be separate PRs with pinned Shared dependencies. Do not build a required dispatcher UI inside TMS.

## 8. First vertical slice / executable acceptance

1. An authenticated Thamani actor starts a transport requirement in an entitled tenant/market context.
2. A trade-originated source reference yields a new **LogisticsShipment** with stable TMS identity; TradeShipment is not renamed or overwritten.
3. A consignment allocates only valid cargo quantities; a plan and movement use independent IDs and versions.
4. A carrier/resource is assigned with explicit eligibility and an operational acknowledgement (simulator only in the early gate).
5. Trusted events record pickup, movement and delivery facts with source timestamps, provenance and deduplication.
6. A proof-of-delivery DocumentVersion is resolved by reference through Trade Docs when available; TMS does not mint its own documentary truth.
7. Repeat with ZuriBeans without tenant-specific engine branches; unauthorised cross-tenant retrieval and event injection are denied.
8. Failure/retry/replay tests preserve invariant state; outputs match accepted Shared contracts **only after Shared approval**.

## 9. Explicit exclusions and production statement

This document does NOT implement a TMS, certify a provider, activate `logistics.*` capability keys or events, replace current Trade producer authority, select a route solver, approve a carrier, prove GPS fidelity, prove authority/customs integrations or certify multimodal operation. No staging/live evidence exists from this documentation change. Promotion requires separately traceable code, contracts, test results and CP certification/activation.

## 10. Traceability

- [ADR-TMS-0001](../adr/ADR-TMS-0001%20%E2%80%94%20Baobab%20TMS%20Mission%2C%20Authority%2C%20Transport%20Execution%20Boundary%20and%20Platform%20Capability%20Role.md)
- [ADR-TMS-0002](../adr/ADR-TMS-0002%20%E2%80%94%20Canonical%20LogisticsShipment%2C%20Consignment%20and%20Transport%20Execution%20Domain%20Model.md)
- [Shared capability catalogue](https://github.com/baobab-platform/shared/blob/main/contracts/capability/v1/catalogue.yaml)
- [Shared cross-engine reference](https://github.com/baobab-platform/shared/tree/main/contracts/cross-engine-reference/v1)

**Decision review requested:** accept headless + self-hosted + same-stack architectural constraint; approve the candidate study and implementation gates. Do **not** construe technology shortlist or PR merge as production acceptance.
