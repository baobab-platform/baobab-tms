# HYB-03 — TMS-side native provisioning lifecycle scaffolding

> **29 October 2026 audit reconciliation:** Shared #409 is accepted development design (merge `84c392105046406f190ee0fe87006ce3510760ef`), outside active contracts/registries; Shared #413 design acceptance is merged at `1fce3c36783310f33d79ba0996a996d00c4c5abe`. The Platform Owner authorised reviewed CI-green source merges. Historical proposal/no-merge statements below describe the original submission, not current governance. Runtime IAM/CP authority, carrier effects and provider activation remain HELD. These source/fixture artifacts cannot qualify an EA-XB operational case.

**Authority:** Accepted ADR-TMS-0020 §§4–8 and ADR-TMS-0021 §§2–7, 15–17. **Status:** DRAFT CONTRACT + PG17 STORAGE ENGINEERING ONLY; HYB-03/04 integration and real native-provider admission **HELD**.

## Boundary and contract strategy

The **Control Plane** owns Tenant, legal actor, Market, Organisation, approved provisioning desired state, approval/mandate, plan and fenced ExecutionOperation. **IAM** authenticates the execution workload. TMS owns its private native-execution binding and the provider-specific reconciliation/readback execution. These are four distinct objects: CP tenant, first-party TMS CapabilityProvider, TMS internal Fleetbase/Open TMS adapter, and the physical carrier/driver. No native Fleetbase company/driver token becomes a CP Principal.

This scaffold intentionally defines a **provisional internal** JavaScript planner, NOT a Shared or CP wire contract. The caller-supplied input is treated as untrusted *data*. The plan is sorted by a fixed field schema, rejects mass assignment/host/DB/secret parameters, contains only non-secret CP-scope references and provider-specific step families, and hashes an immutable scope plus steps to a deterministic SHA256. A changed Tenant, legal entity, market, policy, release, environment or generation cannot reuse a plan digest. This structural process does not prove that the desired state actually came from CP.

\`createHeldNativeProvisioningPort\` implements all five ADR §6 method names: \`plan\`, \`reconcile\`, \`readBack\`, \`suspend\`, \`deprovision\`. **Only plan** works, returning \`DRAFT_ONLY_NOT_CP_APPROVED\` and \`canExecute=false\`. All other methods throw \`NATIVE_LIFECYCLE_HELD\`, including for a forged \`source=CP_VERIFIED\`. This is deliberate; do not introduce a local DEVELOPMENT allow switch or use vendor root credentials to bypass CP.

\`inspectFencedOperation\` provides *structural-only* validation of the exact Tenant, operating Organisation, legal entity, Market participation reference, provider kind, environment, CP binding revision, plan digest, provisioning generation, separate worker lease generation, operation ID, idempotency key and bounded deadline. **Valid** returns \`STRUCTURALLY_VALID_NOT_AUTHORISED\` and cannot initiate a side effect. Actual execution requires trusted IAM-issued workload token verification, CP current context/mandate readback, CP-owned execution lease and independent credentials/certification, then domain/operation authorisation immediately before effect.

## Durable TMS custody

\`db/migrations/0003_native_provisioning_custody.sql\` adds a first-party canonical PostgreSQL 17 \`tms.native_provisioning_operation\` record for future CP execution correlation. Fields cover scope, native kind, environment, CP revision, plan/desired digest, immutable idempotency identity, provisioning and lease generations, reconciliable outcome and observed-state receipt/witness reference. A READY record must contain independent-observer identity, readback digest and timestamp. Duplicate CP operation or idempotency key is forbidden. **No ACTIVE state is present in this TMS operation table:** only CP can activate a certified capability/binding separately. RLS and FORCE RLS are on with **no runtime allow policy**; a synthetic runtime role with explicit table privileges can neither see nor insert a row.

A new GitHub Actions workflow applies migrations 0001/0002/0003 against **real PostgreSQL 17**, tests SQL state/uniqueness and the fail-closed RLS read/write boundaries, and independently tears down the disposable environment. Passing this does not mean production ledger transaction ownership, lease CAS, external native provisioning or CP lifecycle certification.

## Next acceptance contracts

1. Reconcile exact **currently Accepted Shared + CP** \`ExecutionOperation\`, desired-state/approval, identity/tenant mapping, lease and provider-readback versions. Avoid inventing wire fields or duplicating CP plan storage in TMS.
2. Implement a CP-initiated, IAM-audience-verified TMS ProvisioningPort with durable claim and optimistic fencing (generation and lease CAS) in PG17, idempotent reconciliation of PARTIAL/PROVIDER_UNKNOWN, and step receipts. No direct arbitrary native admin URL.
3. Add managed least-privilege secrets and *independent* native MySQL8/Redis/socket/readback for Fleetbase; do not use unverified native admin account or run destructive seed. Also implement Open TMS native PG17/pg-boss/EDI/storage provider isolation.
4. Qualify A/B wrong-tenant, stale plan, crashed lease reclaim, wrong legal actor, revoked workload, active movement legal hold, independent observer, eventual deprovision negative reads and replay. Retain actual runtime receipts with no secrets.
5. Keep Fleetbase licensing, per-operation dispatch qualification, carrier custody, Shared logistics event keys and CP capability activation HELD pending their individual approvals. The HYB-01 source/migration CI is not commercial/licence clearance.

**No external provider operation is activated by this PR.**
