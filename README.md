# Baobab TMS — Transportation Management and Logistics Execution Engine

> **Current status:** Foundation-0 architecture and template configuration. **No headless TMS service, live carrier integration, active canonical capability or production certification has been demonstrated in this repository.**

Baobab TMS is a reusable, **headless, self-hosted** transport-execution engine for independently entitled Baobab tenants, including Thamani and ZuriBeans. It models canonical **LogisticsShipment, Consignment, Cargo, TransportPlan, TransportRoute, TransportMovement, TransportLeg, TransportCall, Booking, Capacity, Delivery** and sourced operational events.

It is not a tenant-specific digital estate, an ERP, a warehouse inventory ledger, a Customs authority, a commercial seller or a provider-neutral IAM/CP replacement.

## Architectural decisions

See the [ADR register](docs/adr/README.md) for the programme and maturity:

- [ADR-TMS-0001](docs/adr/ADR-TMS-0001%20%E2%80%94%20Baobab%20TMS%20Mission,%20Authority,%20Transport%20Execution%20Boundary%20and%20Platform%20Capability%20Role.md): Accepted engine mission/authority.
- [ADR-TMS-0002](docs/adr/ADR-TMS-0002%20%E2%80%94%20Canonical%20LogisticsShipment,%20Consignment%20and%20Transport%20Execution%20Domain%20Model.md): Accepted canonical shipment/consignment domain.
- ADR-TMS-0003 through ADR-TMS-0019: **Proposed** architecture and implementation-gate decisions; not implementation or production proof.
- [TMS-TECH-01](docs/architecture/TMS-TECH-01%20%E2%80%94%20Headless%20Self-Hosted%20TMS%20Runtime%20and%20OSS%20Reuse%20Strategy.md): proposed same-stack runtime direction; headless Node.js 24 / TypeScript / Fastify / PostgreSQL 17; selective OSS logic reuse, no mandatory extra product stack.

## Ownership and integrations

**TMS owns** physical transport execution and trusted transport-domain operational facts. **Trade/Medusa** owns commercial orders, fulfilment commitments and TradeShipment; **ERP/iDempiere** owns financial/accounting state; **Trade Docs** owns document versions, evidence and Customs workflows; **Regulations** owns applicable regulatory decisions; **CP** owns tenant context and capability provider/bindings; **IAM** owns authentication.

Canonical cross-engine identity, event types, capability keys and wire contracts are governed by [baobab-platform/shared](https://github.com/baobab-platform/shared). Accepted Shared contract authority is not changed by a TMS document. The existing Trade shipment event producer remains Trade until a separate Shared reconciliation.

## Self-hosted development

The repository currently retains template `.baobab/*.example` and `.devcontainer/*.example` profiles. Application dependencies, migrations, runnable services and a production container are **not yet established**. Do not copy template YAML into a production provider-support claim.

Proposed delivery increments are documented in the [ADR programme](docs/adr/README.md) with API, database, identity, provider adapter, tracking, safety/compliance and operational acceptance gates.

## Architecture / production distinction

**Proposed ADRs ≠ accepted decisions; accepted decisions ≠ implemented capabilities; implemented capabilities ≠ CP certification/activation; deployment ≠ proven legal or operational authority.**

See [SECURITY.md](SECURITY.md) for reporting; [CONTRIBUTING.md](CONTRIBUTING.md) for repository contribution process.
