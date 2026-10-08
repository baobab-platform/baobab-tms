# ADR-TMS-0005 — Fleet, Transport Means, Equipment, Resource and Assignment Architecture

**Status:** Proposed — architectural review; not yet accepted or implemented  
**Date:** 2026-10-08  
**Repository:** baobab-platform/baobab-tms  
**Depends on:** Accepted ADR-TMS-0001 and ADR-TMS-0002; TMS-TECH-01 (separate technology proposal); applicable Shared contracts  
**Authority:** Shared for canonical contract and event publication; CP for provider/tenant binding and certification; IAM for identity  

> **Evidence boundary:** This ADR defines proposed domain/implementation rules. It does not create a deployed service, implemented capability, certified provider, qualified carrier, regulatory approval or live integration.


## 1. Decision
TMS owns operational descriptions and assignments of transport means, transport equipment and capacity-relevant resources, whether **OWNED, LEASED, CHARTERED, PARTNER or SUBCONTRACTED**. It does **not** acquire assets, amortise/depreciate them or hold the ERP financial asset ledger. A tenant may have zero owned vehicles.

The model distinguishes **TransportResource** (operational subject), **TransportMeans** (propulsive/operating vehicle such as truck, vessel, aircraft or locomotive), **TransportEquipment** (container, trailer, ULD, wagon or platform), **CapacityProfile** (physical/operating characteristics) and **ResourceAssignment** (time-bound commitment to movement/call/leg). External operator identifiers remain typed references.

## 2. Operational resource identity and ownership
| Entity | Key fields | Governing authority |
|---|---|---|
| TransportResource | tms_resource_id, tenant scope, source organisation ref, resource classification, serviceability state | TMS operational projection |
| TransportMeans | mode/type/registration, payload constraints, availability windows, operator | TMS operational reference; external certificate origin retained |
| TransportEquipment | kind/size/serial/handling attributes, compatibility and ownership reference | TMS operational projection |
| CapacityProfile | weight/volume/slots/pallets/temperature/dangerous cargo envelope, units and validity | operational source with provenance |
| ResourceAssignment | movement_id, scoped resource IDs, capacity allocation, start/end, effective revision | TMS |
| Maintenance/SafetyAssessmentRef | source, outcome, expiry, evidence/decision ref | real operator or certifying authority; TMS enforces |

One vehicle can pull several trailers sequentially, carry multiple consignments, be unavailable at certain times and represent partner capacity without changing canonical vehicle identity. Distinguish asset owner, carrier operator, driver and beneficial commercial party.

## 3. Assignment rules
- Validate transport mode, cargo constraints, regulatory fitness, serviceability and provider entitlement at **assignment time**, not solely at resource creation.
- Use transactional locking/unique exclusion constraints to prevent overlapping incompatible resource commitments and double allocation; account for staged assignment vs confirmed.
- Permit capacity splitting, intermodal loading and detachment only through auditable transitions; cargo source quantities and ownership remain Trade/ERP governed.
- Resource unavailable, uninspected or credential expired is §BLOCKED§ for guarded dispatch. Return explicit reason/evidence ref and replan; do not silently downgrade safety constraints.
- Commercial asset-light booking may reference only an external carrier resource class until confirmed; do not fabricate a truck plate or vessel ID.
- Resource telemetry and position are sourced observations, not intrinsic mutable identity. Financial costs and depreciation still belong ERP.

## 4. Boundary with drivers, WMS and security
IAM authenticates drivers/operators; the TMS authorises transport-domain actions. A driver employment record belongs a workforce or partner system. Warehouse bin, putaway, pick and stock count remain WMS/ERP; TMS may reference HandlingUnit and loading/handover events but does not own inventory stock adjustments. Drivers/cargo location history is sensitive; expose location only to permitted business parties and limit retention.

## 5. API and integration seams
Candidate local operations: resolve resource; attach validated capabilities/certificates; publish available capacity snapshot; hold capacity; assign/unassign; suspend unsafe resource; reconcile external fleet/driver status. Provider adapters should be swappable without changing canonical IDs or creating global TMS organisation masters.

## 6. Implementation gates
| Gate | Measurable exit |
|---|---|
| TMS-RES-01 | Resource/means/equipment terminology, identity and owner/operator reference schema tested |
| TMS-RES-02 | Per-mode capacity constraints and unit arithmetic tests; hazardous/temperature proof negative cases |
| TMS-RES-03 | Concurrent assignment, overlapping time windows, expiration and cancellation integration tests |
| TMS-RES-04 | Internal resource and third-party asset-light provider scenario with identical API |
| TMS-RES-05 | IAM/CP/ERP/WMS boundary tests and sensitive telemetry access/retention review |
| TMS-RES-06 | Live provider acceptance only after actual certificates/eligibility sources exist |

No fleet device protocol, fuel/maintenance system, telematics vendor or third-party certification is selected here. Financial asset management stays in ERP.

## 8. Rejected shortcuts and governance

Do not reuse an unrelated engine's authoritative database, mint globally authoritative organisations, substitute a vendor tracking ID for a Baobab canonical object, hard-code an estate/market, publish unregistered capability or event keys, or call a simulated/synthetic operation production-ready. Changes affecting another owner must first be reconciled in **baobab-platform/shared** and the relevant owning engine. Approval of this ADR is not evidence of runtime fitness, certification or deployment.

## 9. Decision follow-up

Implement in separate gate-scoped PRs. Maintain a conformance matrix linking each normative rule to code, tests, contract fixtures and open limitations. Any key or API name in this ADR is **illustrative**, not automatically part of the canonical capability catalogue. Keep ADR-TMS-0001/0002 and accepted Shared authority in force; explain and obtain approval for any needed supersession.
