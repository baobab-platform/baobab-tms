# TMS-PLAN-01: Canonical Plan, Route, Movement, Leg and Call Domain

**Normative baseline:** Accepted ADR-TMS-0003, as amended by Accepted ADR-TMS-0020/0021; ADR-TMS-0001/0002; Shared EA v2.3/EA-DEV; non-conflicting TMS-TECH-01 headless/ports-first guidance.

**Status:** unit-qualified pure-domain *draft* only. This PR is stacked on HYB-04 source-contract PR #21 (stacked on #20 -> #19), all still OPEN with explicit owner no-merge hold.

## First-party canonical identities

- TransportPlan is an independent, immutable-versioned intended execution. Its identity is not a Trade Shipment, Consignment, carrier booking or provider-native order ID. One or more source requirements are mandatory.
- TransportRoute is a version-specific alternative with ordered waypoint IDs, optional governed LogisticsCorridor references, and optional source-labelled decimal estimate. Corridor refs are not customs/legal permissions or provider IDs.
- TransportMovement is an independent scheduled/actual-trip aggregate with a single explicit movement mode. ROAD, RAIL, SEA, AIR or INLAND_WATERWAY are supported planning modes; MULTIMODAL is a composition of movements, not a vehicle mode.
- TransportCall has its own canonical ID, order, named facility reference and optional planned arrival/departure instants. Times preserve original RFC3339 offset, original declared zone and computed UTC; there are no inferred ETAs or actual observations.
- TransportLeg has a canonical ID, movement-specific call references, contiguous sequence and explicit matching movement mode. A leg cannot reference unrelated, nonadjacent or reversed calls.
- MovementConsignmentSegment is a draft association with exact Tenant, operating Organisation, legal entity and Market identity and explicit leg IDs. It does NOT reserve cargo quantities, carrier capacity, physical custody or booking rights. Repositioning-only movements cannot carry consignments.

## No false authority or commitments

No function authenticates an IAM Principal, redeems a CP context, approves a plan, commits it, dispatches a vehicle, registers a capability, publishes a Shared logistics event, invokes Fleetbase/Open TMS, decides customs status or creates a carrier booking. All domain objects are recursively frozen and explicitly marked DRAFT/NOT APPROVED.

A newly revised draft retains immutable previous revisions and a previous-version link, editor reference, causation and reason. The caller must name the expected current revision. Stale updates, mixed plan/route versions, invalid order and an already committed/approved plan are refused. This is **in-memory optimistic validation**, not a durable concurrency transaction. Actual post-commit replanning requires fresh CP authority and booked capacity/carrier/customs reconciliation before the route changes.

The source input is untrusted. The domain cannot itself attest legal actor or operating Organisation; an eventual application adapter MUST supply current CP/owner-verified context and enforce operation-level policy and stable transaction boundaries. A pure-domain object is not platform authority.

## Acceptance and remaining gates

TMS-PLAN-01 component acceptance: plan/route identities and history, deterministic draft revision, option/estimate provenance, correct modes, explicit timezone, chronologically valid calls, related legs, repositioning-only movements, many-to-many consignment segment association, wrong tenant/legal/Market/Organisation denials and no silent activation. Node 24 runs its tests alongside the existing LogisticsShipment/Consignment tests.

TMS-PLAN-02 **HELD**: PostgreSQL 17 schema, aggregate history and concurrent CAS/revision/quantity allocation proof with FORCE RLS. TMS-PLAN-03 **HELD**: real two-carrier road/sea transshipment, revisions and failed-booking readback. TMS-PLAN-04 **HELD**: Shared-approved cross-engine references and event/capability names. TMS-PLAN-05 **HELD**: actual IAM/CP-authorised commit, native webhooks and regulatory customs gates.

No provider release or merge is implied by a green unit-test suite.
