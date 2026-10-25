# HYB-02 — CP-current native execution gates and outbound destination fencing

**Status: ENGINEERED FIRST-PARTY POLICY GUARDS; NOT NATIVE RUNTIME-WIRED; FULL HYB-02 HELD.**

Governing: Accepted ADR-TMS-0020/0021 and Shared EA v2.3. Prior accepted and merged PRs #9–13 proved native PostgreSQL 17 migrations, A/B Fastify and pg-boss isolation, EDI/webhook retry and MinIO bucket-level scoping. This increment addresses the remaining root architectural deficiency: Open TMS's direct native storage constructors and HTTP fetch calls remain free to bypass a first-party tenant/provenance decision.

## 1. CP-governed binary storage enforcement primitive

The new first-party `createCpNativeBinaryFence` owns a vendor binary storage adapter behind a non-exported implementation. It supports the existing `IBinaryStorageProvider` logical `files/UUID` keys but transforms each operation into `t/{tenant}/o/{organisation}/binary/{UUID}`, exclusively after current CP verdict readback. For every store, retrieve, delete, exists or presign call it checks the trusted verifier result, tenant, operating Organisation, binding, operation reference, and a short (max 30-second) validity window. Per-request or per-job scopes use AsyncLocalStorage and are isolated across concurrent callbacks. Absent, revoked, expired or inconsistent CP readbacks cause deterministic denial; callers cannot select physical keys. The test exercises concurrency, cross-org identical UUID isolation, late revocation and malformed-key denial.

**Critically:** `verifyCurrent` must be provided by an actual independently authenticated CP client with issuer/audience/current-context resolution, principal-grant and binding-revision verification, lease and revocation semantics, and network-level credential custody. The unit tests inject a synthetic verifier; this repository does not yet hold evidence that the CP client is connected. The older `bindTenantBinaryStorage` remains a synthetic development helper and is not a trustworthy CP attestation just because its input includes the string `source: CP`.

## 2. Trusted HTTPS delivery boundary

The new `createTrustedOutbound` and `qualifyOutboundDestination` use a trusted CP destination verdict for each tenant/org/partner + EDI or webhook operation. They reject HTTP, literal IP/localhost, user credentials in URLs, private, multicast, documentation/test, link-local or mixed DNS results, unknown hosts, redirects, unsupported custom ports, suspicious headers and TLS downgrade. The validated DNS address is pinned for HTTPS TCP dialing while certificate/SNI verification remains against the approved hostname. Headers, deadlines and responses are bounded.

This is an **unwired transport primitive**. The real upstream `OutboundEdiDeliveryService.deliverViaHttp` and `CustomerWebhookDeliveryService.deliver/retry` still call their own raw `fetch`. They must be patched or replaced by an adapter and native end-to-end tested under real CP-authorised destination bindings before any external EDI or webhook egress is enabled. Synthetic HTTP 200 in prior tests was *not* proof of real partner receipt or trust.

## 3. Native source inventory and release gates

CI now checks the exact reviewed upstream SHA `623adec1370f1a85a92766cd0a028f7a451dab95` and inventories the native storage composition roots, route/service callers, raw EDI/webhook callsites and the twelve worker source files. Any revision drift or new unclassified direct raw storage constructor, route dependency, worker or EDI/webhook fetch reference requires an explicit re-audit. A passing inventory is evidence of known *risk surfaces*, not of patched source. It deliberately prints outstanding holds and never promotes unmodified Open TMS to a certified provider.

## 4. Outstanding implementation order

1. Replace ALL native direct storage constructors in the DI composition root and standalone worker, connect the CP-verifying fence at the **actual** request and queued-job execution points, and prove no static or dynamic raw-provider escape. Cover attachments, document downloads, generation, public branding, theme administration, return labels and every event-handler/worker consumer.
2. Replace both EDI and customer webhook HTTP fetch callsites with the trusted outbound transport. Pin approved partner origin and operation to current CP binding; prove DNS rebinding, redirect, SSRF, revoked scope, signed receipts, unknown-outcome reconcile and carrier/non-carrier callback distinctions with real native runtimes.
3. Qualify every scheduled worker category, queue/tenant namespace and replay cycle, including dead-letter retirement/replay, duplicate jobs, current scope at execution, cancellation, crash recovery and output custody.
4. Prove versioned native source builds/migrations and independently observed credentials, object storage, audit and teardown in a disposable real CP/IAM topology; update Shared capability admission only when explicitly qualified.

**No provider activation, native app sign-off, Fleetbase HYB-01 work or change to approved CP/IAM authority is authorised by this increment.** Scope is secure, tested components and a native-source admission census; full completion remains HELD until real runtime wiring and multi-layer acceptance are proved.

## 5. Pinned vendor source quarantine overlay

A deployable-source **quarantine** layer now exists at `scripts/hybrid/apply-open-tms-quarantine.mjs` and `ops/hybrid/native-overlays/open-tms/`. On exactly pinned Open TMS, it injects the first-party binary guard into the central API DI factory **and** the independently constructed event worker binary provider, covering all documented consumers that resolve the API token or use the event-worker provider. It also replaces the exact one EDI and two customer webhook direct `fetch` calls with the trusted outbound gateway. Every replacement is single-source and count-checked: drift aborts the build instead of falling back to an unguarded provider. A native-source CI job transpiles the patched TypeScript and loads real upstream modules to assert no raw storage method or external HTTP dial can execute without current CP verification.

**IMPORTANT SECURITY BOUNDARY:** the overlay is currently wired in **quarantine (deny-all)** mode because the verified CP execution-point port and trusted native HTTP/job-envelope context have not been provided. Under quarantine, document/upload/logo/worker binary operations and outbound EDI/customer webhook HTTP sends correctly fail; this is a safe disabled pilot build, not functional production execution. `verifyCurrent: async()=>null` must **never** be changed to return ALLOW from a native JWT, `orgId` or environment flag. Only a separately implemented and tested CP/IAM-bound verifier may enable specific operations. Deploying the *unpatched* vendor checkout still bypasses the fence, so the production packaging pipeline must reject any image lacking the exact audited patch and source digest. The bounded CI proves patch compile and denial, **not** real CP-connected end-to-end authorisation.
