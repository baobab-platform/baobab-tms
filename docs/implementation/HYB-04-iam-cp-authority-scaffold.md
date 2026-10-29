# HYB-04 — IAM-to-CP Native Execution Authority (Scaffold)

> **29 October 2026 audit reconciliation:** Shared #409 is accepted development design (merge `84c392105046406f190ee0fe87006ce3510760ef`), outside active contracts/registries; Shared #413 design acceptance is merged at `1fce3c36783310f33d79ba0996a996d00c4c5abe`. The Platform Owner authorised reviewed CI-green source merges. Historical proposal/no-merge statements below describe the original submission, not current governance. Runtime IAM/CP authority, carrier effects and provider activation remain HELD. These source/fixture artifacts cannot qualify an EA-XB operational case.

**Governing:** Accepted ADR-TMS-0010/0013/0020/0021. **Status:** NON-EXECUTABLE PORT, integration HELD. Separate from the HYB-03 lifecycle draft in open PR #19.

Fleetbase driver users, native Fleet-Ops companies and Open TMS organisation IDs are not Baobab IAM Principals or CP Tenant authority. The new authority component requires independently configured IAM token verification and CP-current context redemption functions, an explicitly accepted workload issuer, a service audience, canonical legal/market/organisation scope, exact native binding/revision and operation, a pinned plan digest and short decision expiry.

The verifier is always called before CP; both are rechecked for every assessment. Wrong issuer/audience, native human token, revoked/expired identity, wrong Tenant/Organisation/legal entity/Market, stale revision, cross-provider scope and forged extra request fields fail closed. No native credential or bearer is returned.

**Crucial:** Positive test responses produce only PROOF_ONLY_NOT_EXECUTABLE, canExecute=false and canActivate=false. The execute function always refuses. Tests provide a synthetic IAM verifier and synthetic CP response; there is NO real IAM-issued workload, CP authenticated API, native dispatch, Fleetbase commercial licence approval or CP capability activation. Callback and result field names are provisional internal TMS port contracts, not new Shared schemas and not a claim about existing CP endpoints.

Before deployment, reconcile the actual accepted CP/IAM context/capability/provisioning contracts, implement authenticated verified-client wiring, enforce authoritative revocation and fencing at native execution and independently test cross-tenant negative cases against disposable real CP/IAM. Existing first-party TMS identity and native-provider selection remain separate. Do not promote synthetic tests to release qualification.

**Explicit user merge hold:** keep PR #19 and this companion PR open. Do not merge any PR until directly authorised.
