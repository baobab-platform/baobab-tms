# ADR-TMS-0021 — Hybrid Provider Isolation, Capability Allocation and Lifecycle Governance

**Status:** Accepted — Authoritative Tenant/Provider Lifecycle and Execution Safety Decision  
**Decision date:** 2026-10-25  
**Decision owner:** Baobab Platform Owner / Enterprise Architecture  
**Repository:** baobab-platform/baobab-tms  
**Companion:** ADR-TMS-0020 (Accepted hybrid runtime and database choice)  
**Affected:** baobab-cp, baobab-iam, baobab-subscriptions, shared, infrastructure, baobab-trade, baobab-erp, baobab-trade-docs, baobab-regulations, thamani, zuribeans and other entitled Digital Estates  
**Normative:** Accepted ADR-TMS-0001/0002; Accepted ADR-SHARED-017/018/021; current Shared context, mapping, topology, provisioning, event and programme decisions; Accepted ADR-IAM-0033; accepted CP/onboarding/approval architecture  
**Amends:** Proposed ADR-TMS-0009/0010/0011/0012/0013/0014/0015/0016/0017/0018 where a native hybrid-provider lifecycle refinement is needed, without changing their Proposed status  
**Implementation status:** Decision ACCEPTED; no evidence of working certified hybrid TMS, live carrier or production isolation is created by this document

---

## 1. Executive decision

Baobab Control Plane (CP) SHALL govern the **tenant lifecycle, Organisation/LegalEntity/Market authority, ProductSubscription entitlement, capability resolution, engine topology, provider certification, desired state, provisioning plans, activation and deprovisioning**. Baobab IAM SHALL authenticate human/workload callers and federate identity. Baobab TMS SHALL enforce **logistics-domain resource/action policy and allocate transport execution to certified native provider adapters**.

Fleetbase Fleet-Ops and Open TMS SHALL never become independent canonical tenant/Organisation sources merely because they create native "organization" records. A native organisation, database, role, driver, customer, carrier, booking or shipment SHALL be an **externally mapped provider resource** with scoped lifecycle and verifiable ownership, not a platform-wide identity.

Every native provider resource, credential, event route and query SHALL be associated with a governed binding to a CP-authorised tenant and its operating Organisation/LegalEntity, environment, provider release, residency/isolation profile and permitted transport capability/action. Multi-tenant isolation is enforced at **all layers** including provider-native data, caches, queues, workers, sockets and backups, not just in a Go router.

Provisioning in normal development MAY be automatic under accepted development-only authorisation profiles and synthetic test identities, consistent with the platform's differentiated development versus staging/production policy. Staging/production activation, independent changes, protected data or regulated activity remain separately governed. Do not turn every development fixture into an artificial independent-human approval dependency; never bypass an actually required production maker/checker, credential or legal gate.

## 2. Authority and four-level execution model

Distinguish four objects that frequently get conflated:

| Level | Canonical owner | Identity/example | Meaning |
|---|---|---|---|
| Tenant and legal operating context | CP | tenant_id, primary Organisation UUID, legal_entity_id, MarketParticipation, context_id | Who is entitled and under what authority |
| Platform capability provider | CP registry + Shared contract | capability logistics.shipment.manage; CP CapabilityProvider baobab-tms; TMS EngineInstance | Which first-party engine instance may receive canonical requests |
| TMS native execution adapter | baobab-tms | fleetbase-fleetops / open-tms release, operation, deployment | How TMS executes a portion of a governed plan |
| Real carrier/driver/operator | Real-world organisation/approved owner; referenced by CP/TMS | CarrierReference, native vendor carrier/vehicle/driver | Who physically moves goods or supplies carrier capacity |

**Invariant:** An Open TMS Carrier is NOT a CP CapabilityProvider; a Fleetbase "company" is NOT a Baobab Tenant; a native JWT is NOT a canonical CP Principal; a CP EngineInstance ID is NOT a Shipment or Plan ID.

CP resolves the first-party canonical TMS provider, while TMS resolves native adapter selection per operation/leg. CP MUST receive enough independently observed instance release/health/capability status to certify, suspend or retire the overall provider. Native adapter health MAY be projected to CP under approved topology/health contracts; it must not alter CP global registry unilaterally.

## 3. Canonical resource and lifecycle model

A first-party TMS native-binding aggregate (schema to be implemented and reconciled, not automatically added to Shared by this ADR) SHALL include the following, each as non-secret fields:

~~~text
NativeExecutionBinding
  binding_id
  tenant_id
  primary_organisation_id
  operating_organisation_id
  legal_entity_id
  market_participation_reference
  residence_and_isolation_profile_id
  environment
  cp_provider_id / cp_engine_instance_id / capability_binding_revision
  native_provider_kind: FLEETBASE_FLEETOPS | OPEN_TMS
  native_provider_release_digest
  native_deployment_id
  native_organisation_reference
  native_database_or_schema_resource_ref
  native_credential_secret_ref   # reference only; no plaintext
  native_supported_operations[]  # certified by operation/version
  policy_digest
  desired_state_digest
  provisioning_generation
  lease_or_fencing_generation
  created_at, verified_at, verified_until
  observed_health, readiness
  lifecycle_state
  provenance / approval_reference / audit_reference
~~~

Tenant, Organisation, LegalEntity, PlatformAccount and Market remain separate entities. Native bindings require typed, scoped ExternalReference and Mapping records consistent with Shared ADR-SHARED-012/013/014; a TMS LogisticsShipment related to an engine-owned TradeShipment uses Shared CrossEngineObjectReference (ADR-SHARED-021) with correct scope/pinning.

Avoid shadow copies of CP organisation grants or native vendor identities as canonical truth. No binding is ACTIVE with null or ambiguous tenant, legal entity, provider version, verified isolation, credential reference or required operation certification.

**Desired and observed state:** CP stores the authorised requested product/market/isolation/residency/capabilities, not user-selected vendor DB names or internal endpoints. CP's deterministic planner derives provider binding, migration/creation actions, contracts and affected parties. TMS provisioning reports independently verifiable observed state. A successful API POST is not a verified deployment.

## 4. Tenant isolation strategies: explicit alternatives and selection

**Default for initial regulated/commercial pilots:** canonical TMS PostgreSQL isolation plus *dedicated provider-native database and least-privileged DB role per tenant* when engine architecture and capacity allow; separate application/queue runtime for clients with strong boundary needs. The following are permitted only after tests:

| Model | Native arrangement | Preconditions | Use |
|---|---|---|---|
| Dedicated native database and credentials in shared compliant DB cluster | Separate MySQL DB for Fleetbase, separate PostgreSQL DB for Open TMS | Vendor multi-database boot/config, migrations, cache/worker/queue routing and backup/restore qualified | Preferred initial per-tenant data boundary |
| Dedicated native instance (app, DB/role, cache/queue/socket domain) | One provider runtime per tenant, reserved deployment | Strongest isolation, greater AWS cost; restore and rollout tested | High-assurance/high-risk tenants |
| Shared native provider application, tenant-scoped databases | Pool of stateless processes picks DB through trusted internal service identity | Prove ORM connection reset, transactions, workers, schedulers, websockets and context discipline; no session residual scope | Later cost optimisation |
| Shared native provider database with tenant columns | Native vendor organisation row and row-scoped application | Complete source audit + negative concurrency tests, RLS where supported, tenant-aware caches/jobs/files/exports, no fallback to first org | NOT permitted until independently certified per upstream version |
| PostgreSQL schema per tenant for Fleetbase | Not native documented MySQL/Fleetbase deployment | Full PG17 port certified (ADR-TMS-0020) | Research-only until proven |

**MySQL does not have PostgreSQL-style schemas**: MySQL "schema" is effectively a database namespace. Never represent Fleetbase tenant PostgreSQL schemas as a supported provisioning feature. MySQL dedicated DB/role and Open TMS PostgreSQL dedicated DB/role are the honest starting units, not automatic one-server-per-user.

Physical DB isolation is necessary but insufficient. A shared vendor process with a global admin token could still cross tenant boundaries. Separate least-privileged app, secrets and DB connections (and where required runtime) must form one attestable boundary.

## 5. Provisioning lifecycle and transaction rules

The CP desired-state reconciler SHALL be the initiating authority. It SHALL use accepted Shared/CP long-running plan/approval/operation contracts, durable operation IDs, idempotency and lease fencing, not a synchronous unbounded HTTP request that shells out to create two databases in the request thread.

~~~text
AUTHORised/approved Tenant + Subscription + Market/Legal scope
  -> ProvisioningDesiredState (digest, profile, provenance)
  -> CP validates current IAM/Organisation/mandate and product grants
  -> Deterministic plan, risk/impact, expected providers, immutable plan digest
  -> Environment-appropriate policy approval/authorisation
  -> CP ExecutionOperation with fencing generation and bounded deadline
  -> TMS ProvisioningPort reconciles native resources idempotently
     Fleetbase: MySQL DB/role -> runtime config -> migrations -> cache/worker/socket scope -> native org identity
     Open TMS: PostgreSQL DB/role -> Prisma migrations/backfills -> app/worker/EDI isolation -> native org identity
     Both: per-tenant credentials, S3 prefixes/policies, webhook registry, private networking
  -> Independent readback: native instance, exact DB/role, schema version, object access,
     wrong-tenant denial, IAM/CP current binding, secrets, health and event route
  -> CP reconciles observed state and confirms eligible capabilities
  -> READY (not ACTIVE) -> separately governed activation
~~~

**Provisioning idempotency:** scope by authorised tenant + native provider + environment + desired-state generation and operation idempotency key. A duplicate plan retry converges existing native resources; a changed desired-state digest is conflict/re-plan, not destructive re-provision. DB schema creation is not globally atomic with AWS API calls, IAM credentials and native providers; use a durable saga with explicit reconcile/compensation, step-level receipts and irreversible-effect classification.

**Stale plan safety:** revalidate provider release eligibility, legal/Market/tenant entitlement, reserved capacity, residency, credential trust and operation leases **at execution time immediately before material side effects**, not solely at plan creation. Use optimistic revision plus fencing token/attempt generation. Stale worker A cannot complete/reverse an operation reclaimed by worker B.

**Provider bootstrap:** never run demo seed with destructive wipe on a live database. Build a dedicated non-destructive native bootstrap command/fixture. If native migration lacks safe noninteractive execution, block that gate and fix provider adapter first.

**Read-back** is independent from the actor/credentials performing mutation wherever possible. It must attest exact tenant, Organisation, legal scope, allowed native endpoint, native DB identity, current migrations, supported operation and token isolation. Store immutable receipt hash with observer identity/time, not passwords.

**Failure policy:** PARTIAL, BLOCKED, FAILED, PROVIDER_UNKNOWN and READY distinct. PARTIAL native creation never exposes a usable provider. On retry, probe existing resources before any create; orphan scans compare AWS/native instances and CP desired state. Ownership labels are hints, not authorisation proof.

## 6. Provisioning interfaces and Go CP contract

This is an illustrative typed internal interface. Exact Shared/CP API names/version are subject to accepted contract adoption; CP SHALL NOT copy TMS business domain entities into CP database.

~~~go
type NativeProvisioningPort interface {
    Plan(ctx context.Context, desired ApprovedProviderDesiredState) (ImmutablePlan, error)
    Reconcile(ctx context.Context, op FencedExecutionOperation) (ProviderReceipt, error)
    ReadBack(ctx context.Context, binding BindingReference) (ObservedProviderState, error)
    Suspend(ctx context.Context, op FencedExecutionOperation) (ProviderReceipt, error)
    Deprovision(ctx context.Context, op FencedExecutionOperation) (ProviderReceipt, error)
}
~~~

Implementation rules:

- Context is caller-bound and signed/redeemed by CP against IAM identity and current grants; explicit audience is necessary.
- Every request carries exact binding version and plan digest, server-derived tenant/legal scope, deadline, correlation, environment, operation ID and execution attempt.
- ProviderReceipt exposes observed facts, qualified operation set, evidence digest, native resource ID, expiry and failure category, not self-declared certification.
- Secrets are short-lived or scoped to provider+tenant+environment; never returned to CP frontends or included in provider receipts.
- CP-facing provisioning adapter may be implemented in Go and invoke an independently isolated TMS provider provisioner; no native product needs to embed the Go CP.
- No arbitrary privileged generic HTTP proxy and no caller-selected native administrative URL.

## 7. Native data plane authentication and authority chain

~~~text
Human/Carrier/Driver/Workload
 -> Baobab IAM: Kratos native sessions; Hydra OAuth/OIDC and workloads; Keycloak federation
 -> verify issuer, signature, audience, expiry, jti/replay and revocation policy
 -> CP canonical Principal + Organisation + Tenant + LegalEntity + Market + mandate/context
 -> CP current entitlement + certified TMS provider binding
 -> TMS domain policy: movement/consignment/booking + carrier assignment + driver/resource relation
 -> constrained native provider adapter credential
 -> exact native object, action and scoped instance
~~~

- A native vendor user, Fleetbase company account, Open TMS JWT or carrier code SHALL NOT serve as a Baobab authority assertion.
- Use workload OAuth tokens with audience and operation scope; optionally mTLS/PoP for sensitive internal links. Native API keys may be necessary but stored as encrypted per-tenant provider secret references, rotated and never promoted to platform IAM credentials.
- Native product identities are fenced to private service APIs. Any upstream interactive console, driver/mobile identity, native carrier portal or vendor app must either federate IAM and use a CP-redeemed binding or be isolated from Baobab-authoritative actions. No "trust vendor user role" bypass.
- The TMS actor/resource/action matrix covers tenant operator, dispatcher, carrier staff, driver/device, customer, external auditor, platform provisioner and reconciliation worker. Carrier staff have only assigned consignments/tenders; driver/device may submit only its assigned movement observations. The customer view excludes sensitive GPS or carrier margin unless positively authorised.
- Permission checks occur at API, domain, SQL/ORM, worker dispatch, caches, object storage and GraphQL resolver/REST response; object ownership and nested references are checked, not inferred from a parent path or untrusted header.
- On revocation, pending high-risk operations revalidate context before commitment; cache lease duration and invalidation policy are documented. Offline driver/device data may be accepted as untrusted observation but not applied as privileged action without fresh verification.
- Principal/issuer mapping follows IAM/CP canonical contract: no JIT-created privileged operator and no static platform-wide service "superadmin" used for customer workflows.

## 8. Native database, runtime and auxiliary isolation

### 8.1 Fleetbase/Fleet-Ops / MySQL

Provision a native tenant-specific database/role or dedicated instance, using patched supported MySQL 8 family. Validate that Fleetbase core + Fleet-Ops all access paths and migrations target the exact DB; restrict role to tenant DB only; prove backup/restore per tenant and absence of cross-database access. If one app server uses different tenant DBs, use verifiable per-request connection binding, transaction reset, pool isolation and async worker/queue correlation; otherwise prefer dedicated runtime. No unverified dynamic DB switch.

Redis: tenant-aware key prefixes/ACLs or dedicated instances; independent queue namespace, DLQ/retry and worker identity; namespace socket rooms/channels and token binding; verify driver mobile/WebSocket reconnect cannot subscribe to another tenant. A native location feed must not stream into CP or a public broadcast channel. Keep one active scheduler per native deployment context, not multiple uncontrolled copies.

### 8.2 Open TMS / PostgreSQL

Per-tenant PostgreSQL database/role and S3 scope by default. Qualify Prisma migrations, pg-boss queues, advisory locks and worker split on PG17. Open TMS documentation records historical orgId gaps and subsequent remediation: a route/helper fix is insufficient proof for all workers, EDI ingestion, exports, shipment lookups, carrier portals and raw APIs. Disable implicit sole-organisation fallback in production Baobab adapters even for "single organisation" deployments; require explicit CP binding and tenant/Organisation match. Direct vendor API access and unscoped native admin/API keys are forbidden.

Use PostgreSQL RLS as defence-in-depth only if native queries/roles and connection handling support it and tests prove no role bypass; otherwise physical DB isolation remains. No app role with superuser/BYPASSRLS or all-tenant grants. EDI partner identifiers must be resolved within an independently authenticated tenant context before a payload can create/modify an order, tender or shipment.

### 8.3 Object store, log, backup, telemetry and caches

- S3 bucket/prefix and KMS policy scoped to legal and tenant boundary; signed URLs short TTL and server-authorised.
- Dedicated export path; no unbounded CSV/GraphQL search or downloadable raw native document endpoint.
- Logs/traces/audit store tenant and binding/correlation IDs without credentials, restricted location/driver PII or raw payload bodies.
- Encrypt backups, prove scoped restore, test tenancy-invariant snapshots and data-reconstruction side channels.
- Telemetry bursts, socket rooms, cache keys and message partitions must not permit accidental tenant bleed under pool reuse.
- Record source and observation/record time independently; no fabricated GPS, ETA, custody or Customs release.

## 9. Deterministic execution-provider selection

**CP selects entitlement to first-party TMS capability. TMS selects a native execution adapter for a transport-operation/leg.** Native selection SHALL be deterministic from governed inputs and a versioned policy, not from user-supplied product text, event name, sales-channel name, opaque route slug or arbitrary callback field.

Inputs required:

1. Valid current CP operating context (Tenant, Organisation, LegalEntity, Market participation, legal mandate, entitlement, approved provider binding).
2. Shipment/Consignment/TransportPlan identity, immutable revision, proposed action (dispatch/tender/booking/status), applicable mode and actual leg/corridor; no one-to-one shipment-provider assumption.
3. Real carrier/operator relationship and fleet arrangement (owned, leased, brokered, subcontracted) with licence and safety validity.
4. Provider release/current health, supported operation+contract+standard, native tenant binding, credential state, residency, scale/readiness and service-level needs.
5. Applicable Regulations/Trade Docs transport execution gates, including pinned versions and staleness.
6. Explicit tenant policy preferences and fallback eligibility where present.

**Selection result:** ALLOW(provider+binding+reason+policy digest), BLOCK(reason+evidence), or UNKNOWN(wait/reconcile). No configured provider means BLOCK. Failure to read authoritative CP data before a material commitment means BLOCK/UNKNOWN, not default Fleetbase. Read-only projection may degrade with stale badges and watermarks where permitted.

Example decision table:

| Scenario | Proposed qualified path | Caveat |
|---|---|---|
| Thamani fleet operates last-mile ZA leg | Fleetbase Fleet-Ops | Must prove fleet resources and dispatch operation in this tenant |
| ZuriBeans Uganda brokered freight carriage | Open TMS | Must prove carrier and applicable EDI/booking operation |
| UG -> ZA with Ugandan pickup, carrier linehaul and recipient last mile | Several independent leg bindings; possibly both providers | Customs/custody evidence at handoffs; no single global delivered flag |
| Carrier API supports only tracking | Track-only adapter | Do not create native booking or manufacture acceptance |
| Original booking provider unavailable after request submitted | UNKNOWN/reconcile original partner | Do not tender to second carrier until non-duplication proven |
| Fleetbase lacks required cross-border mode or licence | Explicit BLOCK or authorised other certified adapter | No mode-agnostic Fleetbase fallback |

A plan's native assignment record SHALL pin binding_id, native adapter kind/release, provider endpoint identity, external booking ID, idempotency key, source authority, timeline and operator. Mid-journey migration is a new plan/assignment revision, not a hidden pointer rewrite.

## 10. Event routing and contract boundaries

Accepted Shared ADR-SHARED-018 governs event namespace grammar **com.baobab-platform.<context>.<aggregate>.<fact>.v<major>** and producer ownership. The proposal's **com.baobab.delivery.local.created / com.baobab.delivery.freight.created** must not be registered directly by TMS or treated as a permission to modify the Shared prefix. If platform ownership later accepts com.baobab, execute a separate versioned Shared protocol migration with dual-consume compatibility tests, immutable historic identity and consumer-specific sunset.

Define canonical logistics commands/events in Shared only after registering actual owner and contract: source Trade event -> validated TMS transport requirement -> domain facts. An event is not a privileged command and a remote message delivery acknowledgment is not a carrier booking success.

Canonical envelope must preserve event_id, type, schema major, producer, subject/aggregate type and ID, tenant and legal/operating scope, occurred_at, recorded_at, trace/correlation/causation, authoritative source, version, payload digest and privacy classification, using the exact currently approved Shared field names. Payload should preserve Shipment and Plan/Leg IDs, source-observation ref, native provider reference (restricted), movement milestone/vehicle telemetry type, observed vs estimated status, clocks/units, confidence/freshness and proof references. Example field sets are conceptual until the Shared schema is accepted.

RabbitMQ routing via bound durable topic exchanges/queues may use routing keys derived from registered canonical type and TMS tenant/aggregate partition; broker exchanges do not define canonical types. Kafka migration later SHALL preserve source event identity, semantics, partition and replay; no dual publish of different event IDs masquerading as one fact. Different tenant scopes require logical ACL enforcement even when physically using one broker. Subscriber must validate tenant/owner, schema and source trust regardless of broker routing.

## 11. Native call semantics, uncertain outcomes and compensation

- Transactionally persist TMS outbound attempt, domain version, provider binding and outbox BEFORE emitting broker message; return accepted operation reference, not false native success.
- Authenticate native response/webhook, verify exact tenant binding, original operation/idempotency, native object ExternalReference and monotonic/correctable state machine; dedupe identical messages; quarantine event-ID/hash mismatch.
- Preserve at-least-once semantics and correct optimistic updates; replay source events without redoing externally committed actions.
- HTTP 202, timeout, EDI 997 (functional receipt), 204 tender submission, or websocket packet is NOT proof of 990 carrier acceptance or physical loading.
- PROVISIONAL/PENDING/UNKNOWN are not CONFIRMED; external inquiry/reconciliation and acknowledgement evidence required.
- Rebook or reassign only when current provider response and cancellation/expiry semantics establish no duplicate capacity commitment (or a governed managed conflict exception).
- Refunds/payments and legal Customs releases are not compensable technical steps; Trade, ERP, Trade Docs and sovereign authorities retain their own decisions.
- Durable sagas record timeline, responsible worker, lease attempt, timeout, retry budgets, source digest, manual override policy and independent witness for high-risk recovery.

## 12. Mixed-provider custody and cross-border gates

A consignment may traverse multiple providers and transport modes. Each transition of carrier/custodian SHALL create a distinct source-provenance CustodyHandoff with quantity/handling-unit, from/to party, facility, event occurrence, evidence reference and acknowledgement/dispute status. Never infer signed POD, title transfer or Customs release from "delivered" in a vendor UI.

Before a guarded dispatch, controlled border passage or final release, validate applicability for exact shipment/consignment/leg/cargo/legal actor/time with pinned Regulations and Trade Docs decisions, effective date, revocation and source. Unknown/stale mandatory evidence blocks. Border arrival can be observed without conferring permission to leave. UG and ZA Market participation is not the same as legal clearance, corridor, tax, country, currency or AWS deployment region.

## 13. Headless customer tracking and public integration

- RESTful stable API paths for trade/partner/carrier commands, tracking read, explicit carrier ack, secure webhook and source-signed observation intake; version OpenAPI and apply rate limits and idempotency.
- Optional GraphQL query service in TMS's **read-side or confidential digital-estate BFF**, using verified IAM/CP context and exact source-authorized TMS tracking projection. Do not put native Fleetbase/Open TMS DB joins or high-rate GPS streams in the CP governance API.
- Read model includes timeline, carrier milestone, ETA provenance, POD/Trade Docs pinned evidence refs, leg and custody state, last_observed_at, projection_as_of, stale/partial/unknown status. Do not combine guessed ETA and proven actual into a single false "current" fact.
- GraphQL resolvers enforce record, field, nested association, partner and privacy scope, query complexity/cost, batch limits and no introspection of privileged internals in public contexts.
- GPS/customer personal information minimised; public tracking links use scoped expiring capability not unrestricted opaque shipment number guessing; geolocation precision depends on contractual purpose.

## 14. Lifecycle: scale down, suspension, provider migration and deprovision

Provider lifecycle SHOULD expose CREATED -> CONFIGURING -> VERIFYING -> READY -> ACTIVE -> DEGRADED/SUSPENDED -> MIGRATING -> RETIRING -> DEPROVISIONED, with explicit BLOCKED/FAILED remediation and immutable observed evidence. CP subscription/tenant lifecycle remains separate; never infer that native READY equals global Tenant ACTIVE.

**Idle detection:** no active movement/booking/tender, no pending webhook/EDI or SLA timer, no open customs hold requiring monitoring, no undelivered outbox or queue backlog, no scheduled carrier sync requiring realtime response, no latency-sensitive customer requirement. "No browser session" alone is not idle. Only sleep components whose ingress remains durable and whose wake-up latency is within approved SLOs.

**Active workloads SHALL NOT scale to zero** just to save money. Prefer cost savings from shareable warm capacity, scale-down of noncritical analytics, office-hours batch jobs, autoscaling by queue depth/CPU and justified dedicated instance tiers. Aurora auto-pause is version- and connection-dependent and not guaranteed. Handle mobile reconnect, stale GPS buffered uploads and carrier webhook ingress during maintenance.

**Suspend:** CP revokes entitlement/binding and adapter credentials according to risk, fence new material commands, preserve lawful read-only history/needed retention; still process externally mandated safety/emergency callbacks under restricted audited workflow where contract permits. Do not delete active cargo tracking or records as a side effect of billing suspension.

**Migration:** freeze new native writes per affected leg; independently read existing external bookings, active loads and in-flight callbacks; record stable ExternalReferences; pre-provision target; dual-read/shadow only without duplicate binding write; reconcile outstanding actions; activate new binding only after CP governance and proof; retain old adapter for historic/late messages according to retention. Never reassign one carrier acceptance to another silently.

**Deprovision:** CP owns destroy intent and plan. Check legal hold, retention, active consignments, unresolved customs/EDI, invoices/doc references and connected estates; terminate operations safely; revoke scoped credentials; detach queue/websocket endpoints; delete native objects and DB/role after policy; purge or archive S3/GPS under retention; independently read back AWS/native resources, attest negative access and restore backups as policy demands; record immutable teardown witness/digest. No deletion based solely on absence of a CP registry row. Orphan scans MUST reconcile desired/observed resources, not erase anonymously.

## 15. Regional and multi-tenant data protection

Protect driver GPS and proof-of-delivery as sensitive/personal operational data with purpose limitation, precision controls, retention and audit. Uganda/ZA operations must independently evaluate applicable local employment/driver privacy, lawful telemetry consent/basis and legal cross-border transfer and residency duties. POPIA compliance cannot be inferred just because AWS af-south-1 hosts the cluster; Uganda is a business Market, not an AWS Region.

Country-specific carrier certification, roadworthiness, freight permits, Customs/EDI acknowledgements, insurance, hazardous/cold-chain requirements and document issuers remain evidence-grounded. TMS stores scoped operational assertions and status; does not create a sovereign decision by computing a dashboard badge.

## 16. Observability, assurance and objective acceptance

Every provider instance/tenant binding needs current health/readiness observations, expiry/freshness, build/DB schema/adapter version, execution operation and last confirmed native probe. HEALTH_UNKNOWN for critical write capability is not eligible. Monitors include tenant-scope violation attempt, provider auth failure, command/outbox lag, unacknowledged tender, unknown booking outcome, driver location staleness, EDI NACK/timeouts, telemetry backlog, native DB pool saturation, queue retries/DLQs, socket subscription mismatches, route latency, audit receipt freshness and projected outage impact.

Measure SLOs using real traffic or controlled load, with region and tenant tier-specific targets. Synthetic tests cannot certify actual carrier/Customs authority. Business and deployment readiness remain separately reviewable and time-bounded.

### Minimum mandatory adversarial test matrix

| Case | Required outcome |
|---|---|
| IAM wrong issuer/audience, revoked workload, expiry, forged scopes/tenant header | DENY |
| CP context valid but tenant/legal/Market/operating Organisation mismatched | DENY |
| Parent Nabhold accessing subsidiary tenant without explicit permission | DENY |
| Tenant A native Fleetbase DB/Redis/socket worker receiving tenant B request | DENY, no leak/side effect |
| Tenant A Open TMS shipment/EDI/carrier query on B native DB/export/worker | DENY, no leak/side effect |
| Carrier assigned only to leg A attempts shipment B tender/position read | DENY |
| Driver spoofed GPS, stale device credential, forged webhook signature | QUARANTINE |
| Two concurrent booking requests with same key and same payload | At most one material carrier attempt, stable retrieval |
| Reused idempotency key with different payload digest | CONFLICT |
| EDI 204 submitted but no 990 / HTTP timeout after possible commit | UNKNOWN + reconcile; no automatic duplicate booking |
| Outbox relay crash, queue redelivery, Kafka/RabbitMQ swap replay | One logical fact/transition, at-least-once robust |
| Lease claimant A completes after B reassigned attempt | Fencing rejects A |
| Provider release suspended between plan and execution | Re-plan/BLOCK before native effect |
| Shipment mixed Fleetbase/Open TMS with partial custody handoff | No whole-shipment false DELIVERED or Customs RELEASED |
| Missing/stale Regulations/Trade Docs decision on guarded leg | BLOCK/UNKNOWN |
| Active courier movement during scheduled autoscaling | Ingestion/dispatch preserved |
| Inactive tenant wake-up and parked EDI/webhook | Durable accepted/replayed according to tested SLO |
| Provider migration with in-flight callbacks and existing booking refs | Stable mapping, no duplicate commitment |
| Deprovision with live leg or legal hold | BLOCK; no destructive operation |
| Approved deprovision after retention | Independent negative read-back, credential denial, immutable teardown record |
| Restore one tenant from backup | No data from other tenant / no permission escalation |

## 17. Gate-based implementation, dependencies and acceptance rules

### HYB-00 — Decision and contract governance

Accept ADR-TMS-0020/0021; identify superseded parts of TMS-TECH-01; retain 0003..0019 Proposed; create Shared proposals for logistics capabilities/events/producers and any namespace migration separately. Gate exit is reviewed document authority, not runtime proof.

### HYB-01 — Native fitness/licence/security census

Exact upstream immutable SHA, full executable build, Fleetbase AGPL/commercial disposition, native API matrix, Open TMS transitive licences, supported Fleetbase MySQL version and Open TMS PG17 runtime proof plan, security and threat review. No "real provider" declaration without this census.

### HYB-02 — Native deployment and isolation proof

Use synthetic independently governed Tenant A and Tenant B plus a controlled fleet/carrier. Prove two Fleetbase native DB/roles/runtime/Redis/socket contexts and two Open TMS PG17 native DB/roles/EDI and worker contexts; migrations, owner-only read/write/exports, backup/restore and restart. Fail closed on unknown actor. Provide measured resource costs and startup times.

### HYB-03 — CP lifecycle implementation

Use accepted CP provisioning contracts and exact current Shared pins. Immutable plan, maker/checker where applicable, idempotent Reconcile, execution fencing, native credentials/secret refs, independent read-back, observed-state reconciliation, drift and orphan repair. CP context provenance and legal/Market separation verified.

### HYB-04 — IAM/authorization provider integration

Real IAM-issued actor/workload tokens, CP-resolved canonical identity and grants, native role mapping and denial matrix; no separate native sign-up path that grants Baobab access. Verify revocation, signed provider callbacks and least-privileged credentials; use synthetic identities for development.

### HYB-05 — Canonical event and durable-workflow integration

Shared-approved canonical logistics types/producer and cross-engine refs; RabbitMQ adapter and Kafka forward-compat, inbox/outbox/DLQ, idempotency, replay, provider-unknown and EDI 204/990/214 fixtures. No legacy trade.shipment producer transfer without Shared agreement.

### HYB-06 — Composite operational verticals

Local own fleet, brokered carriage, mixed-mode multi-leg and source-provenance physical tracking; carrier qualification, safe plan/provider selection, custody, POD pinned Trade Docs and Regulations protected transitions; demonstrate current/fresh actual source proofs.

### HYB-07 — Headless unified read model and external surfaces

Read-only GraphQL or confidential BFF tracking plus versioned REST/EDI partner endpoints; customer/counterparty/driver field-level privacy, projection freshness and no vendor UI dependency. End-to-end Thamani B2B and ZuriBeans entitlements with no implicit cross-tenant sharing.

### HYB-08 — Performance, release governance and decommission proof

Measured cold/warm spin-up, active/inactive scale, queue recovery, lease fencing, legal holds, recoveries, migrations, provider failover and independently witnessed teardown. EA-09 certifies operations/versions; CP alone records ACTIVE binding after appropriate staging/production approvals.

**Gate invariants:** each completed item identifies source PR/SHA, CI run, Shared package pin, actual runtime instance/environment, test outcome (PASS/FAIL/BLOCKED), evidence custodian, relevant scope/release, timestamp/expiry, owner and residual risk. Proposed documents and green unit CI do not equal live qualified TMS capability; separate "component ready" from "integration qualified" from "production authorised".

## 18. Forward compatibility, ownership and anti-patterns

No tenant-specific forks. No CP-embedded native business models. No cross-engine joins, direct native write from Digital Estates or browser-held vendor service keys. No implicit permission from corporate ownership. No provider replacement under a committed booking without reconciliation. No automatic Customs/ETA/POD truth from carrier text. No fake provider if subscription absent. No privileged wildcard tenant, bare X-Tenant trust, schema name as authorisation or backdoor admin API. No "Kafka exactly-once" claim for arbitrary external carrier effects.

A future third native provider SHALL implement the same ports, binding lifecycle, testing and acceptance without changing canonical LogisticsShipment/Consignment identities. Provider choice is a policy/configuration result; the business domain should survive removal of Fleetbase or Open TMS.

## 19. Decision relationship and documentation maintenance

This ADR and Accepted ADR-TMS-0020 are the authoritative **hybrid-native-provider decisions**. They do not revise Accepted ADR-TMS-0001/0002 core semantics. Proposed ADR-TMS-0009–0015 and extensions 0016–0019 are not silently accepted; use their valid design detail subject to these binding decisions and Shared precedence. TMS-TECH-01's prohibition on running a Fleetbase native runtime and mandatory single-stack implementation is superseded in part.

Update the ADR register and runtime proposal status note with this explicit relationship. Any change to registered canonical capability, wire event, event prefix, owner or trust semantics requires its own separately governed Shared/CP/IAM change. A TMS-only merge cannot activate a vendor capability across the platform.

## 20. Reviewed source material — 2026-10-25

- Baobab TMS foundation: https://github.com/baobab-platform/baobab-tms/tree/main/docs/adr
- Hybrid native runtime ruling: ADR-TMS-0020 (this repository, companion)
- Shared canonical event stewardship: https://github.com/baobab-platform/shared/blob/main/docs/adr/ADR-SHARED-018%20%E2%80%94%20Canonical%20Event%20Context%20Registry,%20Event-Type%20Ownership%20and%20Legacy%20Event%20Migration.md
- Shared EA v2.3: https://github.com/baobab-platform/shared/blob/main/docs/architecture/EA-implementation-plan-v2.3-2026-10-20.md
- IAM multi-provider authority: https://github.com/baobab-platform/baobab-iam/tree/main/docs/adr
- Fleetbase MySQL/worker baseline: https://github.com/fleetbase/fleetbase/blob/main/docker-compose.yml
- Open TMS tenancy audit: https://github.com/DominicFinn/open_tms/blob/main/docs/MULTI_TENANCY_REMEDIATION_PLAN.md
- Open TMS native worker/install limits: https://github.com/DominicFinn/open_tms/blob/main/docs/SELF_HOSTING.md
- AWS Aurora auto-pause/connection constraints: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html

**Final invariant:** CP owns the right to operate. TMS owns the truth about transport execution. IAM verifies who acts. Native providers perform delegated work. Shared defines how facts are communicated. Neither native provider nor one convenient database undermines those boundaries.
