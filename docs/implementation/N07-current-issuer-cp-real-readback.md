# TMS N07 — real IAM issuer and CP context readback, native execution HELD

31 October 2026 | Governing EA v2.3, EA-DEV DEV-08/14, EA-XB v1.1,
ADR-TMS-0010/0013/0020/0021 and Shared ADR-SHARED-042/043.
Status: DRAFT, SOURCE IMPLEMENTED, NO NATIVE BOOKING ACCEPTANCE.

## What changed

- src/security/n07-issuer-cp-real-readback.mjs performs actual, TLS-verified,
  bounded issuer introspection for the original subject token, calls CP's
  current Shared contract POST /v1/platform-context/validate using a distinct
  CP-audience context:validate bearer with the exact body:
  context_id and subject_token only. It then rechecks the same original
  subject at Hydra to catch revocation while CP is reading.
- It reuses the existing cp-context-validation-contract.mjs exact Shared
  response guard. Missing/suspended/expired/mismatched Tenant,
  Organisation, Market, RUNTIME purpose and still-unexpired issuer
  status deny. It does not infer legal_entity_id, mandate, capability
  binding/revision, provider licence or booking authority from the
  CP context response.
- Every result, even from real HTTP, has canExecute=false,
  nativeBindingCertified=false, legalActorCertified=false, and cannot call
  the provider. The existing IAM/CP HYB-04 synthetic assessment and
  native worker/storage fences retain their separate no-execution gates.
- scripts/n07-real-issuer-cp-observe.mjs is an opt-in standalone
  development-only **real network** producer. It demands a current clean
  exact-source TMS checkout, immutable IAM/CP/TMS/Shared source pins,
  owner-only 0600 private profile and separate original subject, CP
  validator and Hydra introspector credential files. No CLI parameter can
  select a different issuer client or grant a vendor-native privilege.
  It writes private original digest + receipt exclusively, never a
  bearer/cookie/provider response/identity to evidence, and exits 3 for
  HTTP-only readback or 2 if blocked. Exit 0 NEVER indicates acceptance.
- Tests exercise both independent issuer reads, CP exact body and separate
  validator credential, revoked-unexpired token, wrong audience, client,
  scope, foreign Tenant, incorrect purpose, CP outage, malformed URL and
  absent private original. Unit HTTP doubles do not demonstrate a real
  provider, real CP or independent source readback.

## Native HYB-04 preflight composition

src/security/n07-native-readback-fence.mjs connects the two distinct
verification components **in strict order**: first the real original
Hydra/current CP readback, then the existing HYB-04 native
IAM/CP operation-specific proof assessment. Every context, token,
Tenant/Organisation/Market and tms.booking.submit operation must match
both. If either verifier is unavailable/changes, the second stage
or native execution is refused. Successful return is still explicitly
REAL_CONTEXT_AND_NATIVE_PREFLIGHT_NON_EXECUTABLE:
canExecute=false, bookingAccepted=false, legalActorCertified=false.
Its execute method always refuses. This is not a provider acceptance
or real legal-actor mandate. Unit-negative tests under
test/n07-native-readback-fence.test.mjs prove that no native
proof can bypass a failed issuer/CP observation.

## Actual canonical registry and binding dependencies

Shared currently does not allocate an ACTIVE registered baobab-tms
subject audience, qualified provider, exact native booking capability or
independent CP context validator for a TMS operation. The local source
requires tms:booking:submit in the independently introspected subject
scope, but **no new Shared scope or ACTIVE workload registration is
allocated by this TMS PR**. Neither an arbitrary OAuth scope nor a
Thamani confidential browser client can create a legal-actor grant.

A separate Shared + CP + IAM governed registration and native TMS
provider readback is required before an actual authorized token can be
issued and accepted. The separate context:validate credential has its
own client and audience, is short-lived and cannot be substituted by
the business subject token. Real native plan digest, CP capability
binding/revision, provisioning generation, idempotency reservation and
provider-specific native result remain independently required.

The current development-server.mjs intentionally returns 503 from
/readyz and 404 from all shipment/booking endpoints. HYB-04
iam-cp-native-execution-authority.mjs still returns
PROOF_ONLY_NOT_EXECUTABLE. Do not expose a public booking endpoint,
use vendor native JWT/cookies, or execute a booking merely because
the real issuer/CP HTTP readback reported current context.

## Owner-supervised development procedure

1. Review accepted Shared scope/workload registration and CP/issuer
   permissions. Register **PROVISIONED**, never self-promote ACTIVE,
   a purpose-scoped TMS subject and an independent TMS CP validator
   only after canonical contract approval. Confirm actual Hydra/CP
   configurations and source-pinned TMS provider binding.
2. Provision an isolated actual TLS Hydra (with current introspection),
   a separately deployed CP, exact synthetic Principal/Organisation/
   Tenant/Market and provider-native TMS backend, with distinct
   original client credentials and independent teardown operator.
3. Fill docs/implementation/n07-issuer-cp-profile.example.json into an
   OWNER-ONLY private 0600 JSON, replacing all inert source pins,
   private URLs, registered client IDs and current original files.
   Never copy live tokens or provider private credentials into Git,
   CI artifacts, issue comments or browser storage.
4. On a clean, pinned approved TMS checkout, execute:
   BAOBAB_ENVIRONMENT=development node
   scripts/n07-real-issuer-cp-observe.mjs
   /run/private/tms-n07/profile.json
   /run/private/tms-n07/originals
   and independently inspect the original digest. The runner always
   exits nonzero (3 means HTTP-only readback, not accepted).
5. Perform actual issuer revocation while the original subject token
   remains unexpired, repeat readback and require denial. Repeat for
   suspended/foreign CP Tenant, revoked validator, wrong Market,
   issuer/CP outage and in-flight source-pin drift. Independently
   observe CP decisions and complete teardown.
6. Only after actual separately approved native provider provisioning,
   CP capability/mapping/legal-actor and delegated operation authority,
   add the corresponding TMS native executable fence, real durable
   booking idempotency, provider accept/reject/unknown and
   reconciliation. Do not silently enable execution from test fixtures.
7. The original business booking acceptance is a distinct later
   test requiring a real provider and finance/documentary consequences,
   not a read-only HTTP response.

DO NOT MERGE until exact-head CI and owner validation. No protected
staging/production action or provider-support promotion is authorised.
