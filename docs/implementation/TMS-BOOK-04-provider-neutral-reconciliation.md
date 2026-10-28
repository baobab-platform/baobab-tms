# TMS-BOOK-04 — Provider-neutral carrier readback and unknown outcomes

**Status:** synthetic pure-domain fixture; native side effects HELD. Parent TMS #24 is stacked on #23 → #22 → #21 → #20 → #19. All PRs remain open until owner explicitly authorises a merge.

**Normative scope:** ADR-TMS-0004 Carrier/Booking/Capacity; ADR-TMS-0011 idempotency, callback trust and at-least-once semantics; ADR-TMS-0012 temporal and reconciliation history; ADR-TMS-0013 credentials and webhook replay; ADR-TMS-0020/0021 provider adapters. The technology proposal TMS-TECH-01 supplies only non-conflicting guidance.

The implementation separates carrier identity from the selected *Baobab capability provider/native engine*. A versioned TransportBooking draft contains Tenant, operating Organisation, legal actor, Market, plan revision, carrier organisation, internal native binding, actor, immutable request digest and idempotency key. No vendor booking reference is a canonical ID.

Submitting is a pure transport observation: HTTP 202 leads to PENDING_PROVIDER, never CONFIRMED; timeout and transport failure lead to PROVIDER_UNKNOWN. There is no implicit retry and no new idempotency key. A signed **synthetic fixture** readback permits deterministic reconciliation to CONFIRMED or DECLINED, recording occurred_at vs received_at, message identity/digest, readback ID and external provider booking reference. Duplicate matching readback is no-op, different digest under the same message ID is denied, foreign Tenant/legal actor/Market/carrier/binding/ref/nonce and expired/forged signatures deny, and terminal outcomes cannot be resurrected by late callbacks. This is a test signature profile only; real carriers need independently reviewed per-provider signature, key, egress and replay profiles.

Capacity candidate drafts preserve decimal-safe quantity and mode, but do not reserve any real provider capacity or imply a buy-rate or procurement. Parent #24 separately tests real PG17 transactional capacity holds in a synthetic owner-only database.

**Crucial execution boundary:** `createHeldCarrierExecutionPort` implements submit/retry/reconcileNative/reserveCapacity/releaseCapacity/cancel as always-denied operations, including when a caller supplies a fake CP ALLOW. The accepted IAM TMS validator workload/CP-native decision is missing (see Shared proposed #409). There is no HTTP/native adapter, no IAM token, no real native booking, and no live provider credential. No service writes to protected PG17 are enabled. `canCommit`, `canDispatch`, and `canReserve` remain false on all pure-domain objects, including after synthetic readback.

**Follow-up acceptance:** obtain actual accepted Shared/CP/IAM native operation grant; independent legal/mandate/provider binding readback; PG17 transaction+outbox/inbox with current revocation, session-safe RLS and operation fencing at claim and immediately pre-effect; two-provider synthetic road/sea and real sandbox certification; operator compensation and independent teardown.

**Merge hold:** user has explicitly forbidden all merges until authorised.
