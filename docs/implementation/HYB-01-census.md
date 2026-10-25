# HYB-01 — Immutable native provider census and release-admission fit gap

**Source audit date:** 2026-10-25. **Current status:** source inventory pinned; **NO native runtime or external carrier operation qualified**. Governing Accepted ADR-TMS-0001/0002/0020/0021 and Shared EA v2.3. Source revisions in `config/hybrid/upstreams.lock.json` are exact Git commits; release image digests, signed SBOMs, dependency scans and native operational conformance remain absent.

## Source identities and observed compatibility

| Provider and exact reviewed source | Licence observed | Build/platform constraints | Current risk |
| --- | --- | --- | --- |
| Fleetbase core `9c5e164e5476b6038d24653f6e557b43aa27959c` | AGPL-3.0 repo | Laravel/PHP; MySQL 8 native; Redis, SocketCluster, async queue, scheduler; upstream compose uses floating API images/root DB, insecure development settings. **Never deploy its compose as-is.** | Legal/commercial AGPL decision required; least privilege, socket authentication and isolated native worker runtime not independently tested |
| Fleet-Ops extension `33032e53ebee5e4a514970ee2379c12348c77c54` | AGPL-3.0-or-later per `composer.json` | Laravel extension, backend `fleetbase/fleetops-api`; upstream composer package currently identifies version 0.6.74; Fleetbase core dependency required | Extension must be pinned with core compatibility and operations tested together; no accepted Baobab native dispatch or tracking |
| Open TMS `623adec1370f1a85a92766cd0a028f7a451dab95` | MIT per GitHub repository metadata (validate licence file in complete legal census) | Fastify/TypeScript/Prisma, `pg-boss`, PostgreSQL 16 upstream compose; current backend Dockerfile uses Node 24 | PG17 requires migration/worker integration proof; upstream tenancy remediation document describes real historical isolation gaps; WMS .NET dependency and seed wipe safety need qualification |

**Source audit is descriptive, not a legal opinion.** Request review of AGPL source-offer obligations for remotely networked modified Fleetbase and available Fleetbase commercial licensing. No vendor code has been copied into Baobab, and no integration is presumed licence-cleared. Source code and dependencies must be inspected at their fixed commit (not `main`) whenever license or security assurance is claimed.

## Operation-level fit and unproven boundaries

| Operation | Fleetbase Fleet-Ops evidence | Open TMS evidence | Platform admission |
| --- | --- | --- | --- |
| Own-fleet dispatch / driver / road tracking | Fleet-Ops API & queue runtime described by upstream | Not primary certified dispatch profile | **BLOCKED:** native request/ack callback, access control, driver ownership, dedicated worker/socket not proven |
| Tender and EDI 204/990/214 | Not primary selected profile | Upstream docs describe tendering/EDI implementation | **BLOCKED:** external carrier acknowledgement/signature and unknown-outcome reconciliation not proven |
| Carrier booking or reservation | Vendor-native order concepts do not equal canonical Booking confirmation | Tracking-centric APIs do not prove carrier-specific booking | **BLOCKED:** operation-level conformance and actual carrier relationship absent |
| Multi-leg custody / POD | Fleetbase device/driver reports possible | Open TMS freight events possible | **BLOCKED:** source provenance, custody acceptance and pinned Trade Docs DocumentVersion absent |
| Native tenant provisioning | Fleetbase organisational models are not CP Tenants | Open TMS orgId risk recorded by upstream | **BLOCKED:** CP-owned desired state, credential custody and independent readback absent |
| Customs/regulatory or finance | Neither vendor sovereign/ledger authority | Neither vendor sovereign/ledger authority | **OUT OF SCOPE**—Regulations, Trade Docs, ERP and real authorities own consequences |

## HYB-01 exit requirements

- [x] Exact upstream code revision and basic licensing metadata documented.
- [x] Automated source-pin/static-assumption tests: `scripts/hybrid/verify-upstreams.mjs`.
- [x] Operation fit-gap, native stack incompatibilities and default security risks documented.
- [ ] Approved Fleetbase AGPL/commercial route and transitive dependency licence review.
- [ ] Locked install + SBOM, CVE scans, current source build and migration test, native API/worker feature matrix at the selected commits.
- [ ] Vendor image content digests, supply-chain provenance, signatures and supported release/patch disposition.
- [ ] Independently accepted security/threat review and scoped pilot provider profile.

`HYB-01` is **PARTIAL/HELD**, not closed by the document or CI source check. `HYB-02` infrastructure below tests independent synthetic data boundaries only and must not be mistaken for upstream native execution qualification.

## References

- https://github.com/fleetbase/fleetbase/tree/9c5e164e5476b6038d24653f6e557b43aa27959c
- https://github.com/fleetbase/fleetops/tree/33032e53ebee5e4a514970ee2379c12348c77c54
- https://github.com/DominicFinn/open_tms/tree/623adec1370f1a85a92766cd0a028f7a451dab95
- https://github.com/DominicFinn/open_tms/blob/623adec1370f1a85a92766cd0a028f7a451dab95/docs/MULTI_TENANCY_REMEDIATION_PLAN.md
- https://github.com/fleetbase/fleetbase/blob/9c5e164e5476b6038d24653f6e557b43aa27959c/docker-compose.yml
