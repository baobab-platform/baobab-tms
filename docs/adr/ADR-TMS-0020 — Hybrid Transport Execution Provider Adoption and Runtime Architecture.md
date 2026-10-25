# ADR-TMS-0020 — Hybrid Transport Execution Provider Adoption and Runtime Architecture

**Status:** Accepted — Authoritative TMS Runtime and Provider-Adoption Decision  
**Decision date:** 2026-10-25  
**Repository:** baobab-platform/baobab-tms  
**Decision owner:** Baobab Platform Owner / Enterprise Architecture  
**Scope:** Headless transport-execution runtime, third-party provider adoption, database compatibility, orchestration, integration, licensing and migration  
**Normative dependencies:** Accepted ADR-TMS-0001/0002; accepted Shared event/capability/context/cross-engine reference governance, EA Implementation Plan v2.3, ADR-IAM-0033; existing CP, Subscriptions, Trade, ERP, Trade Docs, Regulations and Infrastructure ownership  
**Companion:** ADR-TMS-0021 (Accepted)  
**Amends/supersedes in part:** Proposed TMS-TECH-01 Sections 1, 3, 5, 6 and 7 wherever they reject running Fleetbase/Open TMS or require a single Node.js/PostgreSQL-only native implementation; compatible headless/canonical-domain/security requirements remain retained  
**Does not automatically accept:** Proposed ADR-TMS-0003 through ADR-TMS-0019 or the unaffected parts of TMS-TECH-01  
**Activation status:** Architecture ACCEPTED; upstream licences, compatibility tests, canonical contracts, provider certification and live/production release NOT IMPLIED

---

## 1. Binding decision

Baobab TMS SHALL be a **Baobab-owned, reusable, headless, canonical logistics execution and orchestration engine**. It SHALL adopt a **hybrid provider strategy** using two independently deployable, replaceable, self-hosted upstream execution products, initially:

1. **Fleetbase with Fleet-Ops** — candidate native execution subsystem for own/contracted fleet, driver operations, dispatch, last-mile execution and telemetry.
2. **Open TMS** — candidate native execution subsystem for freight brokerage, carrier tendering, carrier-status interchange, EDI and multi-stop freight movement. The initial source under assessment is https://github.com/DominicFinn/open_tms (repository identity MUST be pinned by commit and verified before incorporation). No other project named "Open TMS" is implicitly authorised.

The platform SHALL NOT make either native product the canonical Baobab domain, platform tenant source of truth, contract namespace owner, financial authority or legal Customs authority. **Baobab TMS owns LogisticsShipment, Consignment, TransportPlan, Booking orchestration, TransportMovement, verified logistics facts and domain-policy enforcement**. Native product records SHALL be translated through narrow anti-corruption adapters, retaining durable typed ExternalReferences and provenance.

"Adopt" is permission to pursue bounded integration and certification, NOT a declaration that both products are currently compatible, secure, licensed for every use case, feature-complete or production ready. An individual native operation may be activated ONLY upon its own successful qualification under ADR-TMS-0021 and platform gates.

## 2. Motivation, architectural precedence and evidence discipline

Accepted ADR-TMS-0001/0002 already define a provider-neutral physical-execution domain, including many-to-many consignment/movement allocations, source references and owner boundaries. Proposed TMS-TECH-01 preferred a fresh Node 24/TypeScript/Fastify/PostgreSQL 17 implementation with selective OSS algorithm reuse and expressly rejected Fleetbase's full runtime. That prohibition is now **superseded for a bounded, isolated provider-adoption model**.

This decision is compatible with accepted Shared EA v2.3's "Learn from established products. Reuse what is proven. Question what is inadequate. Re-engineer what must improve. Build what Africa needs." Reuse is subject to comparative engineering proof. Do not convert speculative upstream capabilities into customer-facing claims.

**Evidence baseline checked 25 October 2026:**

| Evidence | Observed fact | Architectural consequence |
|---|---|---|
| Fleetbase upstream docker-compose.yml | MySQL 8.0 image; Redis; application, queue, scheduler and socket services | MySQL is the qualified reference database FAMILY, not PostgreSQL 17 |
| Fleetbase api/.env.example and api/config/database.php | Default DB_CONNECTION=mysql; Laravel database configuration is not a Fleet-Ops PostgreSQL acceptance test | Laravel's theoretical PostgreSQL support is NOT proof that Fleetbase/Fleet-Ops run on PostgreSQL |
| Fleetbase official architecture and sizing | MySQL 8, Redis, SocketCluster and S3-compatible storage documented | Do not remove these dependencies by architectural fiat |
| Fleetbase and Fleet-Ops licensing | AGPL-3.0-or-later; vendor commercial terms available | Legal review or appropriate licence route before proprietary/networked deployment |
| Open TMS upstream docker-compose.yml / self-hosting docs | PostgreSQL 16 reference deployment; self-hosting guide says PostgreSQL 16+; Fastify/Prisma/TypeScript and pg-boss | PostgreSQL 17 is a Baobab TARGET requiring an actual migration/runtime qualification |
| Open TMS docs/CARRIER_TENDERING.md / docs/EDI_HUB.md | Tendering and several X12 EDI workflows are implemented/documented | Qualify specific message types and partner interactions; not blanket full EDI compliance |
| Open TMS docs/CARRIER_INTEGRATIONS.md | Carrier integration described primarily as tracking; API-backed booking/rating not generally proven | Native freight booking/partner coverage must be tested per carrier and operation |
| Open TMS docs/MULTI_TENANCY_REMEDIATION_PLAN.md | Historic cross-tenant leaks and phased fixes recorded, with outstanding path/worker hardening | No shared native multi-tenant deployment without current-source isolation proof |
| Open TMS docs/SELF_HOSTING.md | Notes build/type issues, worker split limitation and seed wipe default | Build, worker and safe bootstrap hardening required |

All upstream observations are time-bounded; use immutable commit SHA, licence snapshot, SBOM and repeat tests before every release. A README assertion is not an integration receipt.

## 3. Non-negotiable system-of-record matrix

| Subject | Owner | TMS/provider constraint |
|---|---|---|
| Tenant, Organisation, LegalEntity, Market, PlatformAccount, subscription, capability binding, desired state, provider eligibility | baobab-cp and respective Shared/Subscriptions contract owners | Neither upstream native org nor schema name is a canonical Tenant |
| Human/workload authentication, federation and token issuance | baobab-iam: Kratos/Hydra/Keycloak as per ADR-IAM-0033 | Native accounts/API tokens cannot grant Baobab authority |
| Canonical event keys, envelope, contracts, versioning | baobab-platform/shared | No provider may invent or activate a Shared wire key |
| Order, customer sale, fulfilment/trade commercial commitment | baobab-trade / contracting estate where applicable | No Open TMS invoice/order/billing takeover |
| LogisticsShipment, Consignment, TransportPlan, Movement/Leg/Call, booking intent, custody and operational facts | baobab-tms | Native representations are subordinate external identities |
| Asset acquisition/depreciation, payables, invoice posting, GL, financial settlement | baobab-erp / iDempiere and other accepted financial owners | Native product finance/ledger routes fenced |
| Customs documentary workflow, DocumentVersion and external Customs authority assertions | baobab-trade-docs and actual Customs authorities | No document/status-derived customs self-certification |
| Legal/regulatory applicability and policy decisions | baobab-regulations and applicable sovereign source | TMS enforces pinned decisions, never decides law |
| Digital Estate tracking, booking UI and customer presentation | entitled estate/BFF | No required native vendor console as customer control plane |

An Open TMS carrier is a real carrier/organisation, **not** a CP CapabilityProvider; Fleetbase vehicle/driver is a native execution resource, **not** a canonical legal actor. Corporate-group ownership never implies cross-tenant transport access.

## 4. Logical deployment and module architecture

~~~text
Thamani / ZuriBeans / third-party entitled Digital Estates
  -> confidential BFF / versioned partner REST
  -> IAM token and CP-redeemed operating context
  -> baobab-tms canonical command/query API
       -> policy: tenant/legal actor/object/capability/mode/corridor
       -> LogisticsShipment + Consignment + Plan + Booking + Movement aggregates
       -> PostgreSQL 17 TMS-owned transaction, inbox, outbox, history
       -> durable workflow / plan-leg provider allocator
       -> Fleetbase Fleet-Ops adapter --> Fleetbase API + MySQL 8 + Redis + socket
       -> Open TMS adapter        --> Open TMS API/EDI + PostgreSQL (17 after proof)
       -> partner/carrier adapters --> signed REST/EDI/webhook
       -> canonical observations and tracking projection
  -> AsyncAPI/Shared-owned facts over pluggable event delivery
  -> Trade / ERP / Trade Docs / Regulations / digital estate consumers

CP owns provisioning/binding/health/certification governance;
IAM owns authentication; neither CP nor GraphQL is a GPS message broker.
~~~

The first-party TMS canonical kernel SHOULD remain small, independently deployed and PostgreSQL 17 based. The exact implementation language for this kernel is an engineering selection (TMS-TECH-01's Node.js 24/TypeScript/Fastify remains preferred if qualified), not a condition that native Fleetbase PHP/MySQL or Open TMS Node workers share one runtime. Do not import either vendor UI into the TMS server process.

## 5. Database decision: explicit MySQL exception, PostgreSQL retained

**Binding ruling:** PostgreSQL 17 SHALL remain the preferred platform and canonical TMS transactional database; **MySQL 8-compatible persistence is explicitly PERMITTED and preferred initially for Fleetbase's native runtime**, subject to security/patch and compatibility review. Separate DB engine families do not mean a shared database or distributed ACID transaction.

- Fleetbase: deploy a supported, patched MySQL 8-compatible managed/isolated instance or qualified cluster. Its native migrations, package SQL dialect, indexes, geographic functions, triggers, queue integration, connection/session assumptions and Fleet-Ops integrations MUST pass qualification.
- Open TMS: PostgreSQL 17 is targeted. Upstream references PostgreSQL 16/16+, therefore pin Prisma version/lockfile, run all migrations and backfills on PostgreSQL 17, prove transactional/JSONB/index/worker and EDI/queue semantics before declaring compatibility. A fall-back isolated PostgreSQL 16 provider instance may be used in local evaluation only under documented exception, never silently labelled "PG17 qualified".
- Canonical baobab-tms: PostgreSQL 17; store canonical IDs, provider mappings, tenant-scope, immutable observations, reconciliation, inbox/outbox and projections. No direct reads/joins to native MySQL/Open TMS schemas.
- Each subsystem owns its database migrations, connection pools, restores and transaction isolation. No vendor schema shall be treated as a Shared platform schema.

**PostgreSQL porting research outcome:** Laravel supports multiple SQL drivers generally, but current Fleetbase deployment/reference configs use MySQL and there is no demonstrated Fleetbase + Fleet-Ops PG17 test or migration compatibility in the reviewed evidence. Therefore **PostgreSQL 17 support is UNKNOWN/UNQUALIFIED, not technologically impossible**. A separate, bounded PG17 port spike MAY be undertaken once baseline integrations pass. That spike must exercise complete Fleetbase/Fleet-Ops migrations, seeding, concurrent dispatch, telematics, spatial queries, route planning, Redis jobs, scheduler, sockets, callbacks and backups under real PG17 CI. No business-critical schedule depends on port success. A production migration requires independent acceptance, reversible data migration and provider cutover.

## 6. Native-provider boundaries and workload allocation

The **CP-resolved capability provider** may be baobab-tms itself; Fleetbase and Open TMS are initially TMS-internal native execution adapters. Native implementations SHALL NOT become CP CapabilityProviders merely because they appear on a diagram. CP records governed runtime topology where accepted Shared contracts require it and resolves the first-party TMS capability binding. TMS selects an eligible native adapter per action, leg, mode and operating scope.

- Fleetbase candidate: own/leased/contracted ROAD/LAST_MILE fleet dispatch, vehicle/driver availability, routes and GPS only when the corresponding upstream operation has proven contract and security support.
- Open TMS candidate: brokered freight tender/offer/award, 204/990/214-style EDI or approved carrier API, partner milestones, consolidation and intermodal planning only for individually tested operations.
- Neither is universal; the same LogisticsShipment may have Fleetbase pickup, Open TMS road/sea freight, and another certified last-mile provider.
- If no eligible provider implements an operation in the required tenant/market/mode/corridor/policy, reject or mark BLOCKED; do not silently route to a weaker provider or invent a booked carrier.
- Selection factors: approved canonical capability+version, supported operation, tenant/legal entity, Market participation, applicable corridor/route and carrier qualifications, native release, current health freshness, residency, licence applicability, rate limits, security level, transport policy and explicit preference/priority.
- After a booking/dispatch commitment, provider changes are controlled migrations with external reference pinning, reconciliation and handover; no "retry anywhere" booking fall-through.

## 7. Event semantics and provider command routing

The two sample event types supplied with the hybrid proposal — com.baobab.delivery.local.created and com.baobab.delivery.freight.created — describe useful product INTENT but **are not currently registered canonical Baobab events**. Accepted ADR-SHARED-018 uses com.baobab-platform.<context>.<aggregate>.<fact>.v<N>. Do not independently switch the wire namespace to com.baobab or publish a new authoritative producer without a separate Shared ADR/registry/consumer migration.

Trade remains producer of existing trade.shipment.* where currently owned. A trade-origin transport requirement SHALL arrive via accepted Trade event/command and trusted CP context, be validated for idempotent domain admission, create or correlate a TMS LogisticsShipment, and then be planned. **Creation of an event does not automatically constitute an irrevocable carrier booking**.

~~~text
Validated Trade transport demand
 -> Verify Shared schema, trusted IAM/CP context and object refs
 -> Admit TMS LogisticsShipment and Consignment (transaction + outbox)
 -> Derive transport legs and operational constraints
 -> Resolve provider per committed Plan leg
 -> Fleetbase DispatchPort for qualified local road leg
    OR OpenTMS CarrierTender/BookingPort for qualified brokered freight leg
 -> Record attempt and eventual native acknowledgement
 -> Verify carrier/driver signed callback + correlate provider ExternalReference
 -> Emit source-provenance TMS facts (registered Shared logistics context only)
 -> Project customer-safe cross-provider status
~~~

If a native system lacks the requisite API, map to a real certified adapter or report UNSUPPORTED. No direct event bridge should mutate native product tables or bypass the canonical TMS domain.

## 8. Canonical interfaces and runtime semantics

Use versioned ports; illustrative contracts, NOT registered Shared wire interfaces:

- DispatchPort: eligible plan revision/resource -> submitted/accepted/denied/unknown; verified driver/resource reference.
- CarrierTenderPort: scoped tender and provider list -> quotes/acknowledgements/expiry with raw EDI/external IDs.
- CarrierBookingPort: explicit booking intent -> confirmed/rejected/pending/unknown. Never infer confirmed from HTTP 202.
- TrackingObservationPort: authenticated provider/device event -> verified provenance, observation time, recorded time, source quality, idempotent result.
- ProviderHealthPort, ProviderProvisioningPort, ProviderIdentityPort and ProviderReconciliationPort: lifecycle/credential/mapping/readback with precise failure reasons.
- RoutePlanningPort: optional deterministic heuristic or certified solver; no invented ETA/optimal path.
- TransportDocumentReferencePort: pins Trade Docs DocumentVersion only, does not upload a competing legal document authority.
- RegulatoryExecutionGate: enforces current, decision-pinned Trade Docs/Regulations authority before guarded cross-border action.

Every material native outbound call must have a durable request attempt, tenant/legal-entity and plan revision, stable idempotency key, deadline, trace and result classification. Distinguish ACCEPTED, CONFIRMED, REJECTED, RETRIABLE, PROVIDER_UNKNOWN and QUARANTINED. Provider-specific extensions MUST be bounded and must not change canonical meaning.

## 9. Reliable asynchronous integration and broker substitution

Message semantics are owned by Shared, **not** by RabbitMQ or Kafka. Use durable local inbox/outbox, at-least-once delivery, signature verification, redrive/quarantine, envelope and schema checks, retries/backoff/jitter, consumer idempotency and optimistic aggregate revisions. Broker transport is an infrastructure adapter, with RabbitMQ permitted for development/initial environments and Kafka a planned production migration **only after governed replay, partition-key, broker ACL, retention and SLO acceptance**. Neither broker choice is a new canonical event grammar.

Routing bindings MUST include registered event context/type/version, producer authority, tenant partition and destination consumer. Events do not carry a vendor API secret; native route choice occurs after authenticated admission within TMS. Partition/ordering MAY be guaranteed per tenant+aggregate where configured, never globally. Required telemetry backpressure must not starve booking commands.

Replay must reproduce canonical historical facts without re-sending an irreversible carrier tender/booking or changing a historical customs/physical movement assertion. Archive source payload digests/evidence appropriately without leaking GPS or PII.

## 10. IAM, edge APIs and user experiences

Reuse Accepted ADR-IAM-0033: Kratos for native human identity, Hydra for OAuth/OIDC and workload issuance, Keycloak for enterprise SSO federation. IAM establishes authenticated issuer/subject; CP establishes canonical Principal, Organisation, Tenant, LegalEntity, Market, Context, grant and eligible capability binding; TMS establishes shipment/booking/driver/carrier relationship policy. No Fleetbase/Open TMS self-issued JWT becomes a CP-authenticated Baobab Principal. Vendor-native tokens remain private credentials in the TMS adapter (or fenced provider process) and never enter customer browsers or events.

Expose BFF/estate-facing REST/OpenAPI for commands and consistent partner endpoints. **Authenticated GraphQL aggregation may exist in a TMS query/BFF read service**, not inside CP's transactional governance request path. It composes TMS-owned tracking projections, permissible source evidence and freshness/confidence; it SHALL NOT make high-volume CP calls for each GPS frame or query native databases. GraphQL field-level and nested object authorization apply to entire graphs, including fragments, filtering and pagination. External carriers receive stable signed REST/EDI endpoints with scoped rate limiting and webhooks.

## 11. AWS deployment, residency, elasticity and cost model

Start with pinned, independently deployable runtime units (ECS services/containers where qualified): canonical TMS API/worker, Fleetbase app/queue/scheduler/socket, Open TMS API/worker/EDI collector, PostgreSQL 17, MySQL 8-compatible database, Redis, KMS/Secrets Manager, S3, broker, audit/observability. Group tenant workloads only where ADR-TMS-0021 isolation testing authorises it. For sensitive clients use per-tenant native DB+role and dedicated worker/runtime profile.

Prefer warm shared application capacity for interactive flows, per-tenant logical isolation or dedicated DB for high assurance, and cost-aware scale of **non-critical workers**. ECS desired count 0 or Aurora Serverless v2 auto-pause are options ONLY after verifying version/Region support, connections, operational state and wake-up latency; they are not universal features or safe defaults for live dispatch. An active movement, telematics subscription, inbound webhook, EDI window, Customs gate or SLA obligation SHALL prevent unsafe scale-to-zero. Durable event ingress, guaranteed callback receipt and retries must remain available.

Market = business Market, **not** AWS Region. South African/Ugandan businesses may use approved af-south-1 deployment where lawful and contractually permitted; do not claim an AWS Uganda Region exists or infer Ugandan statutory legality. CP residency profiles, contractually permitted replication, GPS personal data, protection under POPIA and applicable Ugandan law determine storage, retention, access, cross-border transfer and restore placement. RPO/RTO and SLO are measured gate artefacts, not guessed promises.

## 12. Security, licensing, IP and supply chain

Fleetbase/Fleet-Ops AGPL-3.0-or-later and commercial terms are a **real architecture decision**, not a footnote. Before deploying a modified native Fleetbase exposed to network users or distributing a proprietary embedded solution, obtain documented legal review and choose either a compliant AGPL distribution/source-access workflow or an applicable vendor commercial licence. Do not presume API-level separation automatically resolves copyleft implications. Preserve notices and source attribution, record dependency licences and upstream provenance. Open TMS root licence was observed MIT, but verify every component, optional WMS, asset, EDI library and bundled dependency separately.

- Pin vendor commits/releases and container digests; generate SBOM, SCA/CVE, provenance and licence reports.
- Disable unneeded native user-facing billing/ERP/WMS/customs/admin surfaces; protect against bypass via internal network and scoped credentials. Do not claim disabled routes are safe solely because they are hidden from UI.
- Test CVE patchability and vendor update compatibility; verify rolling migrations and rollback before production.
- Secure webhook raw-body signature verification, timestamps/nonces, device identity, least-privileged secrets/rotation, SSRF-safe outbound allowlists and telemetry redaction.
- Independently attest tenant data isolation at API, native row/database, worker, cache, queue, socket namespace, object store, logs, export, backup/restore and deletion boundaries.
- No arbitrary vendor plugin permitted as production executor absent code/licence/security audit.

## 13. Alternatives and reasons

| Alternative | Ruling | Reason |
|---|---|---|
| Write entire TMS from scratch now | Rejected as sole initial strategy | Delays value; ignores usable specialist components; keep canonical kernel |
| Force Fleetbase onto PostgreSQL 17 | Rejected as initial prerequisite; research retained | Not currently proven; premature port risk |
| Use Fleetbase as only logistics authority | Rejected | Commercial freight/EDI coverage, tenant and authority coupling |
| Use Open TMS as only logistics authority | Rejected | Incomplete live dispatch, heterogeneous modes and tenant assurance |
| Native direct DB exchange | Rejected | Violates ownership, upgrade and isolation |
| Hard route every "local" event to Fleetbase and "freight" to Open TMS | Rejected as universal rule | Mixed-mode legs, unsupported capabilities and provider-change safety |
| New CP TMS business schema/GraphQL streaming service | Rejected | CP is governance, not transport data plane |
| One credential or one shared schema for every client | Rejected | Cross-tenant blast radius |
| Single universal region / runtime | Rejected | Residency, uptime and market requirements vary |

## 14. Delivery programme and exit criteria

**HYB-00 — Acceptance/reconciliation:** This ADR and companion ADR-TMS-0021 accepted in TMS; conflicts with TMS-TECH-01 marked; do not auto-accept remaining Proposed ADRs. Existing Shared Event/Capability contracts preserved.  
**HYB-01 — Due diligence:** immutable upstream SHA; Fleetbase AGPL/commercial legal disposition; Open TMS MIT/transitive licence; security, maturity, feature-operation matrix; supported versions, supply-chain controls.  
**HYB-02 — Native runtime:** Fleetbase/MySQL+Redis+socket+workers build, migration and restart tests; Open TMS/PG17 Prisma migrations/queue/EDI test; measured restore, no pre-existing failing build gate waived.  
**HYB-03 — Canonical kernel:** TMS domain, provider ports, isolated PG17, durable ExternalReference/context and immutable history; cardinality tests against Accepted ADR-TMS-0002.  
**HYB-04 — IAM/CP integration:** actual IAM-issued workloads, trusted CP context and negative tenant/market/legal/binding proofs; native creds fenced.  
**HYB-05 — Event contract:** Shared-approved key/schema/producer registry, RabbitMQ adapter, replay, Kafka compatibility fixture and outbox/inbox/unknown-outcome proof.  
**HYB-06 — Transport slices:** one real own-fleet assignment; one real tender/acknowledgement; one mixed leg/handoff; one regulatory gate; source-signed telemetry; customer-safe projection.  
**HYB-07 — Headless query/read:** BFF/GraphQL vs REST security, latency, route integration, field policy, source freshness and missing-provider behavior.  
**HYB-08 — Operability and certification:** isolation abuse, failover, backup/restore, DR, inactive/active scaling, cost metrics, licence approval, version compatibility, EA-09 provider operation certification and CP activation.

For each gate provide code location, exact test/CI run and revision, negative tests, source/consumer pins, environment, owner, risk, unresolved limits and independently verifiable operational evidence. Source CI and synthetic contracts are distinct from running two real products, carrier agreements, lawful customs action and production acceptance.

## 15. Normative relationship to other decisions

- Retain Accepted ADR-TMS-0001/0002 without redefining LogisticsShipment/Consignment or their owners.
- Amend **only conflicting runtime/adoption prohibitions** in Proposed TMS-TECH-01; Node24/TypeScript/Fastify/PG17 remains a useful target for first-party canonical components, but NOT a technology mandate imposed on native products.
- Proposed ADR-TMS-0003..0019 remain Proposed; this ADR supplies a binding implementation allocation and stronger requirements where compatible, not a blanket acceptance.
- Accepted ADR-SHARED-017/018/021 and relevant Shared cross-engine/context/authority contracts take precedence over any new vendor-specific schema or proposed com.baobab shorthand.
- Accepted ADR-IAM-0033 and CP governance remain authoritative. TMS does not recreate Keycloak/Ory federation, identity, permissions or tenant subscription records.
- HYB-03 onwards must align with active EA v2.3 and Thamani's Accepted primary B2B logistics business direction, with no wholesale B2C fallback.

## 16. Evidence references (consulted 2026-10-25)

- Fleetbase Docker architecture: https://github.com/fleetbase/fleetbase/blob/main/docker-compose.yml
- Fleetbase DB configuration: https://github.com/fleetbase/fleetbase/blob/main/api/config/database.php and https://github.com/fleetbase/fleetbase/blob/main/api/.env.example
- Fleetbase official runtime: https://fleetbase.io/docs/platform/quickstart/infrastructure-sizing and https://fleetbase.io/docs/platform/getting-started/architecture
- Fleetbase licensing: https://fleetbase.io/docs/community/licensing ; Fleet-Ops: https://github.com/fleetbase/fleetops
- Open TMS: https://github.com/DominicFinn/open_tms ; https://github.com/DominicFinn/open_tms/blob/main/docs/SELF_HOSTING.md ; https://github.com/DominicFinn/open_tms/blob/main/docs/MULTI_TENANCY_REMEDIATION_PLAN.md
- Open TMS freight: https://github.com/DominicFinn/open_tms/blob/main/docs/EDI_HUB.md ; https://github.com/DominicFinn/open_tms/blob/main/docs/CARRIER_TENDERING.md ; https://github.com/DominicFinn/open_tms/blob/main/docs/CARRIER_INTEGRATIONS.md
- AWS version-dependent Aurora auto-pause: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html
- Baobab governing programme: https://github.com/baobab-platform/shared/blob/main/docs/architecture/EA-implementation-plan-v2.3-2026-10-20.md

**Final ruling:** Hybrid adoption and native MySQL exception ACCEPTED as architecture. No executable provider, licensed proprietary deployment, shared canonical wire event, certificate, live tenancy or production activation has been certified by this decision.
