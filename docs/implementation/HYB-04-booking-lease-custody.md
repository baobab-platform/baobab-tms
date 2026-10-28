# HYB-04 / TMS-API-02 — Booking operation lease and current-authority seam

**Status:** **SQL lease/fencing preflight only — current CP/IAM authority NOT ACCEPTED or connected.** This PR is stacked on #25 → #24 → #23 → #22 → #21 → #20 → #19. No merges without direct user authorisation.

## Why an operation lease is not authorisation

Accepted Shared currently lacks TMS-native operation permissions and the TMS workload registry allocation. Shared PR #409 proposes an additive versioned decision but is explicitly *not Accepted*. Even a genuine successful CP context validation carries Tenant/Organisation and bounded context, NOT legal actor, native provider release, booking mandate, or a current lease to execute. CP capability resolution cannot be substituted with caller-provided tenant fields. A locally generated decision shaped like the proposed schema MUST NOT trigger native work.

## Implemented custody

`db/migrations/0006_booking_operation_lease.sql` adds a canonical TMS Postgres17 operation lease per Tenant + Booking + operation, pinned to booking plan revision, immutable intent digest and native binding. It stores monotonically increasing lease generation and bounded expiry. The owner-only test function locks the booking row before claiming; competing workers have exactly one winner, no takeover while the lease is live, no reuse of an expired generation, a valid expired lease can be reclaimed only at a *higher* generation, and wrong-tenant/binding/intent fails closed.

**Crucial invariant:** `authority_status` is permanently CHECK-constrained to `UNVERIFIED`. Claims return `UNVERIFIED_NOT_EXECUTABLE`, and no function or migration path can turn a local lease into current CP authority. Function EXECUTE is revoked from PUBLIC. New table has ENABLE and FORCE RLS with **zero runtime allow policies**. A runtime role with table SELECT/INSERT/UPDATE privileges gets zero rows and cannot claim a lease; an application using a native vendor JWT cannot bypass this.

`src/repositories/canonical-booking-transaction.mjs` validates the canonical command tuple and generates non-executable scoped input, but **all** transaction methods explicitly fail before touching their injected database. Passing a caller-controlled fake CP ALLOW or granting ordinary SQL privileges cannot activate them. No local development override exists.

## Qualification

CI applies 0001..0006 to real disposable PostgreSQL 17, executes parallel independent SQL sessions, tests stale/lost lease generation, foreign Tenant and binding, early takeover, expiry recovery, forced RLS and disallowed VERIFIED transition, plus Node24 negative tests. The database and credentials are torn down.

This is a **prerequisite**, not a working authenticated first-party write service: the SQL owner/fixtures are not CP authority. To implement real transactional repositories, the architecture owners must accept Shared/CP/IAM contracts and mint a registered TMS workload, then TMS must authenticate separate workload identity, validate actual subject context, perform current legal/market/binding/mandate resolution immediately before each effect, attach CP lease and atomically commit intent+outbox+authorised domain state. Independently qualify revoked token, wrong audience, wrong tenant, stale binding, lost lease and provider UNKNOWN reconciliation. No carrier booking, capacity allocation, Shared business event or native effect is admitted before that stage.
