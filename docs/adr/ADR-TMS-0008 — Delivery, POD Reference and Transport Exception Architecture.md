# ADR-TMS-0008 — Delivery, POD Reference and Transport Exception Architecture

**Status:** Proposed — architectural review; not yet accepted or implemented  
**Date:** 2026-10-08  
**Repository:** baobab-platform/baobab-tms  
**Depends on:** Accepted ADR-TMS-0001 and ADR-TMS-0002; TMS-TECH-01 technology constraints; applicable Shared contracts  
**Authority:** Shared owns canonical contracts/events, CP owns context/provider/activation, IAM authenticates; TMS owns transport execution  

> This decision describes required future behaviour and testing, not deployed software, provider certification, live tracking coverage, qualified carrier relationships or market permission.


## 1. Decision
TMS owns physical delivery execution facts, attempts, custody handoffs and operational exceptions. **Delivery** is a physical execution milestone; **recipient acceptance** may be a distinct commercial/legal act; **proof-of-delivery (POD)** is a document/evidence object whose semantic identity and immutable versions belong to **Trade Docs**. Do not embed original signed PDFs or create parallel TradeDocument authority in TMS.

\`\`\`text
TransportMovement / Leg / Call
      -> arrival-at-delivery-location (observation)
      -> delivery attempt
          -> DELIVERED (operational confirmation)
          -> FAILED/REFUSED/PARTIAL/RESCHEDULED/RETURNED
      -> POD evidence reference via Trade Docs
      -> Trade/ERP consumer effects only under their accepted rules
\`\`\`

## 2. Distinct state axes
| Axis | Example | Authority |
|---|---|---|
| Transport execution | IN_TRANSIT, ARRIVED, DELIVERY_ATTEMPTED, DELIVERED, RETURN_STARTED | TMS |
| Condition/hold | customs block, unsafe cargo, inaccessible address, missing receiver | TMS condition referencing owner decisions |
| Exception | damage, short delivered, missed slot, refused, theft, temperature excursion | TMS operational record with external evidence provenance |
| Documentary proof | signed POD, photo, authority scan, timestamped issuer claim | Trade Docs version/content/artifact lifecycle |
| Recipient acceptance | accepted/rejected quantity, commercial dispute | recipient/Trade and other relevant agreement authority |
| Financial consequence | delivery-based payable/invoicing eligibility | ERP/commercial workflow |
| Regulatory and customs restriction | transport eligibility from external release/Regulations | Trade Docs/Regulations decisions |

An exception is not a replacement for shipment lifecycle state. A customs hold does not mean "delivery failed"; a delivered cargo is not necessarily accepted as conforming goods.

## 3. Domain and invariants
DeliveryAttempt has a stable ID, tenant+shipment/consignment allocation, call/leg/movement source, expected handover point, involved parties, observed result, observed/recorded time, evidence references and policy/rule version. Support partial deliveries using explicit delivered/rejected/missing quantities and units; sum cannot exceed allocated cargo. Returns and reverse logistics require a new execution requirement or linked journey rather than mutating completed historical delivery.

Exceptions have typed category, severity, source, evidence reference, owner, affected scope, opened_at/resolved_at, mitigation, actor and audit. Multiple exceptions may coexist. Exception closure cannot rewrite the original event. Claims of stolen/damaged/temperature-breached require evidence source and must not become automatic insurance or regulatory decisions.

## 4. POD handling
- Capture an image/signature/geolocation observation subject to consent and security; create/document/issue the POD via Trade Docs, then retain an **identity-pinned DocumentVersion reference** and issuer/source metadata in TMS.
- If Trade Docs is down or POD unavailable, TMS may retain a scoped **POD_PENDING** execution condition with retry/reconciliation. It must not invent a verified document version.
- Preserve distinction among unsigned observation, person-name entry, cryptographically validated signature, verified identity and legally accepted proof.
- Restrict photos, signatures, GPS and personally identifiable receiver details by classification and retention; never expose artifact storage URLs to unauthorised tracking viewers.

## 5. Customer promises and exceptions
Customer-facing promise and cancellation terms belong Trade/Thamani or the contractual seller; TMS records actual carrier/delivery performance and SLA measurements (elaborated by ADR-TMS-0016). Claims/insurance payouts are outside TMS. Carrier and warehouse custody handoffs are further detailed by ADR-TMS-0017.

## 6. Implementation gates
| Gate | Executable proof |
|---|---|
| TMS-DEL-01 | Attempt, partial quantity, return and exception schemas/state transitions, unit tests |
| TMS-DEL-02 | Source-specific POD references, document-version pinning and wrong-tenant access rejection |
| TMS-DEL-03 | Positive/failed/refused/partial and duplicate-attempt integration tests |
| TMS-DEL-04 | TMS->Trade Docs integration conformance and unavailable-document reconciliation |
| TMS-DEL-05 | Trade/ERP consumption tests proving delivery does not automatically invoice or imply acceptance |
| TMS-DEL-06 | Sensitive evidence/driver/receiver data protection and signed external carrier proof validation |

**Not claimed:** legally sufficient POD in all jurisdictions, customs release, recipient legal acceptance, or access to live carrier evidentiary services.

## 8. Alternatives and governance

Rejected: monolithic TMS-vendor domain authority, unaudited vendor callbacks, third-party IDs as canonical identity, copying document/ERP/Regulations decisions, tenant-specific engine forks, declaring candidate capabilities canonical or treating a successful sandbox test as CP certification. Accepted Shared contracts and previous Accepted TMS decisions take precedence. Any cross-owner wire semantic change must go through Shared as a separate PR.

## 9. Decision follow-up

Each gate is an independent implementation checkpoint with a PR, source paths, contract fixtures, negative tests, runtime metrics and explicitly documented unimplemented cases. The decision remains **Proposed** until formally accepted; no event/capability activation, staging approval or production acceptance is granted here.
