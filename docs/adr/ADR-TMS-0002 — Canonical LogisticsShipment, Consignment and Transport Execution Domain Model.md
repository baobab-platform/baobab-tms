# ADR-TMS-0002 — Canonical LogisticsShipment, Consignment and Transport Execution Domain Model

**Status:** Accepted — Foundational TMS Domain Architecture  
**Date:** 2026-10-03  
**Repository:** `baobab-platform/baobab-tms`  
**Engine:** Baobab TMS  
**Depends On:** ADR-TMS-0001  
**Platform Contract Authority:** `baobab-platform/shared`  
**Capability Resolution Authority:** `baobab-platform/baobab-cp`  
**Canonical Organisation Authority:** `baobab-platform/baobab-cp`  
**Financial Authority:** `baobab-platform/baobab-erp`  
**Regulatory Decision Authority:** `baobab-platform/baobab-regulations`  
**Trade-Document / Customs Workflow Authority:** `baobab-platform/baobab-trade-docs`  
**Commerce / Trade Authority:** `baobab-platform/baobab-trade` where applicable  
**Decision Class:** Canonical transport domain / shipment / consignment / cargo / execution / identity / lifecycle / migration

---

# 1. Decision

Baobab TMS SHALL adopt a canonical multimodal transport-execution model centred on the following independently identifiable concepts:

```text
Transport Requirement
        │
        ▼
LogisticsShipment
        │
        ├───────────────┐
        ▼               ▼
   Consignment A    Consignment B
        │               │
        └───────┬───────┘
                ▼
          TransportPlan
                │
                ▼
          TransportRoute
                │
                ▼
       TransportMovement(s)
                │
                ▼
          TransportLeg(s)
                │
                ▼
          TransportCall(s)
                │
                ▼
          TransportEvent(s)
                │
                ▼
              Delivery
```

The engine SHALL additionally model the transported physical hierarchy:

```text
CargoItem
    │
    ▼
TransportPackage
    │
    ▼
HandlingUnit
    │
    ▼
TransportEquipment
    │
    ▼
TransportMeans
```

where applicable.

These concepts SHALL NOT be collapsed into a single mutable `Shipment` record.

---

# 2. Critical Naming Decision — `LogisticsShipment`

The canonical TMS aggregate SHALL be named:

```text
LogisticsShipment
```

rather than using the unqualified cross-platform name:

```text
Shipment
```

The reason is architectural, not stylistic.

Baobab already has:

```text
com.baobab-platform.trade.shipment.*
```

ACTIVE canonical events produced by `baobab-trade`.

The existing Shared:

```text
contracts/shipment/v1
```

also describes a shipment model while publishing its events in the:

```text
trade
```

event context.

At the same time, ADR-SHARED-018 now explicitly distinguishes:

```text
trade.shipment.*
```

from:

```text
logistics.*
```

physical-execution facts.

Therefore an unqualified platform-level `Shipment` would create ambiguous authority.

---

# 3. Namespaced Shipment Semantics

Baobab SHALL distinguish:

```text
TradeShipment
        │
        │ trade execution
        ▼
baobab-trade
```

from:

```text
LogisticsShipment
        │
        │ physical logistics execution
        ▼
baobab-tms
```

and from:

```text
CommerceFulfilment
        │
        │ customer commerce promise
        ▼
baobab-trade
```

These MAY be correlated.

They SHALL NOT be treated as the same aggregate.

---

# 4. Canonical Relationship

The relationship MAY be:

```text
Commerce Order
      │
      ▼
Commerce Fulfilment
      │
      ▼
Trade Shipment
      │
      ▼
Transport Requirement
      │
      ▼
LogisticsShipment
```

but this is not mandatory.

A LogisticsShipment MAY also originate directly from:

```text
warehouse transfer

procurement movement

customer logistics service order

project logistics instruction

internal repositioning

return logistics

customer relocation

asset movement

standalone transport request
```

without any `TradeShipment`.

---

# 5. Standards Alignment

The terminology SHALL align where useful with international transport semantics while retaining Baobab domain independence.

UN/CEFACT currently defines a **Shipment** as an identifiable collection of trade items transported together from seller/consignor to buyer/consignee, and explicitly links it to a Consignment through a `realisedBy` relationship.

UN/CEFACT defines a **Consignment** as a separately identifiable collection of consignment items moved from one consignor to one consignee under one transport contract.

This distinction strongly supports Baobab's separation between trade-side shipment semantics and transport-contract execution semantics.

---

# 6. Why TMS Still Needs `LogisticsShipment`

Although UN/CEFACT's `Shipment` is strongly trade-facing, a TMS requires an end-to-end aggregate representing:

> **The physical logistics service that must be executed for a defined body of cargo across one or more transport arrangements.**

That role SHALL be filled by:

```text
LogisticsShipment
```

rather than redefining `TradeShipment`.

This allows a TMS to support:

```text
B2B trade shipments

warehouse transfers

returns

internal logistics

3PL movements

project logistics

4PL-managed movements

non-commerce logistics
```

under one canonical execution model.

---

# 7. Governing Principle

> **`TradeShipment` describes trade execution. `LogisticsShipment` describes end-to-end logistics execution. `Consignment` describes goods moved under a transport arrangement. `TransportMovement` describes the physical journey that carries them.**

---

# 8. Fundamental Separations

The following SHALL remain non-negotiable:

```text
TradeShipment
    != LogisticsShipment

CommerceFulfilment
    != LogisticsShipment

LogisticsShipment
    != Consignment

Consignment
    != Booking

Consignment
    != TransportMovement

TransportMovement
    != TransportLeg

TransportLeg
    != TransportRoute

TransportRoute
    != TradeLane

TransportRoute
    != LogisticsCorridor

TransportCall
    != Location

TransportEvent
    != Status

CargoItem
    != Product

CargoItem
    != ConsignmentItem

TransportPackage
    != TransportEquipment

HandlingUnit
    != TransportMeans

TransportEquipment
    != TransportMeans

Delivery
    != Customer Acceptance

Transport Custody
    != Ownership

Customs Release
    != Transport Delivery
```

---

# 9. `LogisticsShipment` Definition

A `LogisticsShipment` SHALL represent:

> **A TMS-managed end-to-end logistics execution aggregate grouping cargo requirements that are to be physically moved from one or more defined collection contexts toward one or more defined delivery contexts under one coherent logistics execution responsibility.**

It answers:

```text
What physical logistics outcome must the TMS execute?
```

---

# 10. `LogisticsShipment` Is an Execution Aggregate

It SHALL NOT be treated as:

```text
a sales order

a purchase order

a commercial contract

a customer quote

a customs declaration

a transport document

an invoice

a vehicle trip
```

---

# 11. Conceptual `LogisticsShipment` Model

```text
LogisticsShipment
├── canonical_id
├── tenant_context
├── legal_entity_context
├── source_requirements[]
├── service_classification
├── cargo_items[]
├── packages[]
├── handling_units[]
├── origin_requirements[]
├── destination_requirements[]
├── requested_ready_window?
├── requested_delivery_window?
├── service_requirements[]
├── active_transport_plan_id?
├── transport_plan_versions[]
├── consignment_associations[]
├── lifecycle_state
├── condition_overlays[]
├── external_references[]
├── evidence_references[]
├── created_at
├── updated_at
└── aggregate_version
```

This model is conceptual.

It SHALL NOT prescribe persistence technology.

---

# 12. Tenant Context

Every LogisticsShipment SHALL belong to a determinable platform context including, as required:

```text
tenant

legal entity

Digital Estate / caller context

market context

correlation
```

according to Control Plane and Shared contracts.

---

# 13. LogisticsShipment Does Not Own Customer Master Data

A TMS shipment MAY reference:

```text
customer organisation

consignor

consignee

carrier

forwarder

warehouse operator
```

using canonical organisation/counterparty references.

It SHALL NOT maintain a competing universal organisation master.

---

# 14. Source Requirement

A LogisticsShipment SHALL retain the source or sources that caused it to exist.

Conceptually:

```text
SourceRequirement
├── source_context
├── source_entity_type
├── canonical_or_external_reference
├── relationship_type
└── effective_scope
```

Examples:

```text
TradeShipment

ServiceOrder

WarehouseTransfer

ReturnOrder

ProjectInstruction

ProcurementTransfer
```

---

# 15. Many Source Requirements May Feed One LogisticsShipment

Where operationally valid:

```text
Source Requirement A ─┐
Source Requirement B ─┼──► LogisticsShipment
Source Requirement C ─┘
```

This MAY occur in consolidation and 3PL/4PL operations.

Source lineage SHALL remain explicit.

---

# 16. One Source Requirement May Produce Several LogisticsShipments

Example:

```text
Trade Shipment
      │
      ├── LogisticsShipment A
      ├── LogisticsShipment B
      └── LogisticsShipment C
```

Reasons MAY include:

```text
split execution

separate destinations

capacity constraints

different service levels

different cargo compatibility

different regulatory treatment

different departure windows
```

---

# 17. CargoItem

TMS SHALL represent shipment-specific transported goods using:

```text
CargoItem
```

A CargoItem is a logistics execution projection/snapshot.

It is NOT the canonical product master.

---

# 18. CargoItem Model

Conceptually:

```text
CargoItem
├── id
├── logistics_shipment_id
├── source_item_reference?
├── description
├── quantity
├── unit_of_measure
├── gross_weight?
├── net_weight?
├── volume?
├── dimensions?
├── commodity/classification_refs[]
├── owner_reference?
├── lot_batch_serial_refs[]
├── package_refs[]
├── handling_requirements[]
├── condition_requirements[]
├── dangerous_goods_ref?
└── regulatory_refs[]
```

---

# 19. Product vs CargoItem

This SHALL remain:

```text
Product
    !=
CargoItem
```

A Product describes reusable commercial/master data.

A CargoItem describes goods in a particular logistics execution context.

---

# 20. Snapshot Principle

If a Product description changes after transport begins:

```text
Product Master
    changes
```

SHALL NOT rewrite:

```text
historical CargoItem snapshot
```

for the completed movement.

---

# 21. Cargo Quantity

Every cargo quantity SHALL carry an explicit:

```text
value
+
unit of measure
```

Unqualified:

```text
quantity = 10
```

SHALL NOT be considered sufficient canonical data.

---

# 22. Cargo Classification References

TMS MAY carry references to:

```text
HS classification

dangerous goods classification

commodity class

temperature class

security class
```

where necessary for execution.

TMS SHALL NOT become authoritative for classifications owned by other domains.

---

# 23. TransportPackage

A `TransportPackage` SHALL represent:

> A physical package or packaging unit containing goods for transport.

Examples MAY include:

```text
bag

box

drum

crate

sack

carton

palletised package
```

UN/CEFACT currently defines a TransportPackage as a self-contained wrapping or container holding goods for transport, including examples such as box, barrel and pallet.

---

# 24. Package Nesting

The model SHALL permit:

```text
Item
 ↓
Inner Package
 ↓
Carton
 ↓
Pallet
```

where operationally relevant.

---

# 25. HandlingUnit

A `HandlingUnit` SHALL represent:

> A physical aggregation handled operationally as one logistics unit.

Examples MAY include:

```text
pallet

cage

roll container

crate assembly

project-cargo unit
```

---

# 26. HandlingUnit Is an Operational Concept

A HandlingUnit exists because logistics operations:

```text
move

scan

store

load

transfer

count
```

it as a unit.

It SHALL NOT automatically imply a specific packaging standard.

---

# 27. Package vs HandlingUnit

A pallet MAY simultaneously act as:

```text
packaging
```

and:

```text
handling unit
```

depending on the operation.

The domain SHALL therefore favour explicit roles/relationships rather than a brittle universal inheritance hierarchy.

---

# 28. TransportEquipment

`TransportEquipment` SHALL remain distinct from Package and HandlingUnit.

UN/CEFACT currently defines TransportEquipment as equipment used to hold, protect or secure cargo, including container, ULD and trailer.

Examples:

```text
shipping container

trailer

tank container

ULD

swap body

special transport frame
```

---

# 29. TransportMeans

`TransportMeans` SHALL represent the device conveying the goods.

UN/CEFACT's current definition is simply:

> the device conveying goods.

Examples:

```text
truck tractor

rigid truck

vessel

aircraft

train

barge

van

motorcycle
```

Detailed resource modelling belongs to ADR-TMS-0005.

---

# 30. Cargo Containment Graph

The engine SHALL support relationships such as:

```text
CargoItem
    │
    ▼
TransportPackage
    │
    ▼
HandlingUnit
    │
    ▼
TransportEquipment
    │
    ▼
TransportMeans
```

without requiring every step to exist.

---

# 31. Example — Coffee

```text
Coffee beans
    │
    ▼
60 kg bags
    │
    ▼
Pallet
    │
    ▼
40-foot container
    │
    ▼
Vessel
```

The model SHALL preserve each identity only where operationally needed.

---

# 32. Example — Courier

A courier shipment may simply be:

```text
Document envelope
        │
        ▼
Courier bag
        │
        ▼
Van
```

The domain SHALL not require container-scale structures.

---

# 33. Consignment

A `Consignment` SHALL align closely with transport-contract semantics.

UN/CEFACT defines it as a separately identifiable collection of consignment items moved from one consignor to one consignee under one transport contract.

---

# 34. Consignment Answers a Different Question

`LogisticsShipment` asks:

> What end-to-end logistics execution are we responsible for?

`Consignment` asks:

> Under which specific carriage/transport arrangement are these goods being moved?

---

# 35. Conceptual Consignment Model

```text
Consignment
├── canonical_id
├── tenant_context
├── consignor_ref
├── consignee_ref
├── transport_service_buyer_ref?
├── carrier_or_provider_ref?
├── transport_contract_ref?
├── logistics_shipment_associations[]
├── consignment_items[]
├── package_refs[]
├── handling_unit_refs[]
├── required_transport_modes[]
├── service_requirements[]
├── booking_refs[]
├── transport_document_refs[]
├── lifecycle_state
├── condition_overlays[]
├── external_references[]
└── aggregate_version
```

---

# 36. Consignment Does Not Require External Carrier at Creation

A Consignment MAY initially exist before:

```text
carrier selected

booking confirmed

specific vehicle assigned
```

Those concerns belong to later planning/procurement stages.

---

# 37. ConsignmentItem

A `ConsignmentItem` SHALL be a transport-oriented grouping inside a Consignment.

It MAY associate:

```text
part of one CargoItem

one CargoItem

several compatible CargoItems
```

according to transport requirements.

---

# 38. CargoItem vs ConsignmentItem

This SHALL remain:

```text
CargoItem
    shipment execution view

ConsignmentItem
    carriage arrangement view
```

They SHALL be associated explicitly.

---

# 39. Many-to-Many Shipment–Consignment Relationship

The architecture SHALL NOT assume:

```text
1 LogisticsShipment
=
1 Consignment
```

It SHALL support:

```text
LogisticsShipment A
      │
      ├── Consignment 1
      └── Consignment 2
```

and:

```text
LogisticsShipment A ─┐
LogisticsShipment B ─┼──► Consignment X
LogisticsShipment C ─┘
```

---

# 40. Explicit Association Object

The relationship SHOULD be represented conceptually through:

```text
ShipmentConsignmentAssociation
├── logistics_shipment_id
├── consignment_id
├── association_type
├── cargo_scope[]
├── quantity_scope?
├── effective_from
└── effective_to?
```

rather than a single foreign key.

---

# 41. Association Type

Candidate semantic types MAY include:

```text
REALISES

PARTIALLY_REALISES

CONSOLIDATES

DECONSOLIDATES
```

Exact canonical vocabulary requires domain-contract review.

---

# 42. Consolidation

TMS SHALL support consolidation without losing customer/cargo lineage.

```text
Shipment A ─┐
Shipment B ─┼──► Consolidated Consignment
Shipment C ─┘
```

The Consignment SHALL retain associations to the precise cargo scope from each LogisticsShipment.

---

# 43. Deconsolidation

Likewise:

```text
Consolidated Consignment
          │
          ▼
    Deconsolidation
      ┌───┼───┐
      ▼   ▼   ▼
     A    B    C
```

SHALL preserve lineage.

---

# 44. Master and House Structures

Freight-forwarding implementations MAY require:

```text
master consignment

house consignment
```

or equivalent relationships.

TMS SHALL support hierarchical Consignment relationships.

Detailed freight-forwarding/carrier procurement semantics SHALL be defined in ADR-TMS-0004.

---

# 45. Booking

A `Booking` SHALL remain distinct from a Consignment.

UN/CEFACT currently defines Booking as a transaction recording reservation of transport services for a Consignment.

Therefore:

```text
Consignment
    != Booking
```

---

# 46. Consignment Can Survive Rebooking

Example:

```text
Consignment C1
      │
      ├── Booking B1 — rejected
      ├── Booking B2 — cancelled
      └── Booking B3 — confirmed
```

The Consignment identity remains stable.

---

# 47. TransportPlan Boundary

A LogisticsShipment SHALL have zero or more TransportPlan versions.

The detailed plan model belongs to ADR-TMS-0003.

This ADR establishes only that:

```text
LogisticsShipment
       │
       ▼
TransportPlan v1
       │
       ▼
TransportPlan v2
```

MUST preserve plan history.

---

# 48. Active Plan

A LogisticsShipment MAY designate one:

```text
active_transport_plan_id
```

for current execution.

Older plans SHALL remain historical records.

---

# 49. Plan Is Not Actual Execution

This SHALL remain:

```text
TransportPlan
    !=
TransportMovement
```

The first is intended execution.

The second is actual or scheduled physical carriage.

---

# 50. TransportRoute

UN/CEFACT currently defines TransportRoute as a planned itinerary and schedule over which transport movements are performed.

TMS SHALL maintain the same conceptual separation.

---

# 51. TransportMovement

A `TransportMovement` SHALL represent a physical trip, journey, voyage or flight.

UN/CEFACT defines TransportMovement as the physical carriage of goods for transport purposes—a voyage, flight, trip or journey.

---

# 52. Movement Is Shared Capacity

A TransportMovement MAY carry:

```text
Consignment A

Consignment B

Consignment C
```

simultaneously.

TMS SHALL NOT duplicate a vehicle/vessel journey once for every Consignment.

---

# 53. One Consignment Can Use Many Movements

Example:

```text
Consignment
    │
    ├── Road Movement
    ├── Sea Movement
    └── Road Movement
```

This is foundational to multimodal transport.

---

# 54. TransportCall

A TransportCall SHALL represent an ordered stop on a TransportMovement.

UN/CEFACT currently defines a TransportCall as an ordered stop of a transport means along a movement with sequence and location.

Examples:

```text
pickup facility

border facility

port

airport

rail terminal

cross-dock

warehouse

delivery location
```

---

# 55. TransportCall Is Not Location

This remains:

```text
Port of Durban
    = Location

Vessel call at Durban on voyage X
    = TransportCall
```

---

# 56. TransportLeg

A TransportLeg SHALL represent the consignment-relevant segment between consecutive calls.

UN/CEFACT currently defines a TransportLeg as the span between two consecutive transport calls and the segment to which a Consignment is assigned.

---

# 57. Leg vs Movement

This SHALL remain:

```text
TransportMovement
    physical journey

TransportLeg
    segment of that journey
    relevant to a Consignment
```

---

# 58. Movement Example

```text
Vessel Movement V1

Mombasa
   │
   ▼
Dar es Salaam
   │
   ▼
Maputo
   │
   ▼
Durban
```

Consignment A may occupy:

```text
Mombasa → Durban
```

while Consignment B occupies:

```text
Dar es Salaam → Maputo
```

The vessel movement remains one physical journey.

---

# 59. Assignment Model

The detailed relationship SHALL be defined in ADR-TMS-0003, but the canonical model SHALL support:

```text
Consignment
     │
     ▼
ConsignmentLegAssignment
     │
     ▼
TransportLeg
     │
     ▼
TransportMovement
```

---

# 60. Mode Semantics

A LogisticsShipment or Consignment MAY be classified:

```text
MULTIMODAL
```

when several modes are used.

However, every realised TransportMovement SHOULD identify its actual physical mode.

Examples:

```text
ROAD

SEA

AIR

RAIL

INLAND_WATERWAY

COURIER
```

---

# 61. `MULTIMODAL` Is Not a Vehicle Type

This remains:

```text
MULTIMODAL
    !=
TransportMeans
```

Multimodal describes composition across physical modes.

---

# 62. DCSA Interoperability

DCSA Track & Trace defines a shared event model across shipment, transport, equipment, IoT and reefer event types for container shipping.

TMS SHALL support DCSA adapters where maritime/container operations require them.

The DCSA model SHALL NOT become the universal Baobab TMS ontology.

---

# 63. DCSA Versioning

Current public DCSA documentation continues to expose Track & Trace 2.2 as the generally available implementation documentation, while DCSA announced Track & Trace 3.0.0 on 30 September 2026 with expanded IoT and reefer event coverage and staged availability.

Therefore adapters SHALL explicitly track standard versions.

---

# 64. Air-Cargo Interoperability

IATA ONE Record provides a common data model and secured API standard for air-cargo data sharing across stakeholders.

Its data model includes physical and logistics objects such as:

```text
Shipment

Piece

ULD

Transport Means

Transport Segment

Booking

Waybill
```

which SHALL inform air adapters rather than dictate the generic TMS model.

---

# 65. Anti-Corruption Layer

Every mode/provider integration SHALL conceptually follow:

```text
External Model
      │
      ▼
Adapter / Anti-Corruption Layer
      │
      ▼
Canonical TMS Model
```

---

# 66. External Provider Object Is Not Canonical Object

This SHALL remain:

```text
DCSA TransportDocument
    !=
TMS LogisticsShipment

IATA Shipment
    != automatically
TMS LogisticsShipment

Carrier Booking
    !=
Canonical TMS Booking identity
```

Mappings SHALL be explicit.

---

# 67. TransportEvent

A `TransportEvent` SHALL represent an observed, planned or estimated transport occurrence.

UN/CEFACT currently defines TransportEvent as a punctual transport occurrence associated with a call—such as arrival, departure, loading or discharge—and distinguishes planned, estimated and actual classifiers.

---

# 68. Event Is Not State

This SHALL remain:

```text
TransportEvent
    !=
LifecycleState
```

Events record facts or temporal expectations.

State is a derived projection.

---

# 69. Event Subject

Transport events MAY apply to:

```text
LogisticsShipment

Consignment

TransportMovement

TransportLeg

TransportCall

TransportEquipment

HandlingUnit

Delivery
```

where semantically appropriate.

---

# 70. Event Classifier

The canonical model SHALL distinguish at least:

```text
PLANNED

ESTIMATED

ACTUAL
```

where applicable.

---

# 71. Planned, Estimated and Actual Are Independent

Example:

```text
Planned arrival:
10:00

Estimated arrival:
12:15

Actual arrival:
12:37
```

All three facts MAY remain valuable.

The later ETA SHALL not overwrite the original plan.

---

# 72. Event Time vs Record Time

The model SHALL distinguish:

```text
occurred_at / expected_at
```

from:

```text
recorded_at / received_at
```

where an event may arrive late or offline.

---

# 73. Duplicate Events

Provider integrations SHALL assume:

```text
duplicates

late delivery

out-of-order delivery

corrections
```

can occur.

Event processing SHALL therefore support idempotency and temporal ordering semantics.

---

# 74. Event Correction

An incorrect event SHALL be corrected with explicit provenance.

It SHOULD NOT simply disappear from history.

---

# 75. Lifecycle State Is Projection

The canonical high-level lifecycle SHALL be a projection of:

```text
requirements

plans

bookings

execution

events

delivery
```

rather than the only evidence of what occurred.

---

# 76. LogisticsShipment Lifecycle

A minimum coarse lifecycle SHOULD support:

```text
DRAFT

PLANNING

PLANNED

READY_FOR_EXECUTION

IN_EXECUTION

DELIVERY_PENDING

DELIVERED

COMPLETED

CANCELLED
```

Detailed transition rules SHALL be defined in subsequent ADRs.

---

# 77. `IN_TRANSIT` Is Primarily a Read Projection

A customer-facing:

```text
IN_TRANSIT
```

status MAY be useful.

It SHALL NOT necessarily be the canonical aggregate lifecycle state because a multimodal LogisticsShipment may simultaneously contain:

```text
cargo in warehouse

cargo in movement

cargo awaiting transshipment

cargo under inspection
```

---

# 78. Conditions Are Overlays

States such as:

```text
CUSTOMS_HOLD

QUALITY_HOLD

DELAYED

DAMAGED

TEMPERATURE_EXCEPTION

DOCUMENT_BLOCK
```

SHALL generally be represented as conditions/exceptions rather than replacing the shipment lifecycle state.

---

# 79. Existing Shared Status Problem

The current Shared `shipment/v1` includes status concepts such as:

```text
CUSTOMS_HOLD

EXCEPTION
```

inside the Shipment lifecycle.

That SHALL NOT become the TMS canonical state model.

These concerns belong to orthogonal condition domains.

---

# 80. Example

A LogisticsShipment MAY be:

```text
Lifecycle:
IN_EXECUTION

Conditions:
CUSTOMS_HOLD
DELAYED
```

simultaneously.

That is more informative than:

```text
status = CUSTOMS_HOLD
```

alone.

---

# 81. Consignment Lifecycle

A coarse Consignment lifecycle MAY include:

```text
DRAFT

BOOKING_PENDING

BOOKED

ACCEPTED_FOR_CARRIAGE

IN_CARRIAGE

ARRIVED

DELIVERED

COMPLETED

CANCELLED
```

Mode/provider-specific states SHALL map into canonical semantics rather than polluting the core.

---

# 82. Booking Lifecycle Is Separate

The Consignment may be:

```text
BOOKING_PENDING
```

while individual bookings are:

```text
REQUESTED

REJECTED

CONFIRMED
```

in parallel.

The detailed booking lifecycle belongs to ADR-TMS-0004.

---

# 83. Delivery

TMS SHALL own the physical execution fact:

```text
Delivery
```

meaning the agreed physical handover operation occurred or was attempted.

---

# 84. Delivery Is Not Acceptance

This remains:

```text
DELIVERED
    !=
CUSTOMER_ACCEPTED
```

Acceptance may involve:

```text
quantity verification

quality verification

temperature review

commercial acceptance

document review
```

outside TMS.

---

# 85. Delivery Is Not Financial Closure

Likewise:

```text
DELIVERED
    !=
INVOICE PAID
```

---

# 86. Delivery Is Not POD Artifact

The actual delivery fact SHALL remain separate from:

```text
ProofOfDelivery document/evidence
```

Detailed POD/evidence boundaries belong to ADR-TMS-0008 and the Trade Docs model.

---

# 87. Custody

TMS SHALL record transport-execution custody where necessary.

It SHALL NOT infer ownership from custody.

This remains:

```text
Owner
    !=
Custodian
```

---

# 88. Custody Association

A transport custody record MAY identify:

```text
subject cargo / handling unit / equipment

custodian organisation

effective time

location

movement reference

handover evidence reference
```

Detailed canonical cross-domain custody contracts remain subject to Shared/BCP-013 alignment.

---

# 89. Custody Handover

A warehouse-to-carrier handover MAY conceptually be:

```text
Warehouse Custody
      │
      ▼
Handover
      │
      ▼
Transport Custody
```

TMS SHALL NOT rewrite warehouse history.

---

# 90. Ownership

TMS MAY reference:

```text
inventory_owner
```

where operationally needed.

It SHALL NOT become the legal/financial ownership authority.

---

# 91. In-Transit Inventory

TMS may expose:

```text
goods currently in transport execution
```

to other domains.

Financial inventory remains ERP authority.

Commercial stock availability remains the applicable commercial/inventory domain's authority.

---

# 92. Location

TMS SHALL reference canonical/geospatial locations without becoming the sole global location registry.

Locations MAY include:

```text
facility

warehouse

port

airport

rail terminal

border crossing

customer site

geographic coordinate

UN/LOCODE reference
```

---

# 93. TransportCall Identity

A TransportCall SHALL reference a location plus movement-specific context.

It SHALL NOT derive canonical identity merely from the location name.

---

# 94. Parties

The TMS model SHALL use role-specific relationships.

Examples:

```text
consignor

consignee

carrier

transport service buyer

forwarder

operator

warehouse operator
```

One canonical Organisation may fulfil several such roles.

---

# 95. Role Is Contextual

This SHALL remain:

```text
Organisation
    !=
Carrier
```

Carrier is a role the Organisation performs in context.

---

# 96. External References

Every major aggregate SHALL support external identifiers.

Examples:

```text
customer shipment reference

trade shipment ID

carrier booking number

bill-of-lading reference

air-waybill reference

provider consignment ID

tracking number

container number
```

No external provider identifier SHALL become the canonical TMS ID.

---

# 97. Canonical Identity

TMS SHALL assign durable canonical identity to its authoritative aggregates.

The identity SHALL survive:

```text
provider replacement

route replan

booking cancellation

external reference change

carrier change
```

where the aggregate itself remains the same.

---

# 98. Booking Reference Is Not Booking Identity

This SHALL remain:

```text
carrier booking number
    !=
canonical TMS Booking ID
```

---

# 99. Replanning Does Not Create a New LogisticsShipment

A route or transport-plan revision SHOULD normally preserve the LogisticsShipment identity.

Example:

```text
LogisticsShipment LS1

Plan v1
UG → KE → ZA

Plan v2
UG → TZ → ZA
```

The shipment remains LS1 unless the business requirement itself is split/replaced.

---

# 100. Shipment Split

When one LogisticsShipment must become two genuinely independent execution envelopes:

```text
LS1
  │
  ├── LS2
  └── LS3
```

the split SHALL preserve lineage.

---

# 101. Shipment Merge

Where independent logistics execution envelopes are genuinely merged:

```text
LS1 ─┐
LS2 ─┼──► LS4
LS3 ─┘
```

the relationship SHALL remain auditable.

This SHOULD be used cautiously; often consolidation is better represented at Consignment level.

---

# 102. Cancellation

Cancellation SHALL preserve history.

A cancelled LogisticsShipment SHALL not be physically deleted once material execution history exists.

---

# 103. Cancellation After Execution Begins

Once physical execution has begun, appropriate operations MAY instead include:

```text
hold

stop

return

reroute

terminate remaining plan
```

rather than pretending the shipment never existed.

---

# 104. Temporal History

Material temporal facts SHALL preserve:

```text
effective time

recorded time

supersession

version
```

where later reconstruction is required.

---

# 105. Aggregate Version

Major TMS aggregates SHOULD carry an application-level version suitable for:

```text
optimistic concurrency

change detection

event production
```

without exposing database implementation details.

---

# 106. Concurrency

The engine SHALL guard against conflicting changes such as:

```text
Dispatcher A replans shipment

Dispatcher B cancels shipment

at the same time
```

using appropriate concurrency semantics.

---

# 107. Idempotent Commands

Create and mutation commands exposed to external consumers SHOULD support idempotency where retries could create duplicates.

Examples:

```text
CreateLogisticsShipment

CreateConsignment

RequestBooking

RecordTransportEvent
```

---

# 108. Command vs Event

This SHALL remain:

```text
Command:
RecordDeparture

Event:
MovementDeparted
```

Commands request.

Events assert committed/observed domain facts.

---

# 109. TMS Commands

Candidate domain commands MAY include:

```text
CreateLogisticsShipment

AddCargo

CreateConsignment

AssociateShipmentToConsignment

CreateTransportPlan

ActivateTransportPlan

RequestBooking

AssignConsignmentToLeg

RecordTransportEvent

RecordDelivery

CancelLogisticsShipment
```

Exact APIs SHALL be decided later.

---

# 110. TMS Query Model

Read models MAY expose:

```text
CurrentLogisticsShipment

TrackingTimeline

ConsignmentExecution

CurrentRoute

CurrentMovement

CurrentETA

OpenConditions

DeliveryStatus
```

without becoming separate systems of record.

---

# 111. Event Context

New canonical physical transport events SHALL use:

```text
logistics
```

event context.

Candidate types MAY eventually resemble:

```text
com.baobab-platform.logistics.shipment.created.v1

com.baobab-platform.logistics.shipment.plan-activated.v1

com.baobab-platform.logistics.consignment.created.v1

com.baobab-platform.logistics.movement.departed.v1

com.baobab-platform.logistics.movement.arrived.v1

com.baobab-platform.logistics.delivery.completed.v1
```

These names are **proposals only** until registered through Shared.

---

# 112. Do Not Repurpose Existing ACTIVE Events

The following currently ACTIVE event types:

```text
com.baobab-platform.trade.shipment.created.v1

com.baobab-platform.trade.shipment.status-changed.v1

com.baobab-platform.trade.shipment.delivered.v1
```

SHALL NOT simply have their producer changed from Trade to TMS.

They are already canonical Trade events.

---

# 113. Consumer-First Migration

If existing consumers need physical-logistics events instead:

```text
1. define logistics event contract

2. update consumers to understand it

3. enable TMS producer

4. migrate producers/workflows

5. deprecate obsolete Trade semantics only where justified
```

Historical events SHALL remain valid historical records.

---

# 114. Shared Contract Strategy

The existing:

```text
contracts/shipment/v1
```

SHALL NOT be modified in-place to mean `LogisticsShipment`.

Doing so would silently change the meaning of ACTIVE Trade events.

---

# 115. Preferred Shared Migration

The preferred direction is a new explicitly logistics-scoped contract package, conceptually:

```text
contracts/logistics-shipment/v1
```

or:

```text
contracts/transport/v1
```

with final naming decided by Shared architecture review.

---

# 116. New Contract Must Not Mirror TMS Internals Blindly

Only cross-engine stable concepts SHOULD be promoted.

TMS-internal implementation details SHALL remain private.

---

# 117. Candidate Shared Surfaces

Likely cross-engine surfaces include:

```text
LogisticsShipmentReference

ConsignmentReference

TransportMovementReference

TransportEventReference

DeliveryReference

CargoSummary

TransportMode

ExternalReference
```

rather than the entire internal aggregate graph.

---

# 118. Shared Context Stewardship

The current Shared `logistics` event context lists `baobab-erp` as a steward based on historical physical-execution authority.

Acceptance of TMS-0001/0002 SHOULD trigger a separate Shared review to add or transition TMS stewardship for TMS-owned event types.

This ADR SHALL NOT silently mutate the registry.

---

# 119. Multiple Logistics Producers Are Possible

The `logistics` context MAY legitimately contain event types produced by:

```text
TMS

WMS/provider

ERP where it owns a genuine physical-execution fact

other certified logistics providers
```

but each canonical event type SHALL retain one authorised producer according to Shared governance.

---

# 120. Customs Boundary

The LogisticsShipment lifecycle SHALL NOT contain authoritative:

```text
CUSTOMS_RELEASED

CUSTOMS_HOLD

DECLARATION_ACCEPTED
```

states.

Those belong to Trade Docs/external Customs authority projection.

---

# 121. TMS Customs Condition

TMS MAY maintain an operational condition such as:

```text
CUSTOMS_BLOCK
```

or equivalent referencing an authoritative Customs decision.

It SHALL not claim ownership of the underlying Customs fact.

---

# 122. Regulatory Boundary

Likewise TMS MAY maintain:

```text
REGULATORY_BLOCK
```

as an execution condition referencing a Baobab Regulations decision.

It SHALL not duplicate regulatory reasoning.

---

# 123. Document Boundary

TMS aggregates MAY reference:

```text
transport document

POD

Customs document

certificate
```

by canonical TradeDocument/evidence reference.

TMS SHALL not own their general document lifecycle.

---

# 124. Financial Boundary

TMS MAY calculate:

```text
expected operational transport cost
```

in later ADRs.

It SHALL NOT own:

```text
customer invoice

provider AP invoice

GL entry

financial actual cost
```

---

# 125. Commerce Boundary

A TradeShipment may be associated with one or more LogisticsShipments.

TMS SHALL never mutate Trade's order/trade state directly.

---

# 126. Warehouse Boundary

Warehouse execution MAY create:

```text
HandlingUnit

custody handover

cargo-ready condition
```

that TMS consumes.

TMS SHALL not own detailed:

```text
bin

pick

putaway

cycle count
```

execution.

---

# 127. Thamani Boundary

Thamani MAY create a LogisticsShipment through an entitled capability.

Thamani SHALL not duplicate it as an independently authoritative shipment aggregate.

---

# 128. ZuriBeans Boundary

ZuriBeans MAY originate transport through:

```text
TradeShipment
      │
      ▼
LogisticsShipment
```

without making ZuriBeans a transport engine.

---

# 129. 4PL Compatibility

A LogisticsShipment SHALL support:

```text
all movements internal

all movements external

mixed execution
```

without changing canonical identity.

---

# 130. Asset-Light Compatibility

A LogisticsShipment SHALL NOT require:

```text
Thamani-owned vehicle

Baobab-owned asset

internal carrier
```

It may be executed wholly through external providers.

---

# 131. Internal Logistics Compatibility

Likewise TMS SHALL support non-customer transport such as:

```text
empty container repositioning

asset relocation

warehouse transfer

fleet support movement
```

where the movement requires canonical logistics execution.

---

# 132. Cargo-less Movement

Not every TransportMovement requires customer cargo.

Example:

```text
empty truck repositioning
```

Therefore:

```text
TransportMovement
```

SHALL not require:

```text
Consignment
```

universally.

A Movement may exist for repositioning or operational reasons.

---

# 133. Consignment Requires Transported Goods

A Consignment, by contrast, represents goods under a carriage arrangement.

A cargo-less resource repositioning SHOULD normally not create a fake Consignment.

---

# 134. Measurement Precision

Weights, dimensions and quantities SHALL use decimal-safe measurement representations appropriate to their unit systems.

TMS SHALL avoid unqualified binary floating-point use for authoritative commercial or regulatory measurements where precision matters.

---

# 135. Units

Units SHOULD reference governed code systems or Shared canonical units.

External provider units SHALL be mapped explicitly.

---

# 136. Time Zones

Transport timestamps SHALL preserve:

```text
instant

source/local zone where relevant

location context
```

The system SHALL not treat a local time without zone/context as universally comparable.

---

# 137. Planned Windows

Pickup/delivery requirements SHOULD support windows rather than forcing a single timestamp.

Conceptually:

```text
earliest

latest
```

or equivalent.

---

# 138. Actual Time Is Event-Derived

A mutable:

```text
actual_departure
```

projection MAY exist.

Its source SHOULD be reconstructable from the corresponding TransportEvent.

---

# 139. Status Derivation

A status projection SHALL be deterministic enough that the platform can answer:

```text
Why is this shipment IN_EXECUTION?
```

using underlying facts.

---

# 140. No Opaque Status Machine

This SHALL be avoided:

```text
status = 73
```

with undocumented provider-specific meanings.

External statuses SHALL map through adapters.

---

# 141. Conditions

A condition SHOULD include:

```text
type

scope

source

opened_at

resolved_at?

severity?

authoritative_reference?

description?
```

where applicable.

---

# 142. Condition Scope

A condition MAY apply to:

```text
LogisticsShipment

Consignment

Movement

Leg

CargoItem

Equipment
```

rather than blocking unrelated execution automatically.

---

# 143. Exceptions

Detailed transport exception management belongs to ADR-TMS-0008.

This ADR establishes only:

```text
Exception
    !=
Lifecycle State
```

as a foundational rule.

---

# 144. Domain History

TMS SHALL eventually be able to reconstruct:

```text
What requirement created the shipment?

Which cargo was included?

Which consignments realised it?

Which plan versions existed?

Which route was selected?

Which movements carried each consignment?

Which calls and legs were involved?

Which events actually occurred?

Which provider supplied each observation?

Which conditions blocked execution?

When was physical delivery completed?
```

---

# 145. No Mega Aggregate

TMS SHALL NOT implement:

```text
LogisticsShipment {
    all routes
    all movements
    all bookings
    all resources
    all telemetry
    all documents
    all customs
    all invoices
}
```

as one transactionally locked persistence aggregate.

The domain model defines relationships.

Persistence/aggregate transaction boundaries belong to ADR-TMS-0012.

---

# 146. Logical Domain ≠ Transaction Boundary

Conceptual relationships SHALL NOT imply all objects must:

```text
load together

lock together

persist together

version together
```

---

# 147. Aggregate Candidate Boundaries

Likely independent consistency boundaries include:

```text
LogisticsShipment

Consignment

TransportPlan

TransportMovement

Booking

TransportResource
```

but ADR-TMS-0012 SHALL make the final persistence decision.

---

# 148. Referential Integrity Across Aggregates

Cross-aggregate relationships SHOULD use stable canonical IDs and domain validation rather than database foreign-key assumptions across engines.

---

# 149. Security

TMS SHALL ensure access is scoped by:

```text
tenant

legal entity

business relationship

actor authority

provider assignment

shipment relationship
```

as applicable.

---

# 150. Provider Visibility

External Carrier A SHALL NOT automatically see:

```text
Carrier B booking

customer margin

unrelated cargo

other tenant movements
```

merely because both participate in one logistics operation.

---

# 151. Customer Visibility

Customer visibility SHALL be a policy-controlled projection.

Raw operational facts may contain:

```text
internal provider details

security-sensitive locations

driver details

commercially sensitive information
```

that are not customer-visible.

---

# 152. Data Classification

Cargo and route information MAY be commercially or security sensitive.

TMS SHALL integrate with Baobab data-classification/security policy.

---

# 153. Domain Service Requirements

A LogisticsShipment MAY carry service requirements such as:

```text
delivery service level

temperature requirements

dangerous-goods requirements

security requirements

equipment requirements

handling constraints

customer timing requirements
```

Detailed policies belong to specialised ADRs/domains.

---

# 154. Requirement Is Not Capability Proof

This SHALL remain:

```text
shipment requires refrigeration
    !=
assigned carrier is qualified for refrigeration
```

Qualification is evaluated separately.

---

# 155. Domain Validation

The engine SHALL reject structurally impossible relationships.

Examples:

```text
Leg references unknown Movement

Consignment allocation exceeds associated cargo

TransportCall sequence is invalid

actual event references wrong tenant

delivery references unrelated shipment
```

---

# 156. Domain Validation vs Regulation

TMS domain validation answers:

```text
Is this transport model internally coherent?
```

Regulations answers:

```text
Is this operation legally/regulatorily permitted?
```

These SHALL not be confused.

---

# 157. Migration From THA-0005

ADR-THA-0005 SHALL become:

```text
Superseded in Part by ADR-TMS-0002
```

for reusable transport-domain semantics.

It remains historical evidence of the architectural evolution that led to TMS.

---

# 158. THA-0005 Semantics Retained

The following THA-0005 decisions are explicitly preserved:

```text
Shipment != Consignment

Consignment != Booking

Plan != Execution

Route != Movement

Movement != Leg

Transport Means != Equipment

planned != estimated != actual

event != status

delivery != acceptance

custody != ownership

external reference != canonical identity
```

---

# 159. THA-0005 Semantics Refined

The following are refined:

```text
THA-0005 "Shipment"
        ↓
TMS "LogisticsShipment"

THA-0005 TMS-like authority
        ↓
Baobab TMS authority

THA-0005 customs-hold lifecycle concepts
        ↓
orthogonal condition referencing Trade Docs

THA-0005 exception-as-status possibilities
        ↓
condition/exception overlay
```

---

# 160. Shared Migration Required

Following acceptance of this ADR, Shared SHOULD undergo a dedicated reconciliation covering:

```text
contracts/shipment/v1

trade.shipment event semantics

new LogisticsShipment reference contract

logistics event types

TMS producer authority

logistics context stewardship

consumer migration
```

---

# 161. No Immediate Breaking Change

Acceptance of this ADR SHALL NOT itself:

```text
delete shipment/v1

rename Trade events

change Trade producer authority

modify existing event history
```

Those require separately governed changes.

---

# 162. Implementation Gates

Implementation SHOULD proceed as follows.

## TMS-DOM-00 — Contract Audit

Audit:

```text
Shared shipment/v1

TradeShipment

Trade fulfilment

ERP shipment representations

BCP-013 custody

Thamani THA-0005

external standards
```

Classify:

```text
REUSE

MAP

SUPERSEDE

DEPRECATE

REPLACE
```

---

## TMS-DOM-01 — Canonical Terminology

Publish definitive engine vocabulary for:

```text
LogisticsShipment

CargoItem

TransportPackage

HandlingUnit

Consignment

ConsignmentItem

TransportPlan

TransportRoute

TransportMovement

TransportLeg

TransportCall

TransportEvent
```

---

## TMS-DOM-02 — Identity Model

Implement:

```text
canonical IDs

external references

source associations

tenant context
```

without provider-ID coupling.

---

## TMS-DOM-03 — Cargo Model

Implement:

```text
CargoItem

Package

HandlingUnit

measurements

source snapshots
```

---

## TMS-DOM-04 — Shipment / Consignment Model

Implement explicit many-to-many shipment/consignment associations.

---

## TMS-DOM-05 — Lifecycle Projection

Implement:

```text
coarse lifecycle

condition overlays

status derivation
```

without customs or exception states replacing core lifecycle.

---

## TMS-DOM-06 — Planning Seam

Introduce TransportPlan references/versioning sufficient for ADR-TMS-0003.

---

## TMS-DOM-07 — Movement Seam

Introduce Movement/Leg/Call references sufficient for ADR-TMS-0003.

---

## TMS-DOM-08 — Event Spine

Implement:

```text
planned

estimated

actual

occurred/recorded time

source provenance

idempotency
```

---

## TMS-DOM-09 — Delivery Seam

Implement physical delivery semantics without yet absorbing document/POD architecture.

---

## TMS-DOM-10 — Shared Contract Proposal

Propose provider-neutral LogisticsShipment and reference contracts in Shared.

---

## TMS-DOM-11 — Event Migration Proposal

Propose:

```text
logistics.*
```

TMS event types without modifying existing Trade events in place.

---

## TMS-DOM-12 — Trade Interoperability

Prove:

```text
TradeShipment
      ↕
LogisticsShipment
```

with explicit mapping and no duplicate authority.

---

## TMS-DOM-13 — Standalone Logistics

Prove LogisticsShipment creation without Baobab Trade.

---

## TMS-DOM-14 — Consolidation

Prove:

```text
many LogisticsShipments
       ↓
one Consignment
```

and the reverse split scenario with cargo lineage intact.

---

## TMS-DOM-15 — Multimodal Reference Flow

Prove one Consignment across:

```text
Road
→ Sea
→ Road
```

with distinct Movements/Legs.

---

## TMS-DOM-16 — Production Hardening

Verify:

```text
tenant isolation

canonical identity

optimistic concurrency

idempotency

late/out-of-order events

history reconstruction

projection rebuild

external-reference changes

split/merge lineage

security

audit

backup/recovery
```

---

# 163. Rejected Alternatives

## Alternative A — Reuse `TradeShipment` as the TMS Shipment

**Rejected.**

Trade execution and physical logistics execution have different authorities.

---

## Alternative B — Rename the Existing Shared Shipment Contract in Place

**Rejected.**

ACTIVE Trade event contracts already depend upon its semantics.

---

## Alternative C — Make Consignment the Only TMS Root

**Rejected.**

TMS requires an end-to-end logistics execution envelope that can span several transport arrangements.

---

## Alternative D — One Consignment Per LogisticsShipment

**Rejected.**

Multimodal execution, split carriage and consolidation require many-to-many relationships.

---

## Alternative E — Booking as Consignment

**Rejected.**

A Consignment may survive several booking attempts.

---

## Alternative F — Movement as Shipment

**Rejected.**

One Movement may carry many Consignments, and one Consignment may traverse many Movements.

---

## Alternative G — Customs Hold as Shipment Lifecycle State

**Rejected.**

Customs is an orthogonal external authority condition.

---

## Alternative H — Exception as Shipment Lifecycle State

**Rejected.**

A shipment may continue its lifecycle while exceptions remain open.

---

## Alternative I — Provider IDs as Canonical Identity

**Rejected.**

Providers can change.

---

## Alternative J — DCSA as Universal TMS Model

**Rejected.**

DCSA is specialised for container shipping interoperability.

---

## Alternative K — IATA ONE Record as Universal TMS Model

**Rejected.**

ONE Record is specialised for air-cargo data sharing.

---

## Alternative L — One Giant Shipment Aggregate

**Rejected.**

It creates excessive coupling and untenable consistency boundaries.

---

# 164. Architectural Invariants

The following SHALL remain non-negotiable:

```text
TradeShipment
    != LogisticsShipment

CommerceFulfilment
    != LogisticsShipment

LogisticsShipment
    != Consignment

Consignment
    != Booking

Consignment
    != Movement

Movement
    != Leg

Movement
    != Route

Route
    != Corridor

Corridor
    != TradeLane

Call
    != Location

Product
    != CargoItem

CargoItem
    != ConsignmentItem

Package
    != TransportEquipment

HandlingUnit
    != TransportMeans

TransportEquipment
    != TransportMeans

Plan
    != Execution

Planned
    != Estimated

Estimated
    != Actual

Event
    != State

Condition
    != Lifecycle State

Exception
    != Lifecycle State

Customs Hold
    != TMS lifecycle state

Customs Release
    != Delivery

Delivery
    != Customer Acceptance

Delivery
    != POD document

Custody
    != Ownership

Physical location
    != Ownership

External ID
    != Canonical ID

Carrier booking reference
    != TMS Booking identity

Provider model
    != Canonical TMS model

Trade event
    != Logistics event

Historical Trade events
    must not be rewritten

Plan revision
    must not destroy previous plans

Provider replacement
    must not change canonical shipment identity unnecessarily

Cargo lineage
    must survive consolidation and deconsolidation

Source requirement lineage
    must remain reconstructable
```

---

# 165. Canonical Domain Diagram

```text
                           SOURCE DOMAIN
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
      TradeShipment      ServiceOrder      WarehouseTransfer
           │                  │                  │
           └──────────────────┼──────────────────┘
                              ▼
                    TRANSPORT REQUIREMENT
                              │
                              ▼
                    LOGISTICS SHIPMENT
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
          CargoItems       Packages      HandlingUnits
              │                               │
              └───────────────┬───────────────┘
                              ▼
                      CONSIGNMENT(S)
                              │
                  explicit many-to-many
                    shipment allocation
                              │
                              ▼
                       TRANSPORT PLAN
                              │
                              ▼
                      TRANSPORT ROUTE
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
             Movement 1   Movement 2   Movement 3
                 │            │            │
                 ▼            ▼            ▼
               Calls        Calls        Calls
                 │            │            │
                 └────────────┼────────────┘
                              ▼
                         LEGS / ASSIGNMENTS
                              │
                              ▼
                      TRANSPORT EVENTS
                              │
                  planned / estimated / actual
                              │
                              ▼
                    EXECUTION PROJECTIONS
                     ┌────────┼─────────┐
                     ▼        ▼         ▼
                  Status   Conditions  Tracking
                              │
                              ▼
                          DELIVERY
```

---

# 166. Final Decision

Baobab TMS SHALL establish **`LogisticsShipment`** as the canonical end-to-end physical logistics execution aggregate.

It SHALL preserve a strict distinction between:

```text
TradeShipment
    trade execution

LogisticsShipment
    end-to-end physical logistics execution

Consignment
    goods under a carriage arrangement

Booking
    reserved transport service

TransportPlan
    intended execution

TransportRoute
    planned itinerary

TransportMovement
    physical journey

TransportLeg
    consignment-relevant segment

TransportCall
    ordered stop

TransportEvent
    observed/planned/estimated occurrence
```

The engine SHALL support:

```text
single-mode

multimodal

consolidated

deconsolidated

asset-light

owned-fleet

third-party carrier

3PL

4PL

cross-border

internal logistics
```

without changing these canonical semantics.

The defining shipment principle is:

> **A LogisticsShipment represents the end-to-end logistics execution responsibility, not a commercial transaction, transport contract, booking or vehicle trip.**

The defining consignment principle is:

> **A Consignment represents goods moved under a transport arrangement and may realise all or part of one or many LogisticsShipments.**

The defining execution principle is:

> **Plans, routes, movements, legs, calls, events and delivery are separate facts whose relationships must remain historically reconstructable.**

The defining event principle is:

> **Physical logistics facts shall live under the `logistics` bounded context and shall not be disguised as `trade.shipment` events.**

The defining migration principle is:

> **The existing Shared `shipment/v1` and ACTIVE `trade.shipment.*` events shall be preserved and reconciled through a consumer-first migration rather than silently reinterpreted as TMS contracts.**

And the defining platform principle is:

> **Baobab TMS shall provide a stable canonical physical-logistics model while adapting maritime, air, road, rail and provider-specific standards at its boundaries rather than allowing any one external standard or Digital Estate to define its core.**