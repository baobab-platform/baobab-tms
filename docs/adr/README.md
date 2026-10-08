# Baobab TMS — Architecture Decision Register

**Repository:** `baobab-platform/baobab-tms`  
**Register updated:** 2026-10-08  
**Maturity:** Foundation-0 architecture; **no executable TMS capability, certified provider, live carrier integration or production approval** is established by these documents.

## Architecture authority and status

- **ADR-TMS-0001 and ADR-TMS-0002 are Accepted** foundational authority.
- **ADR-TMS-0003 through ADR-TMS-0019 are Proposed**, pending explicit architecture review. Their existence in `main`, if merged, does not make them Accepted.
- ADR-TMS-0003..0015 follow the predeclared programme in ADR-TMS-0001 §63. **ADR-TMS-0016..0019 are new proposed extensions**, not silently retroactive charter decisions.
- [TMS-TECH-01](../architecture/TMS-TECH-01%20%E2%80%94%20Headless%20Self-Hosted%20TMS%20Runtime%20and%20OSS%20Reuse%20Strategy.md) is a separate technology document, merged as PR #2; its document status remains **Proposed** unless formally accepted.
- [Shared](https://github.com/baobab-platform/shared) owns canonical contracts and events; [Control Plane](https://github.com/baobab-platform/baobab-cp) owns engine/provider binding, entitlement and certification state; [IAM](https://github.com/baobab-platform/baobab-iam) authenticates identities.
- Existing `contracts/shipment/v1` and `trade.shipment` events remain Trade-owned until separately approved Shared/consumer migration. No `logistics.*` event or capability activation is implied by this ADR package.

## ADR catalogue

| ADR | Status | Decision |
|---|---|---|
| ADR-TMS-0001 | **Accepted** | [ADR-TMS-0001 — Baobab TMS Mission, Authority, Transport Execution Boundary and Platform Capability Role](ADR-TMS-0001%20%E2%80%94%20Baobab%20TMS%20Mission,%20Authority,%20Transport%20Execution%20Boundary%20and%20Platform%20Capability%20Role.md) |
| ADR-TMS-0002 | **Accepted** | [ADR-TMS-0002 — Canonical LogisticsShipment, Consignment and Transport Execution Domain Model](ADR-TMS-0002%20%E2%80%94%20Canonical%20LogisticsShipment,%20Consignment%20and%20Transport%20Execution%20Domain%20Model.md) |
| ADR-TMS-0003 | **Proposed** | [ADR-TMS-0003 — Transport Plan, Route, Corridor, Movement, Leg and Call Architecture](ADR-TMS-0003%20%E2%80%94%20Transport%20Plan,%20Route,%20Corridor,%20Movement,%20Leg%20and%20Call%20Architecture.md) |
| ADR-TMS-0004 | **Proposed** | [ADR-TMS-0004 — Carrier, Booking, Capacity and Transport Procurement Boundary](ADR-TMS-0004%20%E2%80%94%20Carrier,%20Booking,%20Capacity%20and%20Transport%20Procurement%20Boundary.md) |
| ADR-TMS-0005 | **Proposed** | [ADR-TMS-0005 — Fleet, Transport Means, Equipment, Resource and Assignment Architecture](ADR-TMS-0005%20%E2%80%94%20Fleet,%20Transport%20Means,%20Equipment,%20Resource%20and%20Assignment%20Architecture.md) |
| ADR-TMS-0006 | **Proposed** | [ADR-TMS-0006 — Transport Rates, Carrier Buy Cost and Operational Costing Architecture](ADR-TMS-0006%20%E2%80%94%20Transport%20Rates,%20Carrier%20Buy%20Cost%20and%20Operational%20Costing%20Architecture.md) |
| ADR-TMS-0007 | **Proposed** | [ADR-TMS-0007 — Tracking, Milestones, Events, Telemetry and Visibility Architecture](ADR-TMS-0007%20%E2%80%94%20Tracking,%20Milestones,%20Events,%20Telemetry%20and%20Visibility%20Architecture.md) |
| ADR-TMS-0008 | **Proposed** | [ADR-TMS-0008 — Delivery, POD Reference and Transport Exception Architecture](ADR-TMS-0008%20%E2%80%94%20Delivery,%20POD%20Reference%20and%20Transport%20Exception%20Architecture.md) |
| ADR-TMS-0009 | **Proposed** | [ADR-TMS-0009 — Multimodal Provider Adapter and Standards Interoperability Architecture](ADR-TMS-0009%20%E2%80%94%20Multimodal%20Provider%20Adapter%20and%20Standards%20Interoperability%20Architecture.md) |
| ADR-TMS-0010 | **Proposed** | [ADR-TMS-0010 — Tenant, Isolation, Context and Canonical Reference Architecture](ADR-TMS-0010%20%E2%80%94%20Tenant,%20Isolation,%20Context%20and%20Canonical%20Reference%20Architecture.md) |
| ADR-TMS-0011 | **Proposed** | [ADR-TMS-0011 — API, Event, Idempotency and Distributed Workflow Architecture](ADR-TMS-0011%20%E2%80%94%20API,%20Event,%20Idempotency%20and%20Distributed%20Workflow%20Architecture.md) |
| ADR-TMS-0012 | **Proposed** | [ADR-TMS-0012 — Persistence, Temporal History and Projection Architecture](ADR-TMS-0012%20%E2%80%94%20Persistence,%20Temporal%20History%20and%20Projection%20Architecture.md) |
| ADR-TMS-0013 | **Proposed** | [ADR-TMS-0013 — Security, Authorization and Provider Integration Credentials](ADR-TMS-0013%20%E2%80%94%20Security,%20Authorization%20and%20Provider%20Integration%20Credentials.md) |
| ADR-TMS-0014 | **Proposed** | [ADR-TMS-0014 — Observability, Resilience, Reconciliation and DR Architecture](ADR-TMS-0014%20%E2%80%94%20Observability,%20Resilience,%20Reconciliation%20and%20DR%20Architecture.md) |
| ADR-TMS-0015 | **Proposed** | [ADR-TMS-0015 — Production Readiness, Capability Certification and Migration](ADR-TMS-0015%20%E2%80%94%20Production%20Readiness,%20Capability%20Certification%20and%20Migration.md) |
| ADR-TMS-0016 | **Proposed** | [ADR-TMS-0016 — Transport Service Levels, ETA and Operational Commitment Architecture](ADR-TMS-0016%20%E2%80%94%20Transport%20Service%20Levels,%20ETA%20and%20Operational%20Commitment%20Architecture.md) |
| ADR-TMS-0017 | **Proposed** | [ADR-TMS-0017 — Cargo Custody, Terminal and Warehouse Handoff Architecture](ADR-TMS-0017%20%E2%80%94%20Cargo%20Custody,%20Terminal%20and%20Warehouse%20Handoff%20Architecture.md) |
| ADR-TMS-0018 | **Proposed** | [ADR-TMS-0018 — Regulatory and Customs Execution Gates](ADR-TMS-0018%20%E2%80%94%20Regulatory%20and%20Customs%20Execution%20Gates.md) |
| ADR-TMS-0019 | **Proposed** | [ADR-TMS-0019 — Transport Optimisation, Simulation and Decision Support Architecture](ADR-TMS-0019%20%E2%80%94%20Transport%20Optimisation,%20Simulation%20and%20Decision%20Support%20Architecture.md) |

## Implementation dependency groups

| Stage | ADRs | Demonstrable output |
|---|---|---|
| 0. Foundational authority and stack | Accepted 0001/0002, TMS-TECH-01; proposed 0010/0012/0013 | Canonical identity, tenant/context, persistence and secure headless runtime proof |
| 1. Execution model | 0003/0004/0005 | Reproducible plans, consignment allocation, carrier booking, resource capacity |
| 2. Integration | 0011/0009/0018 | Authenticated commands, durable messages, provider ports and regulatory execution gates |
| 3. Visibility and delivery | 0007/0008/0016/0017 | Source-provenance tracking, POD refs, ETA/SLA and custody handoff |
| 4. Optimisation and cost | 0006/0019 | Auditable buy-cost estimate and non-authoritative route decision support |
| 5. Acceptance | 0014/0015 | Recovery drill, migration reconciliation and per-capability CP/EA-09 evidence |

**Sequencing:** these groups are dependency guidance, not a mandate to write all code at once. Build narrow vertical slices with tests and explicit contract/authority reviews. Security, context, transactional history and blocked-transition enforcement must precede operational external commands.

## First executable vertical slice

```text
TradeShipment or direct authorised transport requirement
 -> CP context + IAM identity checks
 -> TMS LogisticsShipment, Consignment, TransportPlan
 -> selected road CarrierBooking, explicit provider acknowledgement
 -> TransportMovement / Leg / Call / trusted tracking events
 -> guarded regulatory/customs actions if applicable
 -> DeliveryAttempt and pinned Trade Docs POD DocumentVersion
 -> Shared canonical logistics facts (only once contracts/authority approved)
 -> Trade and ERP consume permitted references/consequences
```

Use synthetic carriers first. Demonstrate Thamani and ZuriBeans under independent legal-entity and tenant entitlements, including wrong-tenant negative tests, duplicate callback replay, uncertain booking outcome and immutable historical recovery.

## Evidence and review discipline

Each Proposed ADR includes scoped implementation gates. Reviewers should require a gate matrix containing **source code path, conformance fixture, test result, dependency/pinned Shared SHA, security/tenant isolation evidence, integration provider assumptions, known unsupported operations and operational/deployment proof**. Design-document merge is not code implementation. A self-hosted container, green PR or passing simulated event test does not imply provider activation, live multimodal operations or lawful customs execution.

**Do not mark any Proposed ADR as Accepted until the responsible architecture governance records the actual decision.**
