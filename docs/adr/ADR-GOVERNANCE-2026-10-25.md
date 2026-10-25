# TMS ADR Governance Reconciliation — 2026-10-25

**Authority:** Platform Owner's explicit instruction to consider all TMS ADRs accepted or superseded.  
**Decision:** Accepted. **Execution maturity:** Foundation-0; no live qualified transport provider.

## Reconciliation and precedence

All 21 ADR-TMS-0001..0021 are **Accepted**. ADR-TMS-0001/0002 remain fundamental; ADR-TMS-0020/0021 govern hybrid native provider/runtime, isolation and lifecycle where they amend earlier decisions. Earlier ADRs are accepted as amended, not rejected wholesale.

| Decisions | Status | Binding resolution |
| --- | --- | --- |
| 0001–0002 | Accepted | Mission, authority, distinct LogisticsShipment/Consignment, many-to-many execution identity |
| 0003–0008 | Accepted as amended | Plans/legs/calls; booking/capacity; fleet resources; buy costs; sourced tracking; delivery and pinned POD refs. Native provider allocation and ack/commit rules obey 0020/0021 |
| 0009 | Accepted as amended | Provider adapters and transport standards; hybrid Fleetbase Fleet-Ops/Open TMS adoption overrides incompatible single-provider assumptions |
| 0010 | Accepted as amended | CP-derived context and tenant isolation; binding and native DB/worker/socket/cache/backup rules of 0021 are mandatory |
| 0011 | Accepted as amended | Headless API, events, idempotency and distributed workflow; Shared event grammar and ownership remain authoritative |
| 0012 | Accepted as amended | Temporal/persistence domain; canonical TMS PostgreSQL 17, Fleetbase MySQL 8-compatible exception, Open TMS PostgreSQL 17 only after qualification |
| 0013 | Accepted as amended | IAM/CP authority, scoped credentials; native provider tokens cannot become canonical Principal |
| 0014–0015 | Accepted as amended | Observability/DR, capability certification/migration with additional HYB-00..08 proof |
| 0016–0019 | Accepted as amended | Sourced ETA and SLA, custody, customs/regulatory gates, decision support; no fabricated factual or sovereign authority |
| 0020–0021 | Accepted | Hybrid runtime, provider selection, CP/IAM governance, isolation, safe lifecycle and gates |
| TMS-TECH-01 (non-ADR) | Superseded in part | Node 24/TypeScript/Fastify remains optional kernel recommendation; full Fleetbase/Open TMS native runtimes are permitted and their database/runtime exceptions control |

**Precedence:** Accepted Shared authority and contracts > TMS-0020/0021 in provider/runtime/isolation conflicts > compatible TMS-0001..0019 domain decisions > non-conflicting TMS-TECH-01 guidance. Cross-engine owners retain exclusive authorities. Historical "Proposed" statements inside body text are preserved for traceability but not current status.

## Explicitly NOT authorised by this ruling

There is no approval to register `logistics.*` capabilities/events as canonical Shared types, replace Trade `trade.shipment` producer identity, activate CP binding or certify a native runtime, assert Fleetbase AGPL/commercial licence compliance, declare Open TMS safe for shared tenants, execute real carrier bookings, claim customs release, or begin protected staging/production.

## Implementation and evidence gates

- **FND-01:** reusable kernel foundation, fail-closed operational ports, tests and developer documentation.
- **HYB-01/02:** immutable upstream SHAs, licences, full native build, MySQL/PG17 qualification and A/B isolation across databases, workers, sockets, queues, backups and restore.
- **HYB-03/04:** CP desired state, reconciler and independently observed native readback; actual IAM token/CP context/grant/revocation and cross-tenant denial.
- **HYB-05:** separately approved Shared logistics contracts/producer authority, inbox/outbox and unknown booking reconciliation.
- **HYB-06/07:** source-provenanced road/freight/mixed-mode execution, legal/Trade Docs gates, and privacy-safe tracking.
- **HYB-08:** performance, recovery, lifecycle, legal holds, independent teardown and environment-specific approvals.

Proof must name commit/Shared pin, CI run, scenario, environment, identity/tenant, release, evidence custodian, timestamp, expiry, independent review and residual risk. Green CI is not production authorisation.
