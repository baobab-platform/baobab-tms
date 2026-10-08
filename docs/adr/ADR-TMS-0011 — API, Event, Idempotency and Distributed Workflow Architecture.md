# ADR-TMS-0011 — API, Event, Idempotency and Distributed Workflow Architecture

**Status:** Proposed — pending architectural acceptance; not implementation or production certification  
**Date:** 2026-10-08  
**Repository:** baobab-platform/baobab-tms  
**Depends on:** Accepted ADR-TMS-0001 and ADR-TMS-0002; merged TMS-TECH-01 documentation; Shared and CP/IAM governance  
**Scope:** headless, self-hosted, provider-neutral transport execution for independently entitled Baobab tenants  

> This ADR is a design proposal. Names of illustrative operations, capabilities and events are **not** automatically registered Shared contracts, certified provider support, legal authorisations or deployed runtime claims.


## 1. Decision
Expose a **headless, context-bound command/query API** and asynchronous domain-event integration. No direct database sharing, distributed ACID or synchronous chain of Trade -> TMS -> ERP -> Trade Docs is permitted as the sole mechanism for completing a transport workflow. Every consequential write uses local PostgreSQL transaction + outbox; external messages arrive via verified inbox and idempotent handlers.

\`\`\`mermaid
sequenceDiagram
  participant C as Authorised caller / Trade
  participant T as TMS API
  participant DB as TMS PostgreSQL
  participant W as Outbox worker
  participant X as Partner / consumer
  C->>T: Command + CP context + idempotency key
  T->>T: IAM, tenant and relationship checks
  T->>DB: Transaction: domain mutation + outbox + request outcome
  DB-->>T: Committed revision
  T-->>C: 202/201 with stable operation reference
  W->>DB: Lease pending outbox row
  W->>X: Signed/versioned message
  X-->>W: Ack or retriable failure
  W->>DB: Delivery outcome, retry or DLQ
\`\`\`

The API response indicates command **acceptance/transaction** status, not external carrier success unless confirmed from the authoritative source.

## 2. Contract surfaces
| Surface | Contract shape | Rule |
|---|---|---|
| Public/estate commands | Versioned HTTP/OpenAPI, bearer/workload identity, trusted context and idempotency key | Never use a client-supplied tenant header as sole authority |
| Queries | Pagination/filtering, scoped timeline/plan/booking read models, freshness watermark | Can be eventually consistent; disclose projection watermark |
| Carrier callbacks | Provider signature/identity, raw native event ID and timestamp, mapping | Unknown/unauthorised payloads quarantined, not acted upon |
| Canonical facts | Shared event envelope and registered logistics event schema | Actual business facts only; no command disguised as event |
| Cross-engine references | Shared pinned/current reference contract as applicable | Object owner/source and tenant must be validated |
| Internal workers | Same domain policy using caller-bound or constrained service context | No omnipotent worker bypass |

## 3. Idempotency and ordering
- Idempotency scope includes **tenant, legal entity, actor/workload audience as appropriate, command type, domain aggregate and client key**. Preserve request digest and committed result; reused key with different request must return conflict, not replay a different mutation.
- Inbox stores producer, message/event ID, schema version, trust/tenant scope, digest, receive timestamp and processing outcome. Duplicate matching event is no-op; same identity/different digest is quarantined.
- Outbox is written atomically with material source transaction and leased by a single worker; retry with bounded exponential backoff/jitter; dead-letter/quarantine with operator replay preserving event identity.
- Delivery is **at least once**, never falsely "exactly once". Consumers must be replay safe. Ordering guaranteed only within explicitly defined subject/partition; do not assume global ordered delivery.
- Optimistic aggregate versions prevent lost writes; committed event histories are immutable, corrections append new facts. An API 504 after DB commit must support idempotent result retrieval.
- Side-effect duplication is especially dangerous for carrier booking; use provider idempotency and uncertain-outcome reconciliation, not blind HTTP retries.

## 4. Long-running workflow
Model workflows as explicit **durable state machines/sagas**, with persisted workflow ID, tenant, correlation, expected steps, independent timeouts, retry and compensation rules. Example: booking requires plan approval, eligibility validation, offer selection, provider confirmation and resource/capacity reservation. Compensation may release capacity, but cannot automatically "undo" physical departure or sovereign Customs action.

Failure taxonomy distinguishes validation denial, not authorised, stale plan, provider unavailable, provider unknown outcome, regulatory/customs block and retriable technical failure. Return stable error codes and correlation IDs. Ensure callbacks cannot reverse terminal transitions without explicit correction.

## 5. Compatibility and operations
Contract majors, backward-compatible additions, deprecation windows and consumer-driven fixtures follow Shared governance. Bounded API payloads, pagination, quotas/rate limits, tracing, audit and privacy-safe logging are required. Node 24/TypeScript/Fastify/PostgreSQL is the proposed same-stack runtime described by TMS-TECH-01; this ADR does not commit a third-party messaging or queue product.

## 6. Implementation gates
| Gate | Objective conformance |
|---|---|
| TMS-API-01 | Versioned OpenAPI and Shared consumer contracts, context/identity matrix and error codes |
| TMS-API-02 | Command idempotency with duplicate/race/mismatched-digest tests |
| TMS-API-03 | Transactional outbox/inbox, worker crash, delivery timeout, retry/DLQ/replay integration tests |
| TMS-API-04 | Carrier unknown-outcome and safe compensating workflow tests |
| TMS-API-05 | Mixed-version consumers, schema-compatibility, authentication and field/tenant isolation tests |
| TMS-API-06 | Measured staging throughput, queue lag, recovery and independent CP certification evidence |

**Non-claims:** passing API contract CI does not activate a canonical provider, prove carrier acknowledgement or certify exactly-once execution.

## 7. Alternatives rejected and ownership consistency

Reject implicit ownership transfer from Trade, ERP, Trade Docs, Regulations, CP or IAM; vendor-native IDs as canonical IDs; shared cross-engine databases; market- or tenant-specific forks; untrusted callback acceptance; and any optimistic success caused by absent authoritative evidence. Contract changes require Shared acceptance; provider activation and certification require independent CP/EA-09 evidence.

## 8. Traceability and implementation status

Design intent inherits [ADR-TMS-0001](https://github.com/baobab-platform/baobab-tms/tree/main/docs/adr), [ADR-TMS-0002](https://github.com/baobab-platform/baobab-tms/tree/main/docs/adr) and [TMS-TECH-01](https://github.com/baobab-platform/baobab-tms/tree/main/docs/architecture); cross-engine relationships follow [Shared](https://github.com/baobab-platform/shared). Implement each listed gate in a bounded PR and add source, tests, conformance fixtures, operational evidence and documented deferrals. The repository does not gain a working engine simply by merging this ADR.
