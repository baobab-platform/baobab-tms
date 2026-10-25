# HYB-01 — Fleetbase/Fleet-Ops supported runtime qualification

**Status: IN PROGRESS / HELD** (25 October 2026). Governing Accepted ADR-TMS-0020/0021 and Shared EA v2.3. This increment is a **native source and supported-stack qualification**, NOT a licence approval, operator/capability activation or complete Fleetbase deployment.

## Canonical boundaries and decision

Use exact pinned sources `fleetbase/fleetbase@9c5e164e5476b6038d24653f6e557b43aa27959c` and `fleetbase/fleetops@33032e53ebee5e4a514970ee2379c12348c77c54`. Fleet-Ops is a PHP Composer/Laravel extension of Fleetbase, not a provider replacing TMS canonical ownership. Fleetbase’s selected runtime is PHP 8.2/FrankenPHP 1.13.2, MySQL 8, Redis queue/cache, SocketCluster authenticated realtime service, independently running application, queue and scheduler. Node 24 is suitable for the pinned socket package (engine >=22), **not** a replacement for the PHP core. No PostgreSQL port is authorised by the evidence. The precise upstream PHP requirement is `>=8.0 <8.3`, and its Dockerfile enforces PHP 8.2.35 or later due to patched 2026 vulnerabilities.

The upstream `docker-compose.yml` is insecure as a deployable Baobab baseline: `mysql:8.0-oracle` with empty root password, API/worker/scheduler `:latest`, root DB connections, Redis 4 and unauthenticated socket by default. NEVER use that upstream Compose directly for Baobab clients.

## Implemented native engineering and tests

- Immutable source and AGPL attribution verification; inspect the **actual** host `api/composer.json`, `api/composer.lock`, Fleet-Ops `composer.json`, PHP base image, Laravel/runtime assumptions and native SocketCluster lock. Print a non-secret, deterministic provenance/qualification JSON showing the **precise locked Fleet-Ops package revision**, whether it matches reviewed Git, package totals and all blocked gates. Do not pretend pinning the Fleet-Ops source checkout pins the packaged Composer dependency. Regression test on PHP drift.
- PHP syntax qualification in an ephemeral PHP 8.2.35 Docker runtime for actual pinned Fleetbase providers and Fleet-Ops server migrations. **No Composer installation or application migrations claimed.**
- Native pinned `socket/server.js` Node 24 locked `npm ci` and upstream native `npm test`, then two live socket servers with auth `enforce`, independent synthetic keys and no host port exposure.
- Real tenant A/B MySQL 8 and Redis instances on completely separate internal-only Docker networks. Verify real Redis credential challenges, own socket health and bidirectional cross-tenant socket/Redis/MySQL networking denial. Dispose of all volumes/secrets after the run.
- No official Fleetbase PHP image, third-party Docker image, unverified Composer package, source copy or external IP is admitted for protected use by the test.

## Licensing disposition — platform owner and legal gate

Both pinned repositories are AGPL-3.0-or-later. Fleetbase advertises a commercial licence for proprietary SaaS/white-label and keeping modifications private (https://fleetbase.io/licensing). There is **NO executed Baobab commercial agreement or legal approval** in this repo. AGPL-3.0 network/interoperability requirements for modified network deployments require legal assessment; do not infer from headless API boundaries alone that proprietary modifications are exempt. Record selected approved licence route, effective legal entities/territories, Fleet-Ops/core coverage, extension packages, linking/network source obligations and compliance evidence. A source census is not legal advice.

## Remaining mandatory HYB-01 qualification before any release

1. Reconcile the exact installed `fleetbase/fleetops-api` artifact from `api/composer.lock` with the separately reviewed Git source, all transitive licences and integrity data. Obtain authenticated vendor package availability without leaking secrets as Docker `--build-arg`; use BuildKit secrets or proper package credentials.
2. Build the actual supported **patched** Fleetbase API container reproducibly, run secure Composer install, Laravel package discovery and Fleet-Ops migrations against a real dedicated MySQL 8 database with least-privileged runtime role, and collect version/digest/SBOM/CVE and source attestation. The vendor install-smoke test says private package credentials may be required. Never declare success when skipped for absent credentials.
3. Qualify native HTTP dispatch/assignment, current permissions, queue, scheduler, retry/DLQ, socket subscription/tenant channel, published events, credential revocation, storage and restore/teardown on two isolated deployments. CP governs tenant, legal entity, market, capability and native binding; do not infer a CP Tenant from Fleetbase Company.
4. Conduct independent licencing/security review and record approved AGPL or executed commercial route. Enforce CP/IAM binding and negative cross-tenant proof at native execution; no live Fleetbase capability grant before acceptance.

**Exit status:** HYB-01 remains HELD until all prerequisites succeed. The test suite is designed to prove only its specifically executed native components, not Fleet-Ops operating features or production readiness.

**Authoritative references:** Accepted ADR-TMS-0020 and ADR-TMS-0021, pinned source and lock; Fleetbase official https://fleetbase.io/licensing and https://fleetbase.io/docs/platform/getting-started/architecture.
