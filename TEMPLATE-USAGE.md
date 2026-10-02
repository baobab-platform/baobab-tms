<!--
Target path: baobab-platform/engine-template/TEMPLATE-USAGE.md

This file exists ONLY in the template and in a newly-created repository while
that repository is being activated. Delete it from the generated repository
after the activation checklist is complete.

Current platform snapshot when this guide was last reconciled: 2026-09-29.

At that point:
  - GitHub organisation: baobab-platform
  - Baobab metadata directory: .baobab/
  - shared stable release: v2.3.0
  - shared v2.3.0 commit:
      31de2bc3dcd56128c019c640dc7e12c10ae9ca69
  - baobab-dev stable release: v1.4.4
  - Foundation: capability-driven Foundation v2.x
  - Foundation repository contract:
      baobab-platform/shared/.baobab/repository.schema.json
  - Development Environment Contract:
      baobab-platform/shared/contracts/development-environment/schema.yaml
  - Capability Provider contract:
      baobab-platform/shared/contracts/capability/v1/provider-declaration.schema.json

DO NOT treat the version numbers above as permanent. Before creating a new
repository, verify the current approved stable releases and immutable commit
pins.
-->

# Using the Baobab engine template

This template bootstraps a new **Baobab headless engine repository**.

The objective is not merely to generate files. A repository created from this
template must enter the Baobab ecosystem with the correct:

- repository identity;
- architecture boundary;
- ownership;
- development environment contract;
- Foundation classification;
- CI/security posture;
- capability-provider declaration;
- canonical contract dependencies;
- branch governance; and
- provider-neutral Control Plane boundary.

Do not begin substantial application implementation until the repository
foundation described below is coherent.

---

# 1. Before creating the repository

Verify the current platform baselines rather than copying version numbers from
this template.

At minimum, check:

```bash
gh release view \
  --repo baobab-platform/shared \
  --json tagName,targetCommitish

gh release view \
  --repo baobab-platform/baobab-dev \
  --json tagName,targetCommitish
```

For reusable GitHub Actions workflows, resolve the selected `shared` release
to an **immutable 40-character commit SHA**.

Do not call Foundation using:

```yaml
@main
```

or a mutable branch reference.

The organisation's action-pinning policy requires immutable action/workflow
references.

At the time this file was last reconciled, the approved baseline was:

```text
shared:
v2.3.0
31de2bc3dcd56128c019c640dc7e12c10ae9ca69

baobab-dev:
v1.4.4
```

---

# 2. Create the repository

The organisation is:

```text
baobab-platform
```

not:

```text
nabhold
```

Create the repository from the template:

```bash
gh repo create baobab-platform/<engine-repo-name> \
  --template baobab-platform/engine-template \
  --private
```

Use `--public` only where public visibility is a deliberate product,
open-source or ecosystem decision.

The default branch is:

```text
main
```

Engine repository names should normally be:

```text
short

lowercase

hyphenated

technology-neutral
```

Examples:

```text
baobab-trade
baobab-erp
baobab-cms
baobab-pulse
baobab-iam
baobab-regulations
```

Avoid technology-derived engine identities such as:

```text
baobab-medusa
baobab-ory
baobab-payload
```

because implementation providers may change without changing the engine's
domain identity.

---

# 3. Run the legacy-name hygiene check immediately

The organisation migration from:

```text
nabhold
```

to:

```text
baobab-platform
```

and metadata-directory migration from:

```text
.nabhold/
```

to:

```text
.baobab/
```

must be complete in every new repository.

Before the first PR:

```bash
rg -n \
  'nabhold|\.nabhold|ghcr\.io/nabhold|@nabhold/' \
  .
```

Review every result.

A new repository should not retain stale operational references to:

```text
nabhold/shared
nabhold/baobab-dev
@nabhold/platform-engineering
@nabhold/security
.nabhold/
ghcr.io/nabhold/
```

Historical ADR text may legitimately mention the former organisation where
history itself is being documented, but active configuration must use
`baobab-platform`.

---

# 4. Establish the engine architecture boundary

Before application code, determine what the engine:

```text
owns
```

and equally importantly what it:

```text
does not own.
```

Update `README.md` accordingly.

The README must identify:

- engine mission;
- canonical bounded context;
- objects/data this engine owns;
- responsibilities explicitly owned by other engines;
- relevant platform integrations;
- contract dependencies;
- current implementation status;
- local development status.

Do not leave template placeholder prose.

For a headless engine, explicitly preserve Baobab's architectural principle:

> **Standardise the contracts, not the implementations.**

Technology providers belong behind provider-neutral engine boundaries.

---

# 5. Establish ADR ownership correctly

Baobab now uses both **cross-platform ADRs** and **engine-local ADRs**.

Do not treat those as competing ADR logs.

## Cross-platform / canonical-contract decisions

Place decisions in:

```text
baobab-platform/shared
```

when they change matters such as:

```text
canonical contracts

cross-engine semantics

organisation-wide governance

Foundation policy

shared capability definitions

platform-level integration boundaries.
```

## Engine-local decisions

Place engine-specific architectural decisions in:

```text
<engine>/docs/adr/
```

when they govern:

```text
the engine's bounded context

internal architecture

provider choices

domain model

persistence model

engine-specific workflows

engine-specific runtime behaviour.
```

A new engine will normally have a repo-local foundational ADR defining its
mission and boundary.

If creation of the engine itself changes Baobab's platform architecture or
canonical contracts, the corresponding cross-platform decision must also be
represented in `shared`.

Do not assume that all engine ADRs belong in `shared`.

---

# 6. Fix CODEOWNERS before the first PR

The current organisation ownership convention is:

```text
@baobab-platform/platform-engineering

@baobab-platform/security
```

A minimal engine CODEOWNERS baseline is:

```text
* @baobab-platform/platform-engineering

/.github/ @baobab-platform/platform-engineering @baobab-platform/security

/.devcontainer/ @baobab-platform/platform-engineering

/.baobab/ @baobab-platform/platform-engineering

/Dockerfile @baobab-platform/platform-engineering @baobab-platform/security

/SECURITY.md @baobab-platform/security
```

Add engine-specific ownership rules when appropriate.

Do not retain:

```text
@nabhold/...
```

or:

```text
/.nabhold/
```

from historical template generations.

---

# 7. Activate `.baobab/repository.yaml` immediately

Foundation v2 is capability-driven.

The repository contract is now the primary machine-readable declaration of:

```text
what this repository technically is

which Foundation controls apply

whether it produces a container

which development environment it requires

which SAST policy applies.
```

Do not wait for application implementation before creating this file.

Rename:

```text
.baobab/repository.yaml.example
```

to:

```text
.baobab/repository.yaml
```

For a documentation/scaffold-only engine, a suitable starting shape is:

```yaml
schema_version: 1

repository:
  lifecycle: experimental

capabilities:
  - engine
  - documentation

environment:
  baobab_dev:
    required: false

artifacts:
  container: false

security:
  sast_provider: fallback
```

As implementation begins, update this declaration rather than bypassing it.

---

# 8. Understand `repository.yaml` capabilities

The `capabilities` in `.baobab/repository.yaml` are **Foundation technical
classifications**.

Current examples include:

```text
python
node
go
java
rust
container
infrastructure
documentation
contracts
github-actions
digital-estate
engine
library
development-environment
```

They are **not** Baobab domain capabilities.

For example:

```yaml
capabilities:
  - python
  - container
  - engine
```

means:

> this repository is a Python engine producing a container.

It does not mean:

> this engine provides a domain capability called `python`.

---

# 9. Declare package managers explicitly

Once application code exists, declare relevant package-manager ownership.

Examples:

```yaml
package_managers:
  python: uv
```

```yaml
package_managers:
  node: pnpm
```

```yaml
package_managers:
  java: maven
```

The declaration must correspond to the runtime capability.

Do not declare:

```yaml
package_managers:
  python: uv
```

without:

```yaml
capabilities:
  - python
```

Foundation validates this relationship.

---

# 10. Activate Foundation CI at scaffold stage

The old template delayed Foundation until application code existed.

That is no longer necessary.

Foundation v2 can classify an empty/scaffold repository using
`.baobab/repository.yaml`.

Rename:

```text
.github/workflows/foundation.yml.example
```

to:

```text
.github/workflows/foundation.yml
```

and replace the old Foundation v1 caller with the current Foundation v2 shape.

At the time this template was last reconciled:

```yaml
name: Foundation Repository Gates

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: "23 5 * * 1"
  workflow_dispatch:

permissions:
  contents: read
  packages: read
  actions: read
  security-events: write

jobs:
  foundation:
    uses: baobab-platform/shared/.github/workflows/foundation-repository-gates.yml@31de2bc3dcd56128c019c640dc7e12c10ae9ca69
    with:
      foundation_ref: "31de2bc3dcd56128c019c640dc7e12c10ae9ca69"
      dependency_review_enabled: false
```

Before committing this workflow:

1. resolve the current approved `shared` release;
2. replace **both** references with the same exact immutable commit;
3. verify the reusable workflow remains compatible.

`foundation_ref` is deliberately explicit.

Foundation uses that exact revision to load canonical policy files.

Do not let:

```text
workflow implementation
```

and:

```text
policy files
```

come from different revisions.

---

# 11. Understand Foundation v2

The Foundation caller is no longer a single hard-coded build recipe.

Foundation classifies the repository from:

```text
.baobab/repository.yaml
```

and repository evidence.

The full profile currently composes gate families for:

```text
classification

baseline

reproducibility

runtime

development environment

security

container policy
```

as applicable.

The security family includes portable and capability-specific controls such as:

```text
dependency vulnerability scanning

native package-manager dependency checks

secret scanning

misconfiguration scanning

SAST policy

dependency review where available.
```

The container family includes, where applicable:

```text
container build validation

base-image policy

runtime non-root checks

HEALTHCHECK validation

Trivy vulnerability scanning

SPDX SBOM generation.
```

Do not reproduce those same checks in a new repository merely because an
older Baobab repository still has migration-era standalone workflows.

Repository-specific security workflows remain valid when they add checks
Foundation does **not** provide.

---

# 12. Legacy standalone security examples

Older generations of `engine-template` shipped files such as:

```text
security-codeql.yml.example

security-python.yml.example

security-secrets-scan.yml
```

Foundation v2 now provides the organisation-level SAST, dependency, secret and
portable security baseline through the capability-driven Foundation workflow.

For a **new** engine:

> Do not automatically activate standalone security workflows that merely
> duplicate Foundation v2.

Retain or add repo-local security workflows only when they provide additional,
engine-specific controls.

Examples might include:

```text
custom policy tests

engine-specific integration security tests

specialised supply-chain verification

protocol fuzzing

domain-specific security invariants.
```

---

# 13. Configure SAST through `.baobab/repository.yaml`

Foundation v2 supports:

```text
codeql

fallback

disabled
```

through:

```yaml
security:
  sast_provider: ...
```

## Public repository

A public repository may use:

```yaml
security:
  sast_provider: codeql
```

where the implementation language is supported by CodeQL.

## Private repository without approved GHAS

Use:

```yaml
security:
  sast_provider: fallback
```

Foundation still runs its portable security controls.

## Private repository with approved GHAS

A private repository using CodeQL must record the approval in the repository
contract:

```yaml
security:
  sast_provider: codeql
  ghas:
    reason: "<reviewed justification>"
    expires: "YYYY-MM-DD"
    approved_by: "@<approved-handle>"
```

Do not use the deprecated Foundation input:

```text
advanced_security_enabled
```

for new repositories.

## Disabled SAST

`disabled` requires an approved, time-bounded:

```yaml
exceptions:
  sast:
    ...
```

record.

It is not the normal configuration.

---

# 14. Configure dependency review deliberately

For the Foundation caller:

```yaml
dependency_review_enabled: true
```

is appropriate when GitHub dependency review is available.

Currently:

```text
public repository
→ available without GHAS

private repository
→ requires approved GHAS
```

For a private repository without the required GitHub capability, do not turn
the input on and hope CI skips it.

Foundation will detect the mismatch.

Portable and ecosystem-specific dependency scans remain part of Foundation
security independently.

---

# 15. Foundation exceptions are governed data

Do not bypass Foundation by editing workflow logic such as:

```yaml
if: false
```

or removing checks.

Foundation v2 supports explicit, reviewable, expiring exceptions in:

```text
.baobab/repository.yaml
```

Example:

```yaml
exceptions:
  container-scan:
    reason: "Temporary upstream vulnerability with no deployable patched image."
    expires: "2026-10-31"
    approved_by: "@approved-handle"
```

Supported exception keys are defined by the canonical Shared repository
schema.

Every exception requires:

```text
reason

expiry

approver.
```

Expired exceptions fail validation.

Foundation also emits exception evidence.

Release pipelines may require:

```yaml
release_require_zero_exceptions: true
```

where zero active exceptions are required for release.

---

# 16. Keep action pinning and Dependabot conformance current

The template's standalone policy workflows remain useful:

```text
Enforce Action Pinning

Enforce Dependabot Config
```

but their reusable-workflow pins must track the current approved immutable
`shared` revision.

Do not retain the former:

```text
v1.2.0

38defb11aacd95a6f68b7db8026fe336417a2af6
```

pin in a newly-created repository.

At the current baseline both should resolve to the same approved Shared
Foundation revision used by `foundation.yml`.

The repository's workflows must use full commit-SHA pinning for external
actions.

---

# 17. Dependabot starts small and evolves with the repository

The scaffold can begin with:

```text
github-actions
```

dependency updates.

Once the application stack exists, add the applicable ecosystems such as:

```text
pip / uv-supported Python dependency strategy

npm / pnpm ecosystem

gomod

maven

docker

github-actions
```

according to the repository's actual build.

Do not add ecosystems the repository does not use merely to satisfy a copied
configuration.

The conformance workflow validates structural requirements.

---

# 18. Application CI is still repository-owned

Foundation does not replace application CI.

Every implemented engine must have its own:

```text
.github/workflows/ci.yml
```

or equivalent application workflow covering the engine's actual build.

Depending on the technology, that normally includes:

```text
format validation

linting

type checking

unit tests

contract tests

integration tests

build

migration validation

engine-specific architecture checks.
```

Foundation answers:

> **Does this repository satisfy Baobab's organisation-wide engineering and
> security controls?**

Application CI answers:

> **Does this engine itself work correctly?**

Both matter.

---

# 19. Apply branch governance

Protect:

```text
main
```

using the organisation's current branch/ruleset policy.

At minimum:

- require pull requests before merge;
- require at least one approval;
- require CODEOWNER review;
- dismiss stale approvals after new commits;
- require conversation resolution;
- require branches to be up to date;
- block force pushes;
- block deletion of `main`;
- apply governance to administrators unless an audited emergency bypass is
  intentionally configured;
- require Foundation;
- require application CI once application CI exists.

Do not guess a required-check context before the workflow has run.

Run Foundation successfully at least once, then select the actual aggregate
check emitted by GitHub.

Foundation v2 currently exposes the aggregate:

```text
Foundation / Result
```

within the `foundation` reusable-workflow job hierarchy.

Use the exact check context displayed by GitHub.

If the repository retains dedicated policy checks such as:

```text
Enforce Action Pinning

Enforce Dependabot Config
```

consider those part of the required repository-governance set as well.

---

# 20. Private reusable-workflow access

Many Baobab repositories may be private.

A private consumer can call reusable workflows from:

```text
baobab-platform/shared
```

only when the GitHub Actions access policy for `shared` permits the consuming
repositories.

If a reusable-workflow call reports that the workflow:

```text
was not found
```

or:

```text
is not accessible
```

check organisation/repository Actions access before rewriting the workflow.

Do not work around an Actions-access problem by copying Shared's reusable
workflow into the engine repository.

That would fork the organisation policy.

---

# 21. Choose the development environment only when the stack is known

Once implementation begins, determine the engine's real language/toolchain.

Then activate:

```text
.baobab/environment.yaml
```

from:

```text
.baobab/environment.yaml.example
```

The available Baobab development profiles currently are:

| Profile | Intended role |
|---|---|
| `full` | Multi-language/backend application environment |
| `frontend` | Node/pnpm/Turborepo daily frontend development |
| `frontend-e2e` | CI-only extension containing browser/E2E tooling |
| `infra` | Terraform/AWS infrastructure development |

Select the **narrowest valid profile**.

Do not use:

```text
full
```

merely because it contains the most software.

Do not use:

```text
frontend-e2e
```

as a repository's normal Codespaces/devcontainer profile.

It is intended for CI jobs that genuinely need browser tooling.

---

# 22. Current `baobab-dev` baseline

Foundation maintains a canonical environment-profile catalogue in:

```text
baobab-platform/shared/.baobab/environment-profiles.json
```

At the time this guide was reconciled, every profile required at least:

```text
baobab-dev 1.4.4
```

with images:

```text
full:
ghcr.io/baobab-platform/baobab-dev:1.4.4

frontend:
ghcr.io/baobab-platform/baobab-dev:1.4.4-frontend

frontend-e2e:
ghcr.io/baobab-platform/baobab-dev:1.4.4-frontend-e2e

infra:
ghcr.io/baobab-platform/baobab-dev:1.4.4-infra
```

Verify the current catalogue before activating a new repository.

Do not assume `1.4.4` remains current indefinitely.

---

# 23. Activate `.baobab/environment.yaml`

A backend engine might begin conceptually with:

```yaml
schema:
  name: "baobab-platform-development-environment-contract"
  version: "1.0"

application:
  name: "<engine-repo-name>"
  version: "0.1.0"

environment:
  provider: "baobab-dev"
  profile: "full"
  minimum_version: "<current-approved-version>"
  contract_minimum_version: "1.0"

compatibility_policy:
  strict_runtime_versions: true
  allow_newer_patch_versions: true
  allow_newer_minor_versions: false
  allow_older_versions: false

validation:
  required_capabilities:
    - "development.github_cli"

notes:
  - "<engine-specific environment note>"
```

Add only the development capabilities the engine genuinely requires.

Examples include:

```text
languages.python
languages.node
languages.java
database.postgresql
development.docker
development.maven
```

These names come from `baobab-dev`'s declared capabilities.

Do not invent capability names.

---

# 24. Keep `repository.yaml` and `environment.yaml` consistent

Once:

```yaml
environment:
  baobab_dev:
    required: true
```

is declared in `.baobab/repository.yaml`, that contract must also identify the
same profile:

```yaml
environment:
  baobab_dev:
    required: true
    profile: full
```

and:

```text
.baobab/environment.yaml
```

must exist.

Foundation verifies that the two profile declarations agree.

---

# 25. Do not falsely declare a tool provided by `baobab-dev`

If an engine needs a runtime/tool not provided by the chosen `baobab-dev`
profile, layer that requirement deliberately through the devcontainer or
another approved mechanism.

Do not claim in:

```text
environment.yaml
```

that `baobab-dev` provides a capability it does not provide.

Current Control Plane precedent, for example, layers Go into the development
environment rather than pretending it is supplied natively by the selected
`baobab-dev` profile.

---

# 26. Activate the devcontainer

Rename:

```text
.devcontainer/devcontainer.json.example
```

to:

```text
.devcontainer/devcontainer.json
```

Choose between two patterns deliberately.

## Pattern A — image-based

Use when the engine does not need automatically-started local backing
services.

Conceptually:

```json
{
  "name": "<Engine>",
  "image": "ghcr.io/baobab-platform/baobab-dev:<approved-version>",
  "remoteUser": "vscode"
}
```

## Pattern B — Compose-backed

Use when opening the repository should also start development services such
as:

```text
PostgreSQL

Redis

queue/broker

other local engine dependencies.
```

In this pattern, keep the development compose configuration under:

```text
.devcontainer/
```

where practical, and ensure it explicitly contains the approved
`baobab-dev` image.

Foundation validates that the expected development image is represented in the
`.devcontainer` configuration.

Do not create a devcontainer whose actual toolchain silently differs from:

```text
.baobab/environment.yaml
```

---

# 27. Development environment image and declaration must match

If:

```yaml
minimum_version: "1.4.4"
profile: "full"
```

then the corresponding devcontainer configuration must use the matching image
family:

```text
ghcr.io/baobab-platform/baobab-dev:1.4.4
```

For a frontend profile:

```text
ghcr.io/baobab-platform/baobab-dev:1.4.4-frontend
```

and so forth.

Foundation validates this relationship.

---

# 28. Activate application capabilities in `repository.yaml`

As code appears, update the technical classification.

For example, a Python runtime engine producing a container might declare:

```yaml
schema_version: 1

repository:
  lifecycle: experimental

capabilities:
  - python
  - container
  - documentation
  - engine

package_managers:
  python: uv

environment:
  baobab_dev:
    required: true
    profile: full

artifacts:
  container:
    enabled: true
    dockerfile: Dockerfile
    context: .
    runtime: true

security:
  sast_provider: fallback
```

Do not rely on a Foundation workflow input to describe the container.

Foundation v2 takes canonical container coordinates from:

```text
.baobab/repository.yaml
```

---

# 29. Container policy

If the repository produces a runtime container:

```yaml
capabilities:
  - container
```

must be present and:

```yaml
artifacts:
  container:
    enabled: true
    dockerfile: Dockerfile
    context: .
    runtime: true
```

should describe it.

Foundation currently validates matters including:

```text
Dockerfile existence

repository-relative paths

no unqualified/floating `latest` or `edge` base image

container build success

OCI metadata

runtime non-root USER

runtime HEALTHCHECK

HIGH/CRITICAL vulnerability policy

SPDX SBOM generation.
```

Runtime images must carry OCI labels including:

```text
org.opencontainers.image.source

org.opencontainers.image.version

org.opencontainers.image.revision.
```

Foundation validates containers.

It does **not** automatically define or publish the engine's production image
release workflow.

That remains repository-specific.

---

# 30. Release workflow is an application decision

Do not activate:

```text
release.yml.example
```

blindly.

First decide what the engine actually publishes:

```text
container image

Python package

Node package

Java artifact

documentation only

nothing yet.
```

For runtime containers, the release design should normally consider:

```text
immutable versioning

GHCR publication

SBOM

signature

provenance

release evidence.
```

Foundation provides validation controls but is not the engine's artifact
publisher.

---

# 31. Documentation publishing is optional

Activate:

```text
pages.yml.example
```

only if this repository actually publishes a documentation site using the
current organisation documentation toolchain.

An engine does not need GitHub Pages simply because the template contains an
example workflow.

---

# 32. The three `.baobab` declarations are different

These contracts answer different questions.

Never copy capabilities from one into another.

| File | Question | Meaning of “capability” |
|---|---|---|
| `.baobab/repository.yaml` | What kind of repository is this and which Foundation controls apply? | Technical traits such as `python`, `go`, `container`, `engine` |
| `.baobab/environment.yaml` | What does the development toolchain need to provide? | `baobab-dev` capabilities such as `languages.python`, `database.postgresql` |
| `.baobab/capability-provider.yaml` | Which Baobab domain capabilities does this engine implement or plan? | Canonical Shared capability keys |

These are deliberately different contracts.

---

# 33. Activate the capability-provider declaration when domain scope is known

Rename:

```text
.baobab/capability-provider.yaml.example
```

to:

```text
.baobab/capability-provider.yaml
```

when the engine's domain capabilities are sufficiently defined.

Canonical capability keys come from:

```text
baobab-platform/shared/contracts/capability/v1/catalogue.yaml
```

The engine does not invent canonical capability semantics locally.

---

# 34. Planned capabilities are not implemented capabilities

An architecture-only/scaffold repository may declare:

```text
planned_capabilities
```

without falsely claiming an implementation exists.

For capability proposals that are not yet canonical, use a:

```text
proposed_key
```

and the correct proposal state.

Once Shared contracts the capability, use its canonical:

```text
capability_key.
```

Do not place an invented key under provider support.

---

# 35. Provider support requires evidence

A provider should claim:

```text
IMPLEMENTED
```

only when repository evidence exists.

Evidence may include:

```text
source

test

contract test

integration test

simulation

conformance fixture.
```

`capability-provider.yaml` does not certify the provider.

It does not activate the provider.

It does not create:

```text
CapabilityBinding

CapabilityGrant

EngineInstance

health status

tenant entitlement.
```

Those remain Control Plane concerns.

---

# 36. Capability-provider identity is provider-neutral

The engine ID is the repository/domain identity.

Example:

```text
baobab-regulations
```

A provider might be:

```text
baobab-regulations.opa
```

with:

```text
implementation_key: opa
```

The technology does not become part of the canonical capability key.

This enables provider migration without redefining the business capability.

---

# 37. Validate the provider declaration

Against a checkout of the current approved `shared` revision:

```bash
python3 <shared>/scripts/capability_catalogue.py \
  validate-declaration \
  .baobab/capability-provider.yaml \
  --engine-id <engine-id> \
  --repository-root .
```

Do not merge an unvalidated provider declaration.

---

# 38. Canonical contracts live in `shared`

Populate:

```text
contracts/README.md
```

with the contracts this engine:

```text
consumes

publishes

or both.
```

Canonical cross-engine schemas belong in:

```text
baobab-platform/shared
```

not copied into the engine repository.

Examples include:

```text
API schemas

event schemas

capability contracts

context contracts

identity references

error/problem contracts.
```

The engine repository may contain:

```text
generated types

validation adapters

contract tests

consumer fixtures
```

derived from canonical Shared contracts.

It must not fork them.

---

# 39. Contract changes happen in the authority repository first

If implementation requires changing a canonical cross-engine contract:

```text
do not edit a copied local schema.
```

Instead:

```text
Shared change
    ↓
review / ADR where required
    ↓
versioned canonical contract
    ↓
consumer update
    ↓
engine implementation.
```

This preserves provider-neutral platform semantics.

---

# 40. Application CI and contract tests

Once contracts exist, application CI should prove at least:

```text
schema validation

consumer compatibility

producer compatibility

generated-type freshness

event/API contract conformance
```

as appropriate.

Cross-repository integration assumptions should be testable rather than
document-only.

---

# 41. Keep secrets and topology out of repository contracts

None of the `.baobab` declaration files should contain:

```text
production credentials

database passwords

API secrets

private keys

live service hostnames

tenant bindings

EngineInstance endpoints.
```

Repository contracts express requirements and capabilities.

Production topology belongs to the appropriate infrastructure and Control Plane
domains.

---

# 42. Do not let the template define production topology

The engine template should not assume:

```text
AWS service

database deployment mode

Kubernetes

specific message broker

specific cloud region.
```

Those decisions belong to the engine's accepted architecture and
`baobab-platform/infrastructure`.

The template establishes engineering governance, not production topology.

---

# 43. Re-run the hygiene audit before removing this file

Before deleting `TEMPLATE-USAGE.md`, run:

```bash
rg -n \
  'nabhold|\.nabhold|ghcr\.io/nabhold|@nabhold/|38defb11aacd95a6f68b7db8026fe336417a2af6|v1\.2\.0' \
  .
```

Any remaining result must be either:

```text
intentional historical documentation
```

or corrected.

Also confirm there are no unresolved template markers:

```bash
rg -n \
  '<engine|<repo|<current|<TODO|TODO|ADR-000N' \
  .
```

Review rather than blindly deleting legitimate application TODOs.

---

# 44. Definition of an activated engine repository

A newly-created engine repository is considered template-activated when all
applicable items below are complete.

## Identity and architecture

- [ ] Repository exists under `baobab-platform`.
- [ ] Repository visibility is deliberate.
- [ ] `README.md` describes the real engine.
- [ ] Engine ownership and non-ownership boundaries are explicit.
- [ ] Repo-local ADR strategy is established.
- [ ] Required cross-platform ADRs/contracts exist in `shared`.
- [ ] No stale operational `nabhold` references remain.

## Ownership and governance

- [ ] `CODEOWNERS` uses current `@baobab-platform/...` teams.
- [ ] `main` branch governance is configured.
- [ ] PR review and CODEOWNER review are required.
- [ ] Force pushes/deletion of `main` are blocked.
- [ ] Required status checks are configured after their first successful run.

## Foundation

- [ ] `.baobab/repository.yaml` exists.
- [ ] Repository lifecycle is declared.
- [ ] Technical capabilities are accurate.
- [ ] Package managers are accurate where applicable.
- [ ] Container artifact declaration is accurate.
- [ ] SAST policy is explicit.
- [ ] `foundation.yml` uses the current approved immutable Shared SHA.
- [ ] `foundation_ref` matches the workflow SHA exactly.
- [ ] Foundation passes.
- [ ] Foundation aggregate result is required on `main`.

## Policy workflows

- [ ] Action-pinning workflow uses the current Shared SHA.
- [ ] Dependabot-conformance workflow uses the current Shared SHA.
- [ ] Dependabot configuration matches actual package ecosystems.
- [ ] No duplicated legacy security workflow exists without a deliberate reason.

## Development environment

When application development has started:

- [ ] `.baobab/environment.yaml` exists.
- [ ] `repository.yaml` declares `baobab_dev.required: true`.
- [ ] Both contracts declare the same profile.
- [ ] Current `baobab-dev` version is pinned.
- [ ] `.devcontainer` uses the matching profile image.
- [ ] Any non-`baobab-dev` runtime/tool layering is explicit.
- [ ] Codespaces/devcontainer creation succeeds.
- [ ] `baobab-verify` succeeds where applicable.

## Application implementation

- [ ] Repository-specific CI exists.
- [ ] Lint/test/build commands are documented.
- [ ] Application CI passes.
- [ ] Architecture/contract tests exist where appropriate.

## Platform capabilities

When domain capabilities are defined:

- [ ] `.baobab/capability-provider.yaml` exists.
- [ ] Canonical capability keys come from Shared.
- [ ] Non-canonical capabilities remain planned/proposed.
- [ ] `IMPLEMENTED` claims have repository evidence.
- [ ] Declaration validates against the Shared capability catalogue.
- [ ] No provider declaration claims certification, activation, grants or bindings.

## Contracts

- [ ] `contracts/README.md` describes real contract dependencies.
- [ ] Shared contracts are pinned/versioned appropriately.
- [ ] Canonical contracts are not copied/forked locally.

## Runtime artifact

When a container/runtime artifact exists:

- [ ] `container` capability is declared.
- [ ] `artifacts.container` describes the real artifact.
- [ ] Dockerfile uses pinned/non-floating base images.
- [ ] Required OCI labels exist.
- [ ] Runtime uses a non-root user where applicable.
- [ ] Runtime health check exists where applicable.
- [ ] Foundation container checks pass.
- [ ] Release/publish strategy is explicit.

## Final cleanup

- [ ] `.example` files that have been activated are removed.
- [ ] Unused conditional example files are removed.
- [ ] Template-only placeholder comments are removed.
- [ ] No stale Foundation v1 pins remain.
- [ ] No `.nabhold/` path remains.
- [ ] No `@nabhold/...` CODEOWNER remains.
- [ ] No `ghcr.io/nabhold/...` image remains.
- [ ] `TEMPLATE-USAGE.md` is deleted from the generated engine repository.

---

# 45. What should remain after template activation

A real engine repository should ultimately look more like:

```text
<engine>/
├── .baobab/
│   ├── repository.yaml
│   ├── environment.yaml
│   └── capability-provider.yaml
│
├── .devcontainer/
│   └── ...
│
├── .github/
│   ├── CODEOWNERS
│   ├── dependabot.yml
│   └── workflows/
│       ├── ci.yml
│       ├── foundation.yml
│       ├── enforce-action-pinning.yml
│       ├── enforce-dependabot-config.yml
│       └── <repo-specific workflows>
│
├── contracts/
│   └── README.md
│
├── docs/
│   └── adr/
│
├── <application source>
├── <tests>
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

It should **not** remain recognisably an engine-template clone with unresolved
placeholders.

---

# 46. The governing mental model

When deciding where something belongs, use this separation:

```text
.baobab/repository.yaml
        │
        └── What kind of repository is this?


.baobab/environment.yaml
        │
        └── What development toolchain does it require?


.baobab/capability-provider.yaml
        │
        └── What Baobab domain capabilities can its providers supply?


baobab-platform/shared
        │
        └── What do canonical cross-engine contracts mean?


baobab-cp
        │
        └── Which tenant may use which capability,
            through which provider/EngineInstance?


baobab-platform/infrastructure
        │
        └── Where and how does it run?


engine source code
        │
        └── How does this engine implement its bounded context?
```

Do not collapse those layers.

---

# 47. Final principle

A Baobab engine is ready to leave the template stage when:

> **its domain boundary is explicit, its repository contract is truthful, its development environment is reproducible, its platform capabilities are declared without overstating implementation, its canonical contracts remain owned by Shared, its Foundation and application CI are green, and no implementation technology has been mistaken for a Baobab domain identity.**

Delete this file from the generated repository when that statement is true.