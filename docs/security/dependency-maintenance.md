# BA-SEC-DEP-001 — baobab-tms dependency and security maintenance audit

**Review date:** 7 November 2026. **Repository:** `baobab-platform/baobab-tms`. **Status:** SOURCE_COMMITTED only.

## Observed manifests and Dependabot coverage

GitHub Actions /; npm / (root package.json). The package currently declares no third-party npm dependencies, and there is no committed package-lock.json. There are no local runtime Dockerfile or Compose manifests in main.

## Actual dependency/security surveillance

Daily source guard inspects all npm dependency classes and fails on untracked third-party dependencies; it deliberately does not claim an npm audit on an empty dependency graph. The existing pure Node 24 unit/negative tests remain intact.

## Findings, unqualified boundaries and exception custody

The source is classified experimental with no live runtime. config/hybrid/upstreams.lock.json pins Fleetbase/fleetops/open_tms source proposals and explicitly says UNQUALIFIED; these external systems have their own dependency trees that cannot be scanned by this repository's npm Dependabot entry. PR #29 develops native tooling, PR #28 identity fencing; neither is merged or treated as accepted. Activation requires committed npm lock + real audit if dependencies appear, container provenance for adopted systems, IAM/CP booking authority and independent provider leases and replay.

**Current disposition:** Experimental-only maintenance; native booking, carrier execution and provider acceptance unqualified.

## Governance and evidence levels

Governing authority: [approved BA-SEC-DEP-001 v1.0, Shared #429](https://github.com/baobab-platform/shared/pull/429). The proposed stricter Shared validator is NOT released; this branch uses the SHA-pinned accepted Shared v2.3.0 structural validator and an owner-local positive/negative source suite. Weekly Monday Africa/Johannesburg version updates are distinct from advisory-driven security response. Routine groups apply only to minor/patch version-updates; major or security updates require independent review.

Evidence state **SOURCE_COMMITTED** means source reviewed/committed, not executed. **CI_VERIFIED**, **SECURITY_ALERT_PATH_VERIFIED**, **CONSUMER_QUALIFIED**, **STAGING_VERIFIED**, and **PRODUCTION_VERIFIED** are NOT claimed. Findings are **BLOCKED** pending an independently approved remediation or expiring exception. **WAIVED is not PASSED**. Security CODEOWNERS review applies to manifest and exception changes.

## Exit criteria

1. Run the actual final-head policy regression and accepted Shared validator; inspect live GitHub Dependabot job logs, dependency graph, Alerts, automatic security update settings and actual dependency scan results.
2. Repair reported security vulnerabilities promptly using real installed package/image provenance; independent time-bounded evidence and Security approval are required for any unpatched exceptions. Do not permit scanner errors, no-ops or ignored advisories to appear as success.
3. Re-run owner-specific native runtime, IAM/CP authority, supplier/consumer isolation, replay, migration and negative acceptance tests after a major or security update. No synthetic PSP, carrier, rule or issuer success counts as a real integration.
4. Obtain separate staging/production approvals and deployment evidence. No protected environment, credential, provider or release is activated by this policy adoption.

No CI run or monitoring, PR merge or protected business approval has been claimed.
