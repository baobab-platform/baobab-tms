# ADR-TMS-0004 — Carrier, Booking, Capacity and Transport Procurement Boundary

**Status:** Proposed — architectural review; not yet accepted or implemented  
**Date:** 2026-10-08  
**Repository:** baobab-platform/baobab-tms  
**Depends on:** Accepted ADR-TMS-0001 and ADR-TMS-0002; TMS-TECH-01 (separate technology proposal); applicable Shared contracts  
**Authority:** Shared for canonical contract and event publication; CP for provider/tenant binding and certification; IAM for identity  

> **Evidence boundary:** This ADR defines proposed domain/implementation rules. It does not create a deployed service, implemented capability, certified provider, qualified carrier, regulatory approval or live integration.


## 1. Decision
TMS owns operational carrier selection/booking orchestration and capacity execution, **not universal organisation identity, customer sale price or financial procurement/GL**. A carrier is a qualified real-world operating organisation, not the Baobab CapabilityProvider that executes §logistics.*§ APIs. Provider-neutral carrier and booking adapters permit asset-light 3PL/4PL, mixed own fleet, brokered road transport and future air/sea/rail arrangements.

\`\`\`text
TMS transport requirement
  -> carrier eligibility / capacity check
  -> quote/offer observation (provider provenance)
  -> transport purchase decision (authorised tenant policy)
  -> BookingIntent (idempotent)
  -> carrier adapter submission
  -> external acknowledgement/confirmation
  -> CapacityReservation / ResourceAssignment
  -> dispatch/movement execution
\`\`\`

## 2. Operational aggregates
| Concept | Meaning | Never equate to |
|---|---|---|
| CarrierReference | CP-governed canonical organisation/counterparty ref + operational eligibility projection | TMS service deployment ID |
| CarrierServiceProfile | modes, corridor coverage, licences, insurance, handling/temperature/safety constraints, effective period | global legal-entity master data |
| TransportTender | proposed request to one/many carriers against a transport-plan version | customer quotation in Trade |
| CarrierOffer | timed, scoped buy-rate/capacity/service proposal by carrier | booked capacity or a Trade sell rate |
| TransportBooking | TMS-owned booking intent and lifecycle with provider-native refs | Consignment or Movement |
| CapacityReservation | qualified and time-bound allocation of eligible capacity | ownership of asset, financial stock |
| ResourceAssignment | resource-to-movement allocation constrained by operability | ERP fixed-asset acquisition |
| BookingAttempt | immutable outbound request/digest/idempotency and carrier response | guaranteed booking |

A booking can cover multiple consignments; one consignment may require sequential bookings. Rebooking is a lifecycle change, not mandatory new Consignment identity. Carrier eligibility is scoped to market, transport mode, cargo, date, insurance and safety conditions.

## 3. State model
Booking candidate: **REQUESTED -> PENDING_PROVIDER -> CONFIRMED -> DISPATCHABLE -> IN_EXECUTION -> FULFILLED**, with mutually explicit **DECLINED / EXPIRED / CANCELLED / PROVIDER_UNKNOWN / FAILED_RECONCILIATION** outcomes. TMS MUST NOT mark CONFIRMED merely because HTTP POST returned 202 or timed out. Treat uncertain provider acceptance as §PROVIDER_UNKNOWN§ until reconciled by stable external reference or authoritative lookup; retries use the same idempotency scope.

Capacity reservations are released or rescheduled with durable outcome history. Prevent oversubscription using database constraints and transactional/concurrent occupancy checks; cross-provider global capacity cannot be guaranteed without provider cooperation.

## 4. Commercial and qualification boundaries
- CP/organisation and qualifying-provider capabilities supply canonical organisations and approval facts; TMS enforces them at selection and assignment.
- TMS can own carrier buy rates and operational cost estimates per ADR-0006; Trade owns customer quotation, margin/discount and contractual sale prices. ERP owns invoices, payable records, GL, settlement.
- Procurement exceptions record why an offer was not used, contract reference, actor/approval, bid expiry and comparison dimensions; no hidden preferential carrier algorithm.
- Internal fleets use the same booking/assignment abstraction where applicable, not special Thamani source logic.
- For maritime, air and rail, carrier/forwarder/booking semantics come through standards-specific adapters without changing the canonical TMS booking identity.
- A carrier acceptance is not Customs release, safe operating permit, regulatory clearance or proof cargo was physically loaded.

## 5. Interfaces and reliability
Candidate ports: §CarrierDirectoryReadPort§, §EligibilityReadPort§, §CarrierOfferPort§, §CarrierBookingPort§, §CapacityReservationPort§ and §CarrierWebhookPort§. All are tenant-, subject-, mode- and operation-scoped, audited and cancellation-safe.

Every external callback must authenticate the source, validate tenant/provider/scope, preserve raw assertion digest, external occurrence time, receipt time and message identity, and reconcile out-of-order status changes. A rejected or stale booking cannot be resurrected by an old provider callback. Publishing canonical business events requires accepted Shared definitions, not arbitrary naming.

## 6. Implementation gates
| Gate | Contract/test/evidence |
|---|---|
| TMS-BOOK-01 | Carrier vs capability-provider separation, qualification and authorisation tests |
| TMS-BOOK-02 | Provider-neutral Booking/Tender/Offer/Capacity schema and state-machine tests |
| TMS-BOOK-03 | Concurrent capacity holds, idempotent booking attempts, timeout/unknown/adoption and cancellation tests |
| TMS-BOOK-04 | First synthetic road carrier adapter with deterministic responses, forged/out-of-order callbacks |
| TMS-BOOK-05 | Source-contract alignment with Trade, ERP and CP; capability/event proposals to Shared |
| TMS-BOOK-06 | Real-carrier sandbox evidence with consent, credentials, service-level/rollback and production security review |

**Non-claims:** no real carrier contract, qualified fleet, live inventory of carrier capacity, committed financial purchase, active canonical capability or certified booking provider is proven by this ADR.

## 8. Rejected shortcuts and governance

Do not reuse an unrelated engine's authoritative database, mint globally authoritative organisations, substitute a vendor tracking ID for a Baobab canonical object, hard-code an estate/market, publish unregistered capability or event keys, or call a simulated/synthetic operation production-ready. Changes affecting another owner must first be reconciled in **baobab-platform/shared** and the relevant owning engine. Approval of this ADR is not evidence of runtime fitness, certification or deployment.

## 9. Decision follow-up

Implement in separate gate-scoped PRs. Maintain a conformance matrix linking each normative rule to code, tests, contract fixtures and open limitations. Any key or API name in this ADR is **illustrative**, not automatically part of the canonical capability catalogue. Keep ADR-TMS-0001/0002 and accepted Shared authority in force; explain and obtain approval for any needed supersession.
