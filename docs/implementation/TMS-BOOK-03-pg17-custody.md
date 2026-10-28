# TMS-BOOK-01/02/03 and TMS-DB-03: canonical booking and capacity custody

**Status:** PostgreSQL17-only draft/negative qualification; **connected CP-native authority and real carrier side effects HELD**. This is stacked on TMS PR #23 (and its ancestors #22, #21, #20, #19); no PR merges until the user explicitly authorises them.

## Existing authoritative decisions

Accepted ADR-TMS-0004 requires TMS-owned TransportBooking, immutable BookingAttempt, provider-neutral carrier organisation (distinct from Baobab CapabilityProvider), idempotency, capacity holds and **PROVIDER_UNKNOWN** on ambiguous carrier results. HTTP 202 is transport acceptance, NOT a confirmed booking. ADR-TMS-0011 requires exact legal/tenant/workload/aggregate scope in idempotency, replay-safe inbox/outbox and local transactions. ADR-TMS-0012 requires canonical Postgres17, immutable history, concurrency, and zero cross-engine DB coupling. ADR-TMS-0020/0021 allow native Fleetbase MySQL and Open TMS PG separately without changing canonical TMS ownership.

## Implemented

- `tms.carrier_booking_intent` references an exact canonical plan revision and has Tenant, Organisation, legal entity, Market, carrier organisation, provider adapter kind, binding, actor, immutable intent digest, stable scoped idempotency key and provider-native reference as a separate identity.
- Booking lifecycle distinguishes REQUESTED, PENDING_PROVIDER, PROVIDER_UNKNOWN, CONFIRMED, DISPATCHABLE, IN_EXECUTION and terminal outcomes. A state trigger disallows invalid backwards transitions, cancellation from uncertain outcome, mutable identity or provider proof, and CONFIRMED without a nonempty provider booking reference plus readback reference. No plan approval, customs authorisation, commercial mandate or provider eligibility is inferred.
- `tms.carrier_booking_attempt` is append-only, has a stable external idempotency scope and differentiates received-202, timeout unknown and external readback. A duplicate provider key fails rather than risking a second booking.
- `tms.carrier_capacity_pool` and `tms.carrier_capacity_hold` use tenant/legal/market composite FKs, numeric(28,9) decimal-safe amounts and constraint-bounded capacity. Provider-independent SQL functions lock the pool row **before** checking existing holds or allocating, so two database sessions cannot oversubscribe a pool. Duplicate equal hold returns prior result without incrementing; mismatched replay conflicts. Releasing a hold is idempotent and decrements at most once. These functions use SECURITY INVOKER and REVOKE EXECUTE FROM PUBLIC.
- All tables have FORCE RLS with no runtime allow policies. The PostgreSQL owner can create synthetic CI fixtures, but an unprivileged service role even with ordinary SQL table grants cannot read/write holdings or invoke capacity functions.

## Real CI proof and limitations

The GitHub Actions job boots disposable PostgreSQL17 with no host-port exposure and applies migrations 0001 through 0005. It tests concurrent independent sessions contending for one capacity unit, duplicate same key, conflicted replay, wrong legal/Market scope foreign keys, provider 202 and timeout not equalling confirmation, matching readback, terminal backward transition denial, append-only attempts, and runtime RLS/EXECUTE denial. All database volumes and secrets are destroyed.

**No privileged SQL fixture is CP authority.** These SQL functions MUST NOT be exposed to runtime until Shared native-operation authority is accepted, IAM independently issues a workload, CP verifies current legal/mandate/binding/release, and an operation-specific, lease-fenced service transaction is qualified. Passing PG17 proves only storage/locking. No live carrier, capacity feed, final booking, production admission, event publication, or cross-provider capacity guarantee is asserted.

Shared proposed TMS authority: https://github.com/baobab-platform/shared/pull/409 (PROPOSED, not Accepted). Next stacked PR: an explicit denied-by-default first-party repository/booking adapter, provider-neutral unknown outcome/readback and signed callback negative tests. Real native side effects remain blocked.
