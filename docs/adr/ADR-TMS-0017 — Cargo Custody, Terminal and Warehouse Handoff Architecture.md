# ADR-TMS-0017 — Cargo Custody, Terminal and Warehouse Handoff Architecture

**Status:** Proposed — extension to charter programme; awaiting architecture acceptance  
**Date:** 2026-10-08  
**Repository:** baobab-platform/baobab-tms  
**Authority:** Accepted ADR-TMS-0001/0002, current Shared and CP/IAM governance; approved TMS implementation contracts only when separately registered  
**Programme note:** ADR-TMS-0016 through ADR-TMS-0019 extend the initial ADR-0001 programme (which originally ended at 0015); numbering and scope are proposals, not retroactively accepted charter decisions.  

> This document does not activate runtime, canonical capabilities, provider support, legal authority, production deployment or certified transport outcomes.


## 1. Why the decision is needed
A LogisticsShipment can pass between producer, pickup carrier, warehouse, port/terminal, shipping line, customs-controlled facility, destination carrier and recipient. Existing ADRs distinguish physical custody from ownership but need explicit handoff evidence. This ADR is about **transport custody**, not warehouse stock movements, legal title, financial inventory, or document authorship.

## 2. Decision
Model **CustodyHandoff**, **CustodyEvent**, **HandlingUnitReference**, **Location/FacilityReference**, **CustodyPartyReference**, **QuantityConditionSnapshot** and **HandoffDiscrepancy** with durable TMS identity and source provenance. One handoff concerns an explicit portion of a consignment and may occur at a movement-leg/call boundary. TMS records operational custody claims and acknowledgements; it does **not** create legal transfer of title.

\`\`\`mermaid
flowchart LR
  A["Supplier / pickup"] --> B["Road Carrier A"]
  B --> C["Warehouse / Port Terminal"]
  C --> D["Ocean/Air/Rail Provider"]
  D --> E["Destination Carrier"]
  E --> F["Recipient"]
\`\`\`

Transitions may be unacknowledged, disputed or partial; a carrier's unilateral "handed over" status cannot silently become a recipient's verified acceptance.

## 3. Handoff contract
| Field/fact | Requirement |
|---|---|
| handoff_id and affected cargo | TMS stable handoff ID, tenant, LogisticsShipment/Consignment/Cargo/HandlingUnit associations and quantities with units |
| from/to party | CP/canonical organisation refs, personnel role, applicable provider assignment |
| facility and operational context | governed place ref, geolocation where allowed, movement/leg/call, effective timestamp |
| intent and observation | initiated/attempted/acknowledged/contested/completed as distinct states |
| physical condition | count, weight/volume, seal IDs, packaging/damage/temperature observations with source |
| evidence | pinned Trade Docs DocumentVersion or approved evidence ref; never raw unsigned object URL |
| trust | actor credential, provider signature, carrier control evidence, original observation ID, source/record time |
| mismatch | shortages, overages, broken seals, damaged goods, timestamp conflict and independent resolution |
| legal boundary | no automatic transfer of title, insurance risk, Incoterms ownership or customs-release conclusion |

## 4. Invariants and disputes
- Sum of transferred cargo quantities cannot exceed valid allocated quantity, unless explicitly corrected with proven source and auditable event.
- Overlapping handoffs across different physical custodians must be reported/flagged unless explicitly represented as joint custody; don't falsely force a single custodian if operational evidence is conflicting.
- Custody snapshots are traceable historically; corrections append a new observation and link supersession.
- Warehouse WMS owns receiving, bin/locator, pick, cycle count and stock ledger. TMS consumes a handoff projection and may request/refer to HandlingUnit, but cannot mutate the WMS stock tables.
- Carrier customs controlled-bond status does not imply cargo freely releasable or importable. Trade Docs/Regulations provide decision refs; a border hold remains guarded.
- A booking, warehouse storage receipt, seal scan, POD, delivery and legal acceptance are distinct facts; display this precisely.
- Unknown previous custodian or unverified seal means a risk/exception state, not a fabricated chain of custody.

## 5. Interoperability and data policy
Adapter mappings for terminal EDI/API, GS1 EPCIS custody/aggregation, sea-container events and road carriers are optional and standards-versioned. Preserve raw source claim/digest and origin. Driver ID, receiver signature, cargo security classification, warehouse facility position, seal and route may be sensitive. Least-privilege projections for terminal, carrier, supplier, customs intermediary and customer must be distinct and tenant/relationship-scoped.

## 6. Example
Coffee cargo pallet P-1 is picked up by Carrier A, received by terminal with count discrepancy, moved into an ocean container and handed to carrier B on arrival. Each transfer has source and quantity evidence, with a separate contested terminal receipt and no automatic reassignment of inventory financial ownership. ZuriBeans gets a permitted visibility projection; the facility's inventory ledger remains external.

## 7. Implementation gates
| Gate | Proof |
|---|---|
| TMS-CUS-01 | Cargo/HandlingUnit/custody identity model and partial quantity fixtures |
| TMS-CUS-02 | Initiate/acknowledge/dispute and dual-party signed handoff tests |
| TMS-CUS-03 | Cross-carrier/terminal multi-leg chain with missing/contradictory custody observations |
| TMS-CUS-04 | Trade Docs POD/evidence pinning, WMS/ERP ownership no-write conformance |
| TMS-CUS-05 | Dangerous-goods/seal exception and sensitive location/party privacy tests |
| TMS-CUS-06 | Independent carrier/terminal sandbox proof before live custody certification |

No carrier exchange, warehouse API or legally enforceable custody warranty is implemented merely by acceptance.

## 8. Rejected shortcuts, dependencies and non-claims

Do not create tenant-specific TMS engines, assume external provider assertions are verified facts, collapse legal/commercial/document/financial authority into TMS, write another engine's operational database, or equate model/solver/API availability with production service acceptance. Any Shared schema/event/capability change requires an accepted Shared PR, and provider activation requires Control Plane/EA-09 evidence. Follow up with bounded implementation PRs, tests and explicit unsupported-case reporting.

## 9. Traceability

This proposal extends [the accepted TMS charter and canonical domain ADRs](https://github.com/baobab-platform/baobab-tms/tree/main/docs/adr), complements [TMS-TECH-01](https://github.com/baobab-platform/baobab-tms/tree/main/docs/architecture) and follows [Shared cross-engine reference/contract governance](https://github.com/baobab-platform/shared). The TMS headless/self-hosted requirement and Thamani/ZuriBeans tenant independence remain unchanged.
