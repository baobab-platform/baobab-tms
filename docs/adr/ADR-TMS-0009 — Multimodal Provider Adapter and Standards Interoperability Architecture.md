# ADR-TMS-0009 — Multimodal Provider Adapter and Standards Interoperability Architecture

**Status:** Proposed — architectural review; not yet accepted or implemented  
**Date:** 2026-10-08  
**Repository:** baobab-platform/baobab-tms  
**Depends on:** Accepted ADR-TMS-0001 and ADR-TMS-0002; TMS-TECH-01 technology constraints; applicable Shared contracts  
**Authority:** Shared owns canonical contracts/events, CP owns context/provider/activation, IAM authenticates; TMS owns transport execution  

> This decision describes required future behaviour and testing, not deployed software, provider certification, live tracking coverage, qualified carrier relationships or market permission.


## 1. Decision
Implement mode-specific **anti-corruption adapters** behind canonical TMS ports rather than installing a universal freight stack or encoding DCSA/IATA/GS1 message schemas as Baobab domain entities. The headless engine can support road first and progressively add maritime, air, rail, inland waterway, courier and multimodal. "Multimodal" is composition of movements, documents, handoffs and bookings; it is not one vehicle type.

\`\`\`mermaid
flowchart LR
  BAO["Baobab TMS canonical domain"] --> P["Versioned provider ports"]
  P --> R["Road carrier/webhook adapter"]
  P --> M["DCSA-aligned ocean booking/tracking adapter"]
  P --> A["IATA ONE Record-aligned air adapter"]
  P --> G["Rail / barge / courier adapters"]
  R --> E["External provider"]
  M --> E
  A --> E
  G --> E
\`\`\`

## 2. Standard families and reach
| Mode / purpose | Industry model to evaluate | Adapter constraint |
|---|---|---|
| Container/ocean | DCSA Booking; Track & Trace; relevant shipment/equipment standards | Map transport booking, voyage, equipment and events with explicit source/version; cannot claim all carriers implement current DCSA |
| Air cargo | IATA ONE Record | Linked data/API consent, airline/forwarder context, air waybill semantics and event provenance |
| General multimodal trade | UN/CEFACT Multi-Modal Transport RDM | Semantic harmonisation; not a mandatory canonical database |
| Cargo visibility | GS1 EPCIS | Observation-source and object/handling-unit event mapping; no forced native EPCIS domain |
| Road dispatch and routing | Provider-specific REST/EDI and self-hostable optimisation components after fit-gap | No assumed route solver, road-map accuracy or global ETA service |

Standards and externally valid schema versions must be pinned at each adapter configuration and conformance test. Avoid claiming integration with a specific country's Customs electronic system: that belongs Trade Docs authority adapters.

## 3. Port contracts
Common ports include §BookingProviderPort§, §CapacityProviderPort§, §MovementSchedulePort§, §TrackingObservationPort§, §ResourceLookupPort§ and §TransportDocumentReferencePort§. Every port supplies canonical context, request ID, explicit timeouts/deadlines, trace correlation, provider operation type, external-reference mapping and policy. The response separates provider acknowledgement, later final outcome, retriable technical failure, permanent rejection and uncertain outcome. Source-specific fields that have no canonical equivalent are kept as bounded extension metadata with provenance.

## 4. Routing, callbacks and compatibility
- Authenticate transport partners through IAM workload federation, scoped mTLS/OAuth/client credentials or independently audited adapter methods; never one global shared carrier token for all tenants.
- Validate and quarantine provider events before domain projection. Preserve signed/raw original digest when legally/operationally required but do not copy sensitive raw carrier payloads into public events.
- Support stable idempotency keys, cursor replay/high-water marks, rate limits, backoff, DLQ, clock drift and deduplication across retransmissions.
- Provider migration uses dual-read/shadow conformance and explicit cutover: external booking identifiers and active movements cannot be silently rewritten when adapter version changes.
- A country/tenant's partner eligibility is resolved through CP entitlement/contract and TMS provider policy; do not hard-code a single national carrier or force Thamani's partners onto ZuriBeans.
- Fail closed when mandatory eligibility/booking status is unknown. Read-only tracking may degrade gracefully while flagging freshness/confidence.

## 5. Quality and interoperability evidence
Each adapter must publish **supported** operation matrix: CREATE_BOOKING, CANCEL, BOOKING_STATUS, MILESTONE_READ, PUSH_TRACKING, CAPACITY_QUERY, etc., plus schema/standard version, mode, regions, auth scheme, rate limits and supported error types. "API available" does not equal executable booking certification.

## 6. Implementation gates
| Gate | Proof and limits |
|---|---|
| TMS-ADP-01 | Canonical port/type schemas; standard mapping and cross-engine authority fit-gap |
| TMS-ADP-02 | Mock road adapter including retry, timeout, source signatures and conflicting callbacks |
| TMS-ADP-03 | DCSA ocean **fixture-only** mapping proof with booking/equipment/transport events |
| TMS-ADP-04 | IATA ONE Record **fixture-only** mapping proof; no real airline service claimed |
| TMS-ADP-05 | Per-provider integration sandbox and version compatibility matrix |
| TMS-ADP-06 | Security, licences, partner consent, disaster recovery and selective production certification |

The platform may publish support only for proven operations/modes. Capability declarations and active bindings require separate Shared/CP and EA-09 evidence.

## 8. Alternatives and governance

Rejected: monolithic TMS-vendor domain authority, unaudited vendor callbacks, third-party IDs as canonical identity, copying document/ERP/Regulations decisions, tenant-specific engine forks, declaring candidate capabilities canonical or treating a successful sandbox test as CP certification. Accepted Shared contracts and previous Accepted TMS decisions take precedence. Any cross-owner wire semantic change must go through Shared as a separate PR.

## 9. Decision follow-up

Each gate is an independent implementation checkpoint with a PR, source paths, contract fixtures, negative tests, runtime metrics and explicitly documented unimplemented cases. The decision remains **Proposed** until formally accepted; no event/capability activation, staging approval or production acceptance is granted here.
