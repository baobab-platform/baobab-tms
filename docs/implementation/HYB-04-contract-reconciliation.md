# HYB-04 — Actual Shared/CP/IAM contract reconciliation

**State:** immutable-source contract evidence only; native execution and activation remain HELD.
**Review lineage:** this PR stacks onto PR #20, which stacks onto PR #19. Do not merge any PR without explicit owner authorisation.

## Source authority

The governing baselines are Accepted TMS ADR-0010/0013/0020/0021, Shared EA v2.3/EA-DEV, and the exact Shared/CP/IAM revisions in config/contracts/hyb-04-source-pin.json. The CI source gate verifies each checkout's Git SHA and specific real schema/handler properties. The pin is a source provenance statement, not a production deployment identity or a legal/capability approval.

- Shared commit ab7a473a1f69784f115ad353e36383faf9b95965: control-plane/v1 PlatformContextValidation and v2 Organisation-first extension, capability/v1 resolution, control-plane/v1 ExecutionOperation, workload registry, IAM token response.
- CP commit 6b0ec5fa70b4ccc2b7ab9ff0cd8829a080d355ff: actual platform-context validate and capability-resolution HTTP handlers.
- IAM commit 2ce99492d0af88e93524a28d3c9494a5770f71cf: workload token profile with Shared commit, audience and scope constraints.

The parent PR #20 models an independent IAM verifier and a CP readback callback with provisional custom fields. Those custom fields are **not** the actual CP PlatformContextValidation response. This child does not quietly retrofit fabricated native operation grants into the accepted Shared schema.

## Exact accepted context validation boundary

An authenticated TMS resource-server workload would POST to /v1/platform-context/validate using its OWN CP-audience validator bearer with context:validate and the caller's access token separately in the request body. The entire body schema is exactly context_id and subject_token. The subject token is opaque OAuth credential material, not necessarily a compact JWT; it must not be logged, traced, persisted, queued or echoed. The CP handler validates the subject independently against its registered validates_audiences relationship. This repo does not yet hold an authorised TMS validator identity, so NO actual CP call or usable privilege is claimed.

Shared PlatformContextValidation v1 requires context_id, tenant_id, resolved_at, expires_at and authority_purpose. Operating Organisation and Market are optional in v1, but TMS requires both to proceed even to a structural assessment. Organisation-first v2 makes the PRIMARY Organisation attestation mandatory. Authority purpose is RUNTIME or TENANT_PROVISIONING. Provisioning authority requires the current exact tuple tenant_provisioning_id, plan_id, plan_version and plan_digest and cannot be silently treated as RUNTIME. CP's context validation does NOT contain legal_entity_id, native-provider binding, action grant or lease authority.

The module src/security/cp-context-validation-contract.mjs creates only the exact Shared v1 body and inspects a schema-shaped response against expected scope. No HTTP network transport is wired. An untrusted caller can fabricate a schema-shaped response, so a successful local assessment returns CONTEXT_SHAPE_MATCH_ONLY and **canExecute=false**. The module never creates an IAM Principal, resolves an unavailable workload, or moves an operation from HELD to active.

## Confirmed integration blockers

1. The pinned Shared workload registry contains no baobab-tms or dev TMS validator registered for context:validate with validates_audiences. Only the Shared/IAM/CP owners may govern that allocation.
2. Shared control-plane/v1 ExecutionOperation supports tenant provisioning, changesets and provider migration; it does **not** define a TMS-native provisioning or dispatch operation. The TMS lifecycle draft in #19 is not the CP authority for it.
3. CP's capability resolution redeems a context owned by the actual authenticated caller; a TMS validator cannot substitute its own IAM principal to resolve someone else's context. A Shared/CP-approved native TMS authorisation or delegated resource-server surface is still required.
4. Legal-actor mandate and provider isolation binding/release must be independently read from owning CP/Shared services. Neither the validator's own token nor a matching market code establishes them.
5. Fleetbase source/migration qualification does not establish commercial/AGPL clearance or a safe, supported production PHP runtime. HYB-02 operation-specific native EDI/storage and worker acceptance similarly remains gated.

## Acceptance / negative tests

The CI gate checks the exact three immutable Git commits, required Shared request/response members, v2 Organisation requirement, absence of legal and action fields, the CP handler's subject-verification and caller-owning capability-resolution rules, IAM workload profile, and the missing TMS registry and operation. Tests reject malformed/expired/foreign context, wrong Organisation/Market/Tenant/purpose, absent bounds, untrusted legal actor fields, overlong/invalid subject tokens, mismatched provisioning plan tuples, and stale authority. All positive structural results remain non-executable. A new source revision is a new contract-review decision, not an automatic update.

## Next stacked engineering gate

A subsequent child requires Shared-owned TMS validator registration and IAM/CP runtime adoption, a versioned CP TMS-native execution/mandate decision including legal actor, capability binding, plan digest and fencing generation, then actual two-Tenant synthetic IAM-issued token and CP-current evidence. Only after that should TMS connect durable native effect claims/reconciliation. Never use vendor JWTs or local development flags as an authorisation substitute.

**Source links:**
- https://github.com/baobab-platform/shared/blob/ab7a473a1f69784f115ad353e36383faf9b95965/contracts/control-plane/v1/platform-context.schema.json
- https://github.com/baobab-platform/shared/blob/ab7a473a1f69784f115ad353e36383faf9b95965/contracts/control-plane/v1/execution-operation.schema.json
- https://github.com/baobab-platform/shared/blob/ab7a473a1f69784f115ad353e36383faf9b95965/docs/architecture/context-authority-for-workloads.md
- https://github.com/baobab-platform/baobab-cp/blob/6b0ec5fa70b4ccc2b7ab9ff0cd8829a080d355ff/api/platform_context_validate_handler.go
