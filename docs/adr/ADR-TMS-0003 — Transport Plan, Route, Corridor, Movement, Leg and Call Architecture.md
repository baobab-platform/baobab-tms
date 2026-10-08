# ADR-TMS-0003 — Transport Plan, Route, Corridor, Movement, Leg and Call Architecture

**Status:** Proposed — architectural review; not yet accepted or implemented  
**Date:** 2026-10-08  
**Repository:** baobab-platform/baobab-tms  
**Depends on:** Accepted ADR-TMS-0001 and ADR-TMS-0002; TMS-TECH-01 (separate technology proposal); applicable Shared contracts  
**Authority:** Shared for canonical contract and event publication; CP for provider/tenant binding and certification; IAM for identity  

> **Evidence boundary:** This ADR defines proposed domain/implementation rules. It does not create a deployed service, implemented capability, certified provider, qualified carrier, regulatory approval or live integration.


## 1. Decision
A **TransportPlan** is an independently versioned intended execution of one or more LogisticsShipment/Consignment allocations. A **TransportRoute** is the selected ordered itinerary for a plan version. A **TransportMovement** is an actual or scheduled trip, voyage or flight performed by an operating transport means. A **TransportLeg** is the segment of a movement between calls or operational nodes. A **TransportCall** is a planned or actual arrival/departure at a named facility/location. A **LogisticsCorridor** is a reusable route-pattern reference, NOT a trade lane, legal permission, a specific route or an instantiated movement.

\`\`\`mermaid
flowchart TD
  SR["Trade requirement or standalone transport demand"] --> LS["LogisticsShipment"]
  LS --> AL["Consignment / cargo allocations"]
  AL --> TP["TransportPlan revision"]
  TP --> RT["TransportRoute steps"]
  RT --> MV["TransportMovement(s)"]
  MV --> LG["TransportLeg(s)"]
  MV --> CL["TransportCall(s)"]
  LG --> TE["TransportEvent observations"]
  CL --> TE
\`\`\`

This diagram represents associations, **not** mandatory one-to-one cardinalities, database nesting or a forced creation sequence. A movement may carry many consignments; one consignment may traverse multiple movements. Cargo-less repositioning movements are valid. Transport plans and movements remain independent aggregates.

## 2. Identity and cardinality
| Entity | Required identity/context | Relationships | Authority |
|---|---|---|---|
| TransportPlan | plan_id, tenant/legal entity, revision, status | one or more source transport requirements; zero or more routes and allocations | TMS |
| TransportRoute | route_id, plan_id+version, ordered waypoint/node set | optional reusable corridor refs, alternative routes | TMS |
| TransportMovement | movement_id, mode, operating organisation reference, execution state | many consignments and legs/calls; may be repositioning-only | TMS |
| TransportLeg | leg_id, movement_id, origin/destination call refs, sequence | zero or more allocated consignment segments | TMS |
| TransportCall | call_id, movement_id, ordered sequence and place reference | planned/estimated/actual arrival and departure as separate fields | TMS |
| LogisticsCorridor | governed corridor reference + version | a plan route may cite multiple; no ownership of border law | owning corridor/CP context as governed |

Do not conflate origin-destination pair, transport plan, road path, country corridor, carrier booking and actual movement. Source-trade references use Shared CrossEngineObjectReference; provider-native voyage/flight/tracking numbers are ExternalReferences.

## 3. Planning and replanning
Plans have **DRAFT -> PROPOSED -> APPROVED -> COMMITTED -> SUPERSEDED/CANCELLED** candidate transitions. Approval and commitment require actor/tenant policy and valid allocations. A change after commitment creates a new revision with a reason, editor, causation and previous-version link; actual observed events are never retroactively rewritten. Alternatives retain status, assumptions, measurement units, estimate source/time, confidence and optimisation policy version.

A committed plan is not proof of carrier acceptance or customs eligibility. A route revision after dispatch must evaluate existing carrier commitments, capacity allocations, customer notifications and applicable regulatory/customs gates; do not silently orphan bookings or erase the previous route.

## 4. Time, cargo and multimodal rules
- Preserve UTC instant + original zone/offset where relevant; planned time windows, forecast ETAs and actual observations must have distinct provenance.
- Units of mass, dimensions, temperature and cargo quantity are governed and decimal-safe. A leg cannot allocate more consignment cargo than the shipment/cargo graph allows.
- Mode is explicit per movement/leg; **MULTIMODAL** describes a composite operation, not a vehicle type. Air waybill, shipping booking, road trip and rail consignment remain provider-specific adapter facts.
- Calls may reference port, terminal, warehouse, airport, inland depot or facility without making TMS their canonical master-data owner.
- A country boundary crossing is a geographic/operational event; its legal status comes from Trade Docs and Regulations, not route planning.
- State projections must be derivable from plan revisions and events, not opaque mutable status values.

## 5. API and event contract proposals
Potential local domain operations (NOT registered canonical capabilities): create plan; add consignment allocation; propose route alternative; commit plan revision; schedule/assign movement; record call and leg events; replan after disruption; query effective plan/history. Route alternatives require explicit approval authority.

Candidate facts: plan.revision-committed, movement.scheduled/departed/arrived, call.arrived/departed, leg.completed, cargo.handover-observed. Actual event names, producers, schemas and capabilities require Shared semantic acceptance; **do not emit unregistered logistics.* events**.

## 6. Failure and reconciliation
Wrong tenant/cargo IDs, impossible call order, legs spanning unrelated calls, reversed chronology beyond configured correction semantics, stale revision, double allocation and cyclic plan lineage fail validation. Carrier cancellation while cargo moves triggers an exception with replacement plan/version. Eventually consistent provider observations retain received order and occurred order; late facts cause a reconciled projection, never a rewrite of historical events.

## 7. Implementation gates
| Gate | Evidence required |
|---|---|
| TMS-PLAN-01 | Domain schemas, identifiers, cardinality/invariant unit tests and deterministic route/plan revision projection |
| TMS-PLAN-02 | PostgreSQL concurrent plan revisions and cargo-allocation integration tests, temporal/replay fixtures |
| TMS-PLAN-03 | Road multi-stop and two-carrier multimodal synthetic scenarios, including transshipment, revised route and failed booking |
| TMS-PLAN-04 | Shared-approved contract proposal and cross-engine provenance contract tests |
| TMS-PLAN-05 | Authorised plan commit, tenant isolation, webhook observations and guarded regulation/customs transition tests |

**Not decided here:** routing optimiser engine, carrier supplier pricing, actual customs release, financial account postings, a fully operating sea/air adapter or production certification.

## 8. Rejected shortcuts and governance

Do not reuse an unrelated engine's authoritative database, mint globally authoritative organisations, substitute a vendor tracking ID for a Baobab canonical object, hard-code an estate/market, publish unregistered capability or event keys, or call a simulated/synthetic operation production-ready. Changes affecting another owner must first be reconciled in **baobab-platform/shared** and the relevant owning engine. Approval of this ADR is not evidence of runtime fitness, certification or deployment.

## 9. Decision follow-up

Implement in separate gate-scoped PRs. Maintain a conformance matrix linking each normative rule to code, tests, contract fixtures and open limitations. Any key or API name in this ADR is **illustrative**, not automatically part of the canonical capability catalogue. Keep ADR-TMS-0001/0002 and accepted Shared authority in force; explain and obtain approval for any needed supersession.
