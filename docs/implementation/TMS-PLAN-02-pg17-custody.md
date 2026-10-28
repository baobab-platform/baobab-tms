# TMS-PLAN-02 — Canonical PostgreSQL 17 planning custody

**Status:** first-party schema/invariant acceptance engineering; authenticated command/persistence integration and protected TMS-PLAN-02 completion HELD.

**Governance:** Accepted ADR-TMS-0001/0002/0003/0010/0011/0012 as amended by ADR-TMS-0020/0021; Shared EA v2.3/EA-DEV and non-conflicting TMS-TECH-01. This is a child of TMS-PLAN-01 PR #22, which is stacked on #21, #20 and #19. ALL PRs must remain unmerged until the user expressly authorises a merge.

## Canonical custody implemented

Migration db/migrations/0004_transport_plan_and_movement.sql adds first-party tables for TransportPlan, immutable TransportPlanRevision, per-version source requirements, TransportRoute, versioned waypoints and corridor references, independent TransportMovement, TransportCall, TransportLeg and MovementConsignmentSegment.

Every object has tenant-scoped canonical keys; plan head references an actual persisted revision under a deferred FK. Movement and Consignment carry composite Tenant, operating Organisation, legal entity and Market FKs on segment associations, preventing cross-tenant and wrong-legal/market joins even where a caller knows the other resource ID. A leg has movement-bound origin/destination call references and a matching movement mode; a trigger checks forward adjacent call order. Repositioning-only cargo assignment has a dedicated database veto. UTC timestamptz values coexist with preserved original RFC3339 offset strings and declared zone: timestamps are not permission or carrier observations.

Plan revision snapshots, source requirements, route choices, route waypoints and corridor references are append-only. PostgreSQL triggers prevent update/delete even by the migration fixture owner. A new intended plan must create a new revision, with an explicit previous-version link. The current plan head is a separate optimistic CAS pointer. The exact physical aggregate remains TMS-owned, not Fleetbase/Open TMS, Trade, ERP or Regulations.

ALL ten new tables have RLS ENABLED and FORCE RLS with **zero permissive policies**. A synthetic runtime role granted ordinary table privileges still cannot query or insert rows. This is deliberately more restrictive than a runnable application; CP/IAM transaction/row policy must be implemented and independently qualified before any first-party writes.

## Actual PostgreSQL 17 CI evidence and nonclaims

The new GitHub Actions workflow launches a disposable PostgreSQL 17 native-engine-independent database (private network, no host port). It applies 0001, 0002, 0003 and 0004 in order and tests parent/head integrity, revision history, source lineage, route waypoints, independent movement and segment scoping, immutability, wrong mode/call sequence, duplicate and foreign references, zero RLS allow policies, synthetic runtime denial and **two independent concurrent SQL sessions** racing the same head-revision compare-and-swap. Exactly one may win. After testing, all credentials, containers and volumes are destroyed.

This demonstrates an engineering SQL proof only. It does NOT prove a production application repository, IAM-issued Principal, CP current native operation authority, serialised cargo quantity allocation, actual provider booking, data-plane backup/restore, event outbox, capacity reservations, active dispatch or complete TMS-PLAN-02 certification. Nor do these tests certify the native Fleetbase/MySQL or Open TMS data planes.

## Next engineering

Implement a first-party PG17 repository with transactional expected-version CAS, source/cargo quantity aggregate invariants and app-level tenant/object policy, but keep it unexposed until real CP/IAM verification is available. The distinct next acceptance is a connected two-tenant negative matrix, then Shared-approved event production and provider-neutral external effect custody. The user retains merge authority.
