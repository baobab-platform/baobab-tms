# HYB-02 — Canonical native worker replay and unknown-outcome ledger

**Status:** durable schema and first-party execution-fence engineering, NOT complete native worker certification. **HYB-01 Fleetbase remains deferred.**

## Canonical PostgreSQL foundation issue

The pre-existing TMS FND-01 SQL migration contained malformed ACTIVE release-digest validation and duplicate statements after its first COMMIT. Earlier checks had never executed the canonical migration against PostgreSQL 17. This increment repairs the checked-in baseline and introduces CI that actually applies it to an isolated real PG17 instance. `0002_native_worker_execution.sql` is a first-party canonical TMS schema addition and must **not** be applied inside the upstream Open TMS database.

## Durable execution custody

An immutable key consisting of canonical Tenant, approved NativeExecutionBinding and canonical operation ID is the identity for one external effect, not a volatile pg-boss job ID. The ledger additionally retains operating Organisation, payload digest, idempotency key, CP fencing generation, local lease generation, CP decision reference and verification expiry. State is CLAIMED, COMPLETED, UNKNOWN, RECONCILIATION_REQUIRED or CANCELLED. Duplicate canonical operations and conflicting idempotency material fail under real PostgreSQL uniqueness constraints. Row-level security is both ENABLED and FORCED with **no allowing runtime policies** until the independently authenticated CP-authorised transaction executor is built.

The first-party `createNativeWorkerFence` executes a handler only after exact current CP scope, operation and fencing generation are verified. It requires a separately certified operation allowlist and a genuinely atomic durable ledger implementation. Before marking completion it repeats the authority check, and an uncertain failure is marked UNKNOWN, never silently retried. Repeated jobs after COMPLETED are harmless only if payload digests match. Concurrent duplicates cannot both claim the same operation if the ledger honours its documented atomicity requirements.

**Connected limitation:** the unit test uses a deterministic synthetic CP verifier and in-process ledger, while the PG17 test independently checks persistence, uniqueness and deny-all RLS. These are not evidence of a production SQL implementation of atomic ledger claim/complete/unknown, or a real IAM/CP policy check. No pg-boss durable replay workflow is declared certified yet.

## Native worker admission register

A first-party register explicitly classifies all twelve known Open TMS worker source families. Inbound-webhook, EDI-retry and customer-webhook retry have bounded connected synthetic proofs from earlier merged PRs; the remaining nine source families remain unqualified. This is a **release deny register**, not a vendor scheduler permission list. New, unknown or unqualified workers cannot be executed through the first-party fence. Existing upstream jobs will remain unsafe if not routed through this fence and are blocked from TMS capability admission.

## Remaining mandatory HYB-02 closure

1. Wire an authenticated CP-current verifier and transactional canonical PostgreSQL ledger/lease implementer to the native worker wrapper and every scheduler/subscriber. No native job-supplied orgId or provider token is authoritative.
2. Demonstrate actual pg-boss dead-letter delivery, replay, duplicate-job non-effect, crash/timeout recovery and lease fencing for each released native operation; preserve independent evidence. For external effects, UNKNOWN requires authoritative provider reconciliation, never blind resend.
3. Qualify other scheduled worker families, especially telemetry, shipment/tracking, anonymisation, financial cron, SLA, returns and document generation, with two legal Tenants and negative data/side-effect tests.
4. Replace quarantine-only storage/EDI/webhook middleware with actual CP/IAM-bound execution-point authorisation; enforce credential rotation, object lineage and restricted network egress.

No native provider is activated and no release support is inferred from passing CI.
