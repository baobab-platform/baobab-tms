# ADR-TMS-0001 — Baobab TMS Mission, Authority, Transport Execution Boundary and Platform Capability Role

**Status:** Accepted — Foundational Engine Charter  
**Date:** 2026-10-03  
**Repository:** `baobab-platform/baobab-tms`  
**Engine:** Baobab TMS  
**Engine Role:** Headless Transportation Management and Logistics Execution Capability Provider  
**Platform Contract Authority:** `baobab-platform/shared`  
**Capability Resolution Authority:** `baobab-platform/baobab-cp`  
**Identity Authority:** `baobab-platform/baobab-iam`  
**Financial Authority:** `baobab-platform/baobab-erp`  
**Regulatory Decision Authority:** `baobab-platform/baobab-regulations`  
**Trade-Document / Customs Workflow Authority:** `baobab-platform/baobab-trade-docs`  
**Initial Strategic Consumer:** `baobab-platform/thamani`  
**Decision Class:** Engine mission / bounded context / system of record / capability provider / transport-management architecture

---

# 1. Decision

Baobab TMS SHALL be the Baobab Platform's reusable, headless **Transportation Management System and physical logistics execution engine**.

Its mission is to provide provider-neutral capabilities for:

```text
transport requirement execution
shipment execution
consignment execution
transport planning
routing
corridor execution
carrier booking
capacity management
resource assignment
dispatch
movement execution
tracking
milestones
delivery execution
transport exceptions
```

across:

```text
ROAD

MARITIME

AIR

RAIL

INLAND WATERWAY

COURIER

LAST MILE

MULTIMODAL
```

Baobab TMS SHALL be reusable by any entitled Baobab tenant.

It SHALL NOT be Thamani-specific.

---

# 2. Architectural Purpose

The engine SHALL answer questions such as:

```text
What cargo movement must be executed?

What is the transport plan?

Which route will be used?

Which transport movements and legs are required?

Which carrier or internal operator will execute them?

Which capacity has been reserved?

Which vehicle, vessel, aircraft, equipment or other
transport resource has been assigned?

What is planned?

What is estimated?

What actually happened?

Where is the cargo?

Which movement currently has custody?

Which operational milestones have occurred?

Which transport exceptions remain open?
```

It SHALL NOT answer unrelated authoritative questions such as:

```text
What is the customer's final sell price?

Is this commodity legally importable?

Which customs document is required?

Has Customs legally released the cargo?

Has the invoice been posted?

Who authenticated the user?
```

---

# 3. Why Baobab TMS Exists

Transport-management semantics were initially developed in:

```text
ADR-THA-0005
ADR-THA-0007
```

because Thamani required them before a dedicated logistics engine existed.

Those semantics include broadly reusable objects such as:

```text
Shipment
Consignment
TransportPlan
TransportRoute
TransportMovement
TransportLeg
TransportCall
TransportBooking
TransportResource
CapacityReservation
ResourceAssignment
TransportEvent
```

They do not naturally belong to one Digital Estate.

Baobab TMS therefore becomes their target reusable engine boundary.

---

# 4. Standards Basis

The engine SHALL favour internationally interoperable transport semantics rather than inventing a Thamani-specific transport vocabulary.

UN/CEFACT's Multi-Modal Transport Reference Data Model provides a generic model for transport and related processes across cross-border supply chains.

The wider UN/CEFACT RDM approach deliberately separates interoperable business semantics from implementation-specific exchange formats, which aligns directly with Baobab's principle of standardising contracts rather than implementations.

For container shipping, DCSA defines interoperable shipment, transport, equipment, IoT and reefer event structures as well as standardised booking exchanges. These SHALL inform maritime adapters without becoming Baobab's universal internal transport schema.

---

# 5. Core Architectural Principle

> **Baobab TMS owns physical transport execution, not the entire logistics business.**

The engine SHALL be deep in transportation management.

It SHALL NOT become a monolithic supply-chain suite containing:

```text
commerce
customs law
document management
ERP
WMS
IAM
customer CRM
regulatory intelligence
```

merely because those capabilities interact with transportation.

---

# 6. Headless Engine

Baobab TMS SHALL be headless.

It SHALL expose governed:

```text
APIs

commands

queries

events

capabilities
```

rather than owning a required customer-facing UI.

Digital Estates such as Thamani MAY build:

```text
customer tracking

dispatcher workspace

control tower

carrier portal

operations dashboard
```

on top of TMS capabilities.

---

# 7. Capability Provider

TMS SHALL implement canonical Baobab capabilities under the registered:

```text
logistics
```

capability namespace.

Exact capability keys SHALL be approved through Shared governance.

Candidate capability families MAY eventually include concepts equivalent to:

```text
logistics.shipment.manage

logistics.consignment.manage

logistics.transport-plan.manage

logistics.route.plan

logistics.booking.manage

logistics.capacity.manage

logistics.resource.manage

logistics.movement.manage

logistics.tracking.query

logistics.delivery.manage
```

These are architectural candidates, not automatically registered keys.

---

# 8. Engine Name Is Not Capability Name

This SHALL remain prohibited:

```text
tms.shipment.manage
```

as a canonical capability key.

Correct architecture:

```text
logistics.shipment.manage
        │
        ▼
Capability Provider
        │
        ▼
baobab-tms
```

---

# 9. Provider Neutrality

Baobab TMS is intended to be Baobab's first-party provider of transport-management capabilities.

It SHALL NOT make:

```text
baobab-tms
```

synonymous with:

```text
logistics
```

The Control Plane SHALL retain provider resolution.

---

# 10. Initial Consumers

Potential consumers include:

```text
Thamani

ZuriBeans

future manufacturers

future distributors

external 3PLs

external 4PLs

cross-border transport operators

other future Baobab tenants
```

No tenant-specific logic SHALL appear in the canonical TMS domain.

---

# 11. TMS Is Not a Digital Estate

This remains:

```text
Baobab TMS
    !=
Thamani
```

and:

```text
Baobab TMS
    !=
Customer Portal
```

TMS owns execution semantics.

Digital Estates own experiences.

---

# 12. Target Authoritative Aggregates

Subject to detailed follow-up ADRs, TMS is expected to become authoritative for reusable operational concepts including:

```text
Shipment execution

Consignment

ConsignmentItem

TransportPlan

TransportRoute

LogisticsCorridor operational projection

TransportMovement

TransportLeg

TransportCall

TransportBooking

TransportMilestone

TransportEvent

Delivery execution

CapacityRequirement

CapacityReservation

TransportResource operational projection

TransportMeans

TransportEquipment

ResourceAssignment
```

---

# 13. Shipment Boundary

TMS SHALL own the transport/logistics execution interpretation of Shipment.

It SHALL NOT automatically own:

```text
commerce order

sales order

purchase order

trade transaction

customer service order
```

These objects may create transport requirements.

---

# 14. Shipment and Consignment

The distinction developed in THA-0005 SHALL be preserved and refined.

Conceptually:

```text
Shipment
    trade/delivery movement requirement

Consignment
    transport-service / carriage grouping
```

They SHALL NOT be collapsed merely for implementation convenience.

---

# 15. Transport Plan

TMS SHALL own the operational Transport Plan.

A plan SHALL describe intended transport execution.

It SHALL support versioning and SHALL preserve:

```text
original plan

revised plans

actual execution
```

as distinct facts.

---

# 16. Route

TMS SHALL own operational transport routing.

It SHALL distinguish:

```text
Trade Lane
    Control Plane / market relationship

Logistics Corridor
    reusable transport pathway

Transport Route
    execution-specific planned itinerary

Transport Movement
    physical trip / voyage / flight
```

---

# 17. Route Does Not Own Regulation

TMS MAY know that a route traverses:

```text
Uganda
Kenya
South Africa
```

but it SHALL NOT independently determine the legal consequences.

Route context SHALL be submitted to Baobab Regulations where regulatory evaluation is required.

---

# 18. Movement

TMS SHALL own physical Transport Movement state.

Examples:

```text
truck trip

vessel voyage

flight

rail movement

barge movement
```

---

# 19. Movement Is Not Customs Clearance

This SHALL remain:

```text
Movement departed
    !=
Customs release granted
```

TMS consumes Customs facts where they affect operational eligibility.

---

# 20. Booking

TMS SHALL own operational transport booking orchestration.

A TMS booking MAY correspond to:

```text
road-carrier booking

shipping booking

air booking

rail capacity booking

partner capacity commitment
```

External provider booking identifiers SHALL remain ExternalReferences.

---

# 21. Booking Interoperability

Maritime adapters SHOULD support DCSA-aligned booking semantics where relevant.

DCSA's Booking standard standardises digitised booking requests and status exchanges across ocean carriers and logistics partners.

The Baobab domain SHALL remain broader than the DCSA maritime model.

---

# 22. Tracking and Events

TMS SHALL own physical logistics event semantics.

Examples include:

```text
picked up

loaded

departed

arrived

gate in

gate out

discharged

delivery attempted

delivered
```

---

# 23. Canonical Event Context

The target event context for physical transport execution SHALL be:

```text
logistics.*
```

consistent with ADR-SHARED-018.

---

# 24. Existing Shared Conflict

Shared currently contains a legacy:

```text
contracts/shipment/v1
```

whose events are registered as:

```text
com.baobab-platform.trade.shipment.*
```

and produced by `baobab-trade`.

This predates the explicit ADR-SHARED-018 distinction between:

```text
trade.shipment.*
```

and:

```text
logistics.*
```

Therefore this ADR DOES NOT silently transfer existing event producer authority.

A dedicated Shared reconciliation SHALL determine which existing Shipment semantics represent:

```text
trade execution
```

and which represent:

```text
physical logistics execution
```

---

# 25. Future Event Producer Authority

Once appropriate Shared contracts are accepted and TMS production capability is certified:

```text
physical execution events
```

SHOULD have TMS or another bound logistics provider as their authorised producer.

Trade SHALL continue producing only genuine:

```text
trade.*
```

facts.

---

# 26. Transport Events Are Facts

TMS events SHALL represent things that happened.

Examples:

```text
movement.departed

booking.confirmed

delivery.completed
```

They SHALL NOT be hidden commands such as:

```text
erp-update-requested
```

---

# 27. Event Provenance

Operational facts SHALL preserve, as appropriate:

```text
event time

record time

source system

source party

provider event ID

correlation

causation

location

evidence reference
```

---

# 28. Multimodal Adapters

TMS SHOULD support adapters for relevant industry standards.

Potential families include:

```text
DCSA
    container shipping

IATA ONE Record
    air cargo

GS1 EPCIS
    supply-chain event visibility

UN/CEFACT
    generic multimodal semantics
```

The core domain SHALL remain implementation-neutral.

---

# 29. Adapter Rule

This SHALL be the integration pattern:

```text
External Provider Standard
        │
        ▼
Anti-Corruption / Adapter Layer
        │
        ▼
Baobab TMS Domain
```

not:

```text
Baobab database schema
=
DCSA schema
```

---

# 30. Fleet and Resource Boundary

TMS SHALL own the **operational** projection of transport resources.

Examples:

```text
truck

trailer

container

vessel reference

aircraft reference

ULD

rail equipment

special project equipment
```

---

# 31. Operational Asset vs Financial Asset

This SHALL remain:

```text
TMS TransportResource
    !=
ERP Financial Asset
```

TMS cares about:

```text
availability

serviceability

capacity

assignment

location

movement
```

ERP cares about:

```text
acquisition

book value

depreciation

accounting

financial disposal
```

---

# 32. Asset-Light Architecture

TMS SHALL support execution where the tenant owns:

```text
zero transport assets
```

It SHALL equally support:

```text
owned

leased

chartered

partner

subcontracted
```

capacity.

---

# 33. Capacity

TMS SHALL own transport capacity execution semantics.

It SHALL distinguish:

```text
physical capacity

commercial capacity entitlement

available capacity

reserved capacity

assigned capacity
```

---

# 34. Provider Qualification Boundary

TMS SHALL NOT become the canonical organisation/KYB engine.

It SHALL consume qualified-provider references and decisions established through:

```text
Control Plane

counterparty/qualification capability

tenant-specific provider qualification
```

as applicable.

---

# 35. Provider Eligibility Before Assignment

TMS SHALL be able to enforce:

```text
provider qualified
+
required capability valid
+
resource suitable
+
capacity available
=
potentially eligible assignment
```

without owning the provider's universal legal identity.

---

# 36. Carrier vs TMS Provider

This distinction is mandatory:

```text
Capability Provider
    baobab-tms

Carrier
    logistics operating organisation
```

This is invalid:

```text
carrier_id = baobab-tms
```

---

# 37. Transport Cost Boundary

TMS MAY own transport-domain cost inputs such as:

```text
carrier transport quote

carrier buy rate

route cost estimate

movement operating-cost estimate

capacity cost

transport accessorial estimate
```

subject to later commercial ADRs.

---

# 38. TMS Does Not Own Customer Margin

TMS SHALL NOT own:

```text
customer sell rate

customer quotation

Thamani margin policy

sales discount

commercial approval
```

Those belong to the consuming commercial domain.

---

# 39. Customs Boundary

TMS SHALL NOT own:

```text
CustomsCase

CustomsDeclaration

customs-document dossier

customs authority submission

customs authority response
```

Those belong to Trade Docs.

---

# 40. Customs Enforcement

TMS SHALL consume Customs outcomes where they constrain physical execution.

Example:

```text
Trade Docs:
CUSTOMS HOLD

        │

        ▼

TMS:
movement transition blocked
```

---

# 41. Regulations Boundary

TMS SHALL NOT embed:

```text
tariff law

permit law

SPS rules

rules of origin

import prohibitions

regulatory classification logic
```

These belong to Baobab Regulations.

---

# 42. Regulations PDP / TMS PEP

The architecture SHALL follow:

```text
Baobab Regulations
       │
       │ decision
       ▼
Baobab TMS
       │
       │ enforce relevant transport constraint
       ▼
Physical execution
```

TMS SHALL reference the governing decision where required.

---

# 43. Warehouse Boundary

TMS SHALL NOT automatically become a WMS.

It SHALL not own detailed:

```text
bin

locator

putaway

pick wave

cycle count

warehouse inventory ledger
```

TMS MAY coordinate transport-facing warehouse handoffs.

---

# 44. Inventory Boundary

TMS may record:

```text
custody

movement

location observations

in-transit state
```

It SHALL NOT independently redefine:

```text
inventory ownership

financial stock

title
```

---

# 45. ERP Boundary

ERP remains authoritative for:

```text
financial cost

accounts payable

accounts receivable

invoice

general ledger

fixed assets

financial settlement
```

TMS SHALL expose operational facts needed by ERP.

---

# 46. IAM Boundary

IAM SHALL authenticate:

```text
dispatchers

operators

drivers where applicable

provider staff

service workloads
```

TMS SHALL own domain-specific authorisation decisions for transport actions.

---

# 47. Control Plane Boundary

Control Plane SHALL own:

```text
tenant context

legal entity

capability grants

capability providers

bindings

resolution

engine topology

health-based eligibility
```

TMS SHALL NOT create its own global tenant/capability control plane.

---

# 48. Tenant Isolation

Every TMS aggregate SHALL belong to an explicit tenant/legal-entity operating context where required by canonical contracts.

Tenant isolation SHALL be enforced at:

```text
API

persistence

events

background work

caches

search/read models

provider integration
```

---

# 49. Canonical Organisation References

Carrier, customer, operator and partner organisations SHALL be referenced using canonical organisation/counterparty identities.

TMS SHALL not mint competing universal organisations.

---

# 50. No Thamani Mode

The following SHALL be prohibited:

```text
if tenant == THAMANI:
    use_special_tms_logic()
```

Canonical behaviour SHALL use:

```text
capabilities

configuration

context

policy

provider bindings
```

---

# 51. Persistence

The persistence architecture SHALL be determined by a subsequent TMS ADR.

This charter requires only that:

```text
TMS domain authority remains local to TMS

no shared operational database is introduced

transaction boundaries are explicit

cross-engine integration uses contracts
```

---

# 52. Event-Driven Integration

TMS SHOULD support:

```text
transactional outbox

idempotent consumers

correlation

event replay policy

reconciliation
```

where asynchronous integration is used.

---

# 53. No Distributed ACID Requirement

TMS SHALL NOT require an ACID transaction across:

```text
TMS

ERP

Trade Docs

Regulations

carrier systems

warehouse systems
```

---

# 54. Failure Semantics

TMS SHALL distinguish at minimum:

```text
BUSINESS BLOCK

REGULATORY BLOCK

CUSTOMS BLOCK

CAPACITY UNAVAILABLE

PROVIDER UNAVAILABLE

INTEGRATION FAILURE

UNKNOWN
```

rather than collapsing every failure to:

```text
ERROR
```

---

# 55. Fail Closed

Where a mandatory condition cannot be established:

```text
provider eligibility

customs release

regulatory requirement

resource safety
```

TMS SHALL fail closed for the affected regulated transition.

---

# 56. Operational History

TMS SHALL preserve enough history to answer:

```text
What was planned?

What was booked?

What capacity was reserved?

Which resource was assigned?

Which provider was expected?

What actually moved?

What changed?

Who changed it?

When did it happen?

Which external source reported it?
```

---

# 57. Current State Is a Projection

High-level:

```text
Shipment.status
```

SHALL be treated as a projection.

Underlying transport facts SHALL remain independently auditable.

---

# 58. Implementation Independence

This ADR SHALL NOT prescribe a particular commercial TMS product or programming framework.

The engine MAY be:

```text
custom-built

composed from open-source components

backed by a specialised TMS

implemented through provider adapters
```

provided the canonical engine boundary remains stable.

---

# 59. Current Repository State

At acceptance of this ADR:

```text
baobab-tms
```

is a Foundation-0 engine-template scaffold.

Therefore this ADR establishes target architecture.

It DOES NOT claim the target capabilities are currently implemented.

---

# 60. Foundation Activation

Before substantive application code, the repository SHALL:

```text
replace template README

establish engine ownership

remove TEMPLATE-USAGE after activation

select runtime stack deliberately

activate .baobab metadata

declare development environment

adopt Foundation CI

define capability-provider declaration

pin Shared contracts

establish branch/security posture
```

consistent with the engine template.

---

# 61. Shared Changes Required

This ADR implies, but does not itself enact:

```text
Shared capability catalogue additions

Shared logistics contract evolution

event-context stewardship changes

event producer registration

Shipment contract reconciliation

provider registration bundles
```

These require cross-platform architecture changes in `shared`.

---

# 62. Existing Shipment Contract

`contracts/shipment/v1` SHALL be reviewed before TMS adopts it.

The current contract is insufficient as the complete TMS domain because it explicitly does not model:

```text
carrier booking

rating

cost

customs detail
```

and still reflects the old Trade event ownership.

It SHALL be:

```text
REUSED

REVISED

or

SUPERSEDED
```

through Shared governance rather than copied blindly.

---

# 63. Initial ADR Programme

Following this charter, the recommended TMS sequence is:

```text
ADR-TMS-0002
Canonical Shipment, Consignment and
Transport Execution Domain Model

ADR-TMS-0003
Transport Plan, Route, Corridor,
Movement, Leg and Call Architecture

ADR-TMS-0004
Carrier, Booking, Capacity and
Transport Procurement Boundary

ADR-TMS-0005
Fleet, Transport Means, Equipment,
Resource and Assignment Architecture

ADR-TMS-0006
Transport Rates, Carrier Buy Cost
and Operational Costing Architecture

ADR-TMS-0007
Tracking, Milestones, Events,
Telemetry and Visibility Architecture

ADR-TMS-0008
Delivery, POD Reference and
Transport Exception Architecture

ADR-TMS-0009
Multimodal Provider Adapter and
Standards Interoperability Architecture

ADR-TMS-0010
Tenant, Isolation, Context and
Canonical Reference Architecture

ADR-TMS-0011
API, Event, Idempotency and
Distributed Workflow Architecture

ADR-TMS-0012
Persistence, Temporal History
and Projection Architecture

ADR-TMS-0013
Security, Authorization and
Provider Integration Credentials

ADR-TMS-0014
Observability, Resilience,
Reconciliation and DR Architecture

ADR-TMS-0015
Production Readiness,
Capability Certification and Migration
```

---

# 64. Alternatives Rejected

The following are rejected:

**Thamani as the TMS.**  
Reusable transport execution cannot belong to one Digital Estate.

**ERP as the TMS.**  
ERP financial and inventory authority does not make it the canonical multimodal execution engine.

**Baobab Trade as the universal TMS.**  
Commerce fulfilment and physical transport execution have different authorities.

**Trade Docs as part of TMS.**  
Transport execution and customs/document execution require independent bounded contexts.

**Regulations embedded in TMS.**  
Operational enforcement and regulatory interpretation must remain separate.

**One universal `Shipment` row across all engines.**  
Trade, fulfilment and logistics shipment semantics require explicit boundaries.

---

# 65. Architectural Invariants

```text
TMS
    != Digital Estate

TMS
    != ERP

TMS
    != WMS

TMS
    != Customs Engine

TMS
    != Regulations Engine

TMS
    != Carrier

TMS
    != Customer Commercial Domain

Shipment
    != Commerce Order

Shipment
    != Fulfilment Promise

Consignment
    != Booking

Route
    != Trade Lane

Route
    != Movement

Transport Means
    != Transport Equipment

Asset Ownership
    != Operational Assignment

Capacity
    != Availability

Booking
    != Resource Assignment

Assignment
    != Dispatch

Dispatch
    != Departure

Planned
    != Estimated

Estimated
    != Actual

Transport Event
    != Current Status

Physical Border Crossing
    != Customs Release

Customs Hold
    comes from Customs authority projection

Regulatory prohibition
    comes from Regulations

Financial actual
    comes from ERP

Canonical Organisation
    comes from Control Plane

Capability identity
    must remain provider-neutral
```

---

# 66. Final Decision

Baobab TMS SHALL become the Baobab Platform's reusable authority for **transport-management and physical logistics execution**.

Its conceptual architecture is:

```text
                  TRANSPORT REQUIREMENT
                          │
                          ▼
                       SHIPMENT
                          │
                          ▼
                      CONSIGNMENT
                          │
                          ▼
                   TRANSPORT PLAN
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
         Route          Booking       Capacity
           │              │              │
           └──────────────┼──────────────┘
                          ▼
                     MOVEMENT
                          │
               ┌──────────┼──────────┐
               ▼          ▼          ▼
             Leg         Call     Resources
               │                     │
               └──────────┬──────────┘
                          ▼
                    EXECUTION EVENTS
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
         Tracking     Exceptions    Delivery
                          │
                          ▼
                   OPERATIONAL HISTORY
```

The defining principle is:

> **Baobab TMS shall know how transport is planned, booked, resourced, executed and observed, while leaving commercial customer ownership, regulation, customs documentation, accounting and identity to their authoritative domains.**