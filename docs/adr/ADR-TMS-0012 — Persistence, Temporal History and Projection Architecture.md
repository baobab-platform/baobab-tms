# ADR-TMS-0012 — Persistence, Temporal History and Projection Architecture

**Status:** Proposed — pending architectural acceptance; not implementation or production certification  
**Date:** 2026-10-08  
**Repository:** baobab-platform/baobab-tms  
**Depends on:** Accepted ADR-TMS-0001 and ADR-TMS-0002; merged TMS-TECH-01 documentation; Shared and CP/IAM governance  
**Scope:** headless, self-hosted, provider-neutral transport execution for independently entitled Baobab tenants  

> This ADR is a design proposal. Names of illustrative operations, capabilities and events are **not** automatically registered Shared contracts, certified provider support, legal authorisations or deployed runtime claims.


## 1. Decision
Own an isolated **PostgreSQL 17** TMS operational database and write model; never query/write another engine's operational database. Domain aggregates are **independent consistency/transaction boundaries**, not one enormous LogisticsShipment tree. Persist immutable revisions and sourced TransportEvent history, deterministic projections and a durable integration inbox/outbox. The PostgreSQL runtime is aligned with TMS-TECH-01, but framework/library choices still require executable validation.

## 2. Aggregate boundaries
| Aggregate / table group | Transactional invariants | Foreign associations |
|---|---|---|
| LogisticsShipment / cargo allocation | scope, valid cargo quantity and source association, immutable identity | TradeShipment reference, customer/party refs |
| Consignment and consignment-item allocations | allocation bounds, version, independent lifecycle | many-to-many with LogisticsShipment via association table |
| TransportPlan and PlanRevision | only one authorised active/committed version; original preserved | route and consignment IDs |
| TransportMovement / Leg / Call | valid sequence, mode and actual-event provenance | movement may carry multiple consignments |
| Booking / Attempt / CapacityReservation | idempotent external requests, concurrency and unconfirmed status | provider-native refs and carrier identities |
| TransportEvent / raw observation | immutable source, digest, occurred vs recorded time | subject reference, mapping revision |
| Exception / DeliveryAttempt | scoped condition and quantitative delivery invariants | pinned Trade Docs POD reference |
| Inbox / Outbox / ProjectionCheckpoint | replay, lease and at-least-once processing | Shared event ID and tenant scope |

Cross-aggregate relationships use stable owner-domain IDs and application/domain checks rather than pretending one cross-engine foreign key or distributed transaction ensures validity. A single application transaction is appropriate only for a bounded operation, e.g., updating plan revision + same-transaction outbox.

## 3. Temporal semantics
- **occurred_at / effective_at** describe operational/event times; **recorded_at / received_at** describe when TMS learned them. For plan decisions preserve effective/revision time separately from operator recorded time.
- History must answer what was **known at time X** vs what **actually occurred as later established**, without retroactively altering earlier authorisations.
- Supersession chains and source corrections append facts; current-state tables are recomputable projections with reducer version and checkpoint.
- Retention and purge rules must respect legal hold, tenant privacy and evidentiary audit; immutable does not justify retaining unnecessary GPS PII forever.
- Use decimal-safe measures and currencies, explicit unit and timezone handling. Avoid unversioned JSON blobs as sole core domain schema.

## 4. Isolation and concurrency
All tenant-scoped rows include verified tenant/legal-entity context and permitted relationships. Indexes and uniqueness keys include tenant plus relevant owner ID. PostgreSQL RLS may provide defence-in-depth if safe session reset and actor scoping are verified; do not assume application filters alone protect jobs. Use optimistic revision checks and exclusive capacity holds for allocations; choose isolation level deliberately for concurrent double-booking and partial cargo shipment.

Schema migration is forward/backwards compatible across rolling deployments: expand/add -> dual-read/backfill -> verify -> switch -> contract. A schema release cannot assume instant consumer migration. Establish backfill idempotency and audit trail. Explicitly separate canonical owner reference from external-native IDs and infrastructure instance IDs.

## 5. Projections and storage design
Operational read models include shipment status, consignment allocation, movement timeline, provider booking, latest verified location, estimated ETA, exceptions and customer-safe visibility. Each read model records freshness, source, policy/projection version and rebuild state. Allow rebuild from immutable events under deterministic versioned reducers; missing/corrupt source observations must produce repair tasks and not a fabricated historical path.

Object/blob content belongs Trade Docs, not this database. Raw telemetry (if eventually needed) has bounded retention and protection; do not require a new time-series stack without measured Postgres bottleneck and accepted ADR.

## 6. Durability
Every material state transition and its canonical event intention are committed together to DB. Worker leases, retry counters, dedupe keys, DLQ and reconciler survive restart; backups contain consistent outbox, inbox, domain state and projection checkpoint. Restore tests verify replay does not duplicate bookings, delivery or external financial actions.

## 7. Implementation gates
| Gate | Proof |
|---|---|
| TMS-DB-01 | Domain/aggregate schema and tenant-scoped migration; no other-engine foreign DB |
| TMS-DB-02 | Plan revisions, bitemporal-observation fixtures, history query and reconstruction tests |
| TMS-DB-03 | Parallel booking/cargo allocations and optimistic conflict/locking tests |
| TMS-DB-04 | Inbox/outbox crash-retry, lease expiry, checkpoint corruption and idempotent rebuild |
| TMS-DB-05 | Safe migration/backfill with old/new code compatibility and rollback/restore |
| TMS-DB-06 | Privacy retention, backup recovery and tenant-isolation/optional RLS negative tests |

Production readiness and data-residency approval remain separate decisions under ADR-TMS-0015.

## 7. Alternatives rejected and ownership consistency

Reject implicit ownership transfer from Trade, ERP, Trade Docs, Regulations, CP or IAM; vendor-native IDs as canonical IDs; shared cross-engine databases; market- or tenant-specific forks; untrusted callback acceptance; and any optimistic success caused by absent authoritative evidence. Contract changes require Shared acceptance; provider activation and certification require independent CP/EA-09 evidence.

## 8. Traceability and implementation status

Design intent inherits [ADR-TMS-0001](https://github.com/baobab-platform/baobab-tms/tree/main/docs/adr), [ADR-TMS-0002](https://github.com/baobab-platform/baobab-tms/tree/main/docs/adr) and [TMS-TECH-01](https://github.com/baobab-platform/baobab-tms/tree/main/docs/architecture); cross-engine relationships follow [Shared](https://github.com/baobab-platform/shared). Implement each listed gate in a bounded PR and add source, tests, conformance fixtures, operational evidence and documented deferrals. The repository does not gain a working engine simply by merging this ADR.
