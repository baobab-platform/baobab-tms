# TMS DEV-10 — development contract, Codespaces and Shared Foundation

**Source baseline:** EA v2.3 / EA-DEV DEV-10, ADR-TMS-0001, 0010–0015,
0020 and 0021; Shared's Development Environment contract and Foundation.

## Engine versus environment

TMS's first-party experimental kernel is **Node 24** (currently standard
library JavaScript). The accepted hybrid architecture permits Fleetbase /
Fleet-Ops with isolated native MySQL and Open TMS with native PostgreSQL 17;
these are *independent execution providers*, not installed or started by
opening this Dev Container. The default development workspace uses the
reviewed baobab-dev **full** profile because it includes Node, PostgreSQL
client tooling and Docker tooling. It never presents successful Node syntax
checks as a booking, transport provider, CP authority or EA-09 certification.

Trade is the analogous Node 24 headless engine and the development-environment
shape reference. TMS intentionally uses **npm**, not Trade's Medusa runtime
or its business capabilities. The original TMS `*.example` files are historical
templates, not activated contracts.

## Deterministic onboarding

- `.node-version` pins Node 24.21.0, matching the reviewed v1.4.4 image.
- `package-lock.json` v3 locks the current empty third-party dependency graph.
  Never replace `npm ci` with `npm install` on failure. A future dependency
  or package manager addition needs the reviewed owner lock and regression tests.
- `.devcontainer/devcontainer.json` pins the published **immutable manifest
  digest** and non-root `vscode` user. It uses a reviewed Docker-outside-of-Docker
  feature for **manual** isolated native test profiles, not for automatic
  native authority/provisioning. Default startup cannot claim a real provider.
- The post-create lifecycle runs `baobab-verify --contract`, verifies the exact
  Node version, runs `npm ci --ignore-scripts --no-audit --no-fund` and
  `npm run check`. `waitFor: postCreateCommand` prevents early editor-ready
  claims. Port 4080 and any incidental forwarded ports are **private**.
- No TMS domain dependencies, database migration, native provider, IAM/CP
  credentials, synthetic legal authority or browser tokens are auto-provisioned.
  The localhost development server's `/readyz` remains 503 by design.

## CI responsibilities

`foundation.yml` calls the **immutable Shared Foundation** full-profile
workflow. The repository metadata marks Node, npm, full baobab-dev
requirements and an experimental engine with no released TMS container. It
routes baseline, frozen-lock reproducibility, Node runtime syntax, development
environment/image contract, public-repository CodeQL SAST, dependency review
and portable security controls through the Shared policy.

`dev10-environment.yml` independently runs the frozen Node test suite and
a non-root, copy-owned, exact-image container lifecycle from a read-only
checkout. Its Actions GHCR token is **not** an actual hosted Codespaces user's
image/npm package entitlement. Existing reusable Shared secret scanning,
action SHA-pinning and Dependabot configuration enforcement remain active.
The TMS-specific native PostgreSQL/MySQL/HYB suites remain separate; none
are silently replaced by DEV-10 green checks. No Python/Java/Rust release
workflow is activated merely because upstream providers use those languages.

## Qualification and rollback

Before DEV-10 closure:
1. Create a *fresh disposable* hosted Codespace under the intended developer
   identity. Verify exact digest pull, normal shell/user/UID, frozen startup,
   noninteractive behavior and private GHCR/npm access as applicable.
2. Run `npm run check`; qualify any adopted HYB native service against its
   own approved data-plane profile and current IAM/CP, *not* against the
   liveness-only Node kernel.
3. Exercise a rollback to the previous reviewed image digest and matching
   project pins/lock. Verify frozen reinstall, private port defaults,
   teardown and independent clean resource readback.
4. Record source SHA, image digest, execution identity (not credential),
   observed Node/npm, test jobs, current provider scope, denial cases,
   evidence hashes and cleanup. Secure receipts in independent custody.

Do **not** reuse a PostgreSQL 16 physical volume as PostgreSQL 17 storage.
Do not put GHCR/npm tokens into source, image build args, screenshots, logs or
tracked dotenv. User Codespaces credentials must be granted independently
of the CI Actions identity.

**Acceptance limit:** source and Actions checks = development-toolchain
conformance only. Native HYB-02 onward, DEV-14 engine onboarding,
DEV-08 logistics operations, security/release promotion and protected
staging/production all retain separate evidence and approval gates.
