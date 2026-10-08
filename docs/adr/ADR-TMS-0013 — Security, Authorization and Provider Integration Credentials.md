# ADR-TMS-0013 — Security, Authorization and Provider Integration Credentials

**Status:** Proposed — pending architectural acceptance; not implementation or production certification  
**Date:** 2026-10-08  
**Repository:** baobab-platform/baobab-tms  
**Depends on:** Accepted ADR-TMS-0001 and ADR-TMS-0002; merged TMS-TECH-01 documentation; Shared and CP/IAM governance  
**Scope:** headless, self-hosted, provider-neutral transport execution for independently entitled Baobab tenants  

> This ADR is a design proposal. Names of illustrative operations, capabilities and events are **not** automatically registered Shared contracts, certified provider support, legal authorisations or deployed runtime claims.


## 1. Decision
Use **IAM** for authenticating staff, carriers, drivers, clients and workloads; use **CP-redeemed context** for trusted tenant/legal-entity, business relationship, provider bindings and capability entitlement. TMS owns **operation-specific domain authorisation** for shipment access, carrier assignment, dispatch, tracking ingestion, document references and sensitive location exposure. No universal provider-admin shortcut or unscoped vendor credential.

\`\`\`mermaid
flowchart LR
  A["Human/workload token"] --> B["IAM verification"]
  B --> C["CP trusted caller-bound context"]
  C --> D["TMS resource/action policy"]
  D --> E["Least-privilege operation"]
  E --> F["Audited transport fact"]
\`\`\`

## 2. Domain actors and permissions
| Actor | Example allowed operations | Explicitly denied |
|---|---|---|
| Tenant logistics operator | manage entitled shipments/plans and assigned operational providers | unrelated legal-entity shipments, credit/financial records |
| Dispatcher | schedule/assign eligible movement and inspect approved operational data | override Customs hold, unapproved unsafe resource |
| Carrier organisation staff | accept/cancel assigned booking, submit valid events for own movements | competitor offers, another carrier's cargo, seller margin |
| Driver/device | publish authorized movement/GPS observations via bounded credential | global shipment query or financial document access |
| Buyer/customer | read permitted customer-safe shipment milestones | raw sensitive route/cargo/driver locations unless explicitly authorised |
| Auditor | purpose-bound historical records and evidence refs under approved policy | unbounded bulk exports across tenants |
| Platform workload | service-to-service action scoped by IAM + CP context | impersonating human acceptance or bypassing business policy |

## 3. Enforcement
- Authenticate bearer/workload tokens with audience, issuer, expiry, proof-of-possession/mTLS as applicable; **context_id alone is not authentication**.
- Redeem CP context with verified caller binding, tenant/legal entity, purpose and relevant grants; unknown, revoked, expired or mismatched scope fails closed. Avoid stale cached grants on consequential transitions.
- Check object relationship (owner, relevant shipment, carrier assignment, role, document permissions) for each read/write, including nested references and background jobs.
- Separate authorisation for route change, booking acceptance, hazardous/temperature handling, financial buy-rate access, event correction and external provider credential use.
- Reject mass assignment, forged tenant headers, path IDOR, service-to-service confused deputy, replayed callbacks, operation escalation and data exfiltration via filtering/export.

## 4. Credential and integration boundary
External carriers supply their own protocol credentials, scoped by **tenant/legal entity + external provider + operation + environment**. Keep credentials in managed secret store, never Git, DB plaintext, event payload, logs, DevContainer, test fixture or public artifact. Require rotation/revocation, emergency disable, bounded TTL, independent staging/prod, cryptographic webhook verification, replay nonce/timestamp controls and auditable operator break-glass.

Keycloak federation and multi-provider IAM are details of IAM, not TMS obligations to implement a new identity system. Provider native driver login cannot independently mint Baobab authority. Sensitive evidence may be obtained from Trade Docs only via authorised projection/read scope, not raw object URL possession.

## 5. Threat and privacy controls
Model scenarios: forged GPS/pickup proof; carrier impersonation; malicious document link; tampered booking callback; traffic/location inference; tenant privilege escalation; replay of movement departure; SSRF by external carrier webhook; PII leak in logs; compromised fleet device; bulk scraping tracking tokens; unsafe dispatch override. Controls include schema validation, allowlisted egress, request size limits, signed payloads, rate limiting, secure-by-default errors, trace redaction, approval audit, encryption and privacy-safe retention.

Higher-risk changes (release despite customs hold, dangerous-goods acceptance, unsafe vehicle overrides) require evidence of independently authorised override if lawful; a technical admin role is not legal authority.

## 6. Implementation gates
| Gate | Security proof |
|---|---|
| TMS-SEC-01 | Threat model, actor/resource/action matrix and trust-boundary diagrams |
| TMS-SEC-02 | IAM audience/token, CP caller binding, context expiry/revocation/tenant tests |
| TMS-SEC-03 | IDOR/cross-tenant negative tests across APIs, SQL, workers, projections and callbacks |
| TMS-SEC-04 | Per-provider scoped secrets, rotation, revoked credential, signed/replayed webhook tests |
| TMS-SEC-05 | GPS/driver/customer confidentiality, tracking token expiry/revocation and retention tests |
| TMS-SEC-06 | Dependency/SBOM/vulnerability scan, penetration testing and independent release sign-off |

No deployment environment or credential authority is provisioned by this architecture decision.

## 7. Alternatives rejected and ownership consistency

Reject implicit ownership transfer from Trade, ERP, Trade Docs, Regulations, CP or IAM; vendor-native IDs as canonical IDs; shared cross-engine databases; market- or tenant-specific forks; untrusted callback acceptance; and any optimistic success caused by absent authoritative evidence. Contract changes require Shared acceptance; provider activation and certification require independent CP/EA-09 evidence.

## 8. Traceability and implementation status

Design intent inherits [ADR-TMS-0001](https://github.com/baobab-platform/baobab-tms/tree/main/docs/adr), [ADR-TMS-0002](https://github.com/baobab-platform/baobab-tms/tree/main/docs/adr) and [TMS-TECH-01](https://github.com/baobab-platform/baobab-tms/tree/main/docs/architecture); cross-engine relationships follow [Shared](https://github.com/baobab-platform/shared). Implement each listed gate in a bounded PR and add source, tests, conformance fixtures, operational evidence and documented deferrals. The repository does not gain a working engine simply by merging this ADR.
