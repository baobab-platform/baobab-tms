# ADR-TMS-0014 — Observability, Resilience, Reconciliation and DR Architecture

**Status:** Proposed — pending architectural acceptance; not implementation or production certification  
**Date:** 2026-10-08  
**Repository:** baobab-platform/baobab-tms  
**Depends on:** Accepted ADR-TMS-0001 and ADR-TMS-0002; merged TMS-TECH-01 documentation; Shared and CP/IAM governance  
**Scope:** headless, self-hosted, provider-neutral transport execution for independently entitled Baobab tenants  

> This ADR is a design proposal. Names of illustrative operations, capabilities and events are **not** automatically registered Shared contracts, certified provider support, legal authorisations or deployed runtime claims.


## 1. Decision
Operate self-hosted TMS as a recoverable, observable transaction-processing engine with **durable history and explicit unknown outcomes**. A green CI pipeline or an HTTP health endpoint does not demonstrate the system can transport cargo safely. Define service-level indicators and incident repair procedures before production activation; use existing Baobab logging/metrics/deployment tooling rather than adopting a new observability platform by default.

## 2. Signals and SLO proposals
| Signal | Measurement and dimensions | Failure implication |
|---|---|---|
| HTTP availability/error/latency | route class, region, environment, auth outcome; tenant redacted | API outage/degradation |
| Domain command outcomes | booking create/confirm, plan commit, dispatch, delivery, denied transitions | stuck or unsafe operations |
| Event delivery lag | outbox/inbox age, retry count, queue debt, missing acknowledgements | delayed consumer state |
| Carrier freshness | last trusted carrier callback/observation per provider/mode | stale tracking vs truly late cargo |
| Projection lag/rebuild | latest event revision vs read watermark | misleading customer state |
| Unknown-outcome backlog | pending carrier confirmation, provider downtime, reconciliation age | duplicate booking risk if retried blindly |
| Security anomalies | cross-tenant denial, forged callback, revoked credential, audit gap | possible compromise |
| Storage/recovery | backup age, WAL gap, migration health, restore RPO/RTO evidence | inability to reconstruct history |

Initial SLO numbers should be set **after measured baseline and business expectations**. Never invent 99.99% availability, 1-second global GPS latency or ocean milestone coverage.

## 3. Resilience patterns
- Scope circuit breakers, bulkheads and rate limits per carrier/provider and external API to prevent one vendor outage from stopping unrelated tenant journeys.
- Distinguish timeouts with unknown external side effects from safe retries. Reconcile with provider before reissuing side-effecting bookings or cancellations.
- Durable workers lease jobs, record attempts, use bounded backoff, quarantine poison messages, and expose manual replay with actor/reason/evidence.
- Outages in optional ETA/routing service can degrade to explicit manual planning; **not** bypass carrier qualification, customs or mandatory safety gates.
- External event/mapping schema changes must fail closed, quarantine and alert rather than silently drop shipment events.
- Correlation IDs span CP, IAM, Trade, TMS, Trade Docs, ERP and carrier adapter while masking sensitive document content and driver PII.

## 4. Reconciliation
Reconcile TMS booking attempts against actual carrier booking status; consignment/cargo allocations against plan/movement coverage; tracking observations against projection checkpoints; delivered attempts against referenced Trade Docs PODs; planned vs recorded milestones and actual provider cost observations. Unmatched facts create operator tasks with source, owner, last attempted_at, conflicting candidates, recommended safe action and closure evidence.

Never "repair" divergent history by editing the original immutable event. A corrected observation/revision and durable reconciliation outcome are required.

## 5. Backup, restore and disaster recovery
Document failure domains for PostgreSQL WAL/physical backup, object/evidence references, outbox/inbox worker, provider token store and telemetry. Recovery sequence: restore DB + keys/connectivity -> validate tenant/context -> resume idempotent inbox/outbox -> rebuild projections -> reconcile externally side-effecting bookings -> reopen services. Drill point-in-time restore and provider callback replay in an isolated environment. RPO/RTO targets require measured business approval, not default assertions.

A degraded carrier/tracking feed must produce a disclosed stale/unknown status to user experiences; do not falsify delivered or available capacity because the service is "up".

## 6. Implementation gates
| Gate | Measured acceptance |
|---|---|
| TMS-OPS-01 | Structured logs, traces, metrics, redaction, dashboards and alarm routing |
| TMS-OPS-02 | Load test for APIs, outbox latency and worker restarts; draft SLO from observed results |
| TMS-OPS-03 | Inject carrier timeout/unknown outcome, schema drift, callback storms, dead-letter and rerun reconciliation |
| TMS-OPS-04 | Restore from PostgreSQL backup with queued event replay and unchanged canonical IDs |
| TMS-OPS-05 | Validate runbooks for unsafe dispatch, Customs hold, missing POD, credential compromise and stale GPS |
| TMS-OPS-06 | Staging disaster drill and approved measurable SLO/RPO/RTO before any production claim |

**Non-claims:** no agreed SLO, live telemetry integration, availability guarantee, recovery drill or real deployment has been established by this ADR.

## 7. Alternatives rejected and ownership consistency

Reject implicit ownership transfer from Trade, ERP, Trade Docs, Regulations, CP or IAM; vendor-native IDs as canonical IDs; shared cross-engine databases; market- or tenant-specific forks; untrusted callback acceptance; and any optimistic success caused by absent authoritative evidence. Contract changes require Shared acceptance; provider activation and certification require independent CP/EA-09 evidence.

## 8. Traceability and implementation status

Design intent inherits [ADR-TMS-0001](https://github.com/baobab-platform/baobab-tms/tree/main/docs/adr), [ADR-TMS-0002](https://github.com/baobab-platform/baobab-tms/tree/main/docs/adr) and [TMS-TECH-01](https://github.com/baobab-platform/baobab-tms/tree/main/docs/architecture); cross-engine relationships follow [Shared](https://github.com/baobab-platform/shared). Implement each listed gate in a bounded PR and add source, tests, conformance fixtures, operational evidence and documented deferrals. The repository does not gain a working engine simply by merging this ADR.
