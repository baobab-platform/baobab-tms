# HYB-02 worker, EDI and storage scope qualification increment

**Date:** 2026-10-25. Governing Accepted ADR-TMS-0020/0021; project owner requires HYB-02 to be complete before resuming Fleetbase HYB-01. **Gate status: HELD, operation-level proof in progress.** Never equate passing limited tests with certifying all native paths.

This increment extends merged TMS PRs #9–11. Real pinned upstream Open TMS (DominicFinn/open_tms at 623adec1370f1a85a92766cd0a028f7a451dab95) runs in *two independent native API/database/worker deployments*. Each has two distinct orgs. An additional test runner launches the native PgBossQueueAdapter with the actual EDI retry and customer-webhook retry worker functions, real TradingPartnerRepository/OutboundEdiDeliveryService/CustomerWebhookDeliveryService, vendor DatabaseBinaryStorage and GeneratedDocumentRepository against live PostgreSQL 17. Synthetic HTTP acknowledgment receivers listen on loopback only; no real trading partners, external dispatch, callbacks or credentials.

## Acceptance proofs (CI-only when green)

- Native EDI: A and B partner profiles with explicit outbound 214 grants, a deliberately forged A-log referencing B-partner, two failed legitimate logs. Native pg-boss sends and consumes retry command. Only A/B own HTTP receivers get actual synthetic payloads; wrong-org partner lookup and forged retry are denied; linked logs are read back with org scoping and retry count.
- Customer webhook retries: actual failed delivery rows across orgs, native retry worker + pg-boss, genuine HMAC signatures sent to loopback receivers, own-tenant signature accepted, foreign-tenant signature rejected, wrong-org retry by id denied, successful attempt-count update. This does not test real Internet endpoint delivery, TLS or replay-attack defence.
- Document binary: native database binary store and native GeneratedDocumentRepository live on PG17. Both orgs can read their own content and document metadata; cannot read/delete a foreign document through the repository or bound storage wrapper. The new Baobab tenant-bound adapter issues server-generated opaque UUIDs, constructs CP-context-bound physical keys, refuses arbitrary path/fully-qualified key input, and caps signed URL lifetime. Native vendor raw adapters **accept arbitrary physical keys**, so bypassing that wrapper is unsafe. The wrapper is **not currently wired to the full native vendor runtime** and the test uses synthetic CP-style authority, not live CP.
- A/B independent app instances from PR #11 continue to be verified, with no application or database host ports published and full synthetic teardown.

## Findings and release prohibition

| Surface | Source-observed fact | Required release action |
|---|---|---|
| EDI retry | Vendor scheduler intentionally scans failed EDI logs across all orgs, then passes log orgId into scoped repository/delivery | Prove all EDI transaction variants, races, replay, DLQ, SSRF protections, credential rotation, negative carrier authority and external source receipts |
| Customer webhook | Scheduler scans all failed webhook deliveries; retry uses webhook owner's org and signs with its webhook secret | Prove endpoint allowlist/SSRF prevention, DNS changes, HMAC rotation, replay, outbound network policy and signed acknowledgment custody |
| BinaryStore | Vendor DatabaseBinaryStorage and S3FileStorage accept storage key alone, without orgId | Wire CP-authorised tenant-bound Baobab storage port to every native codepath before any activation, prove no direct raw bypass |
| S3/MinIO | Vendor S3FileStorage supports configured endpoint, bucket and credentials but does not enforce org-prefixed object keys | Qualify real isolated S3 bucket policies, separate credentials, cross-bucket access denial, signed URL expiry, listing/delete denial and purge |
| Document metadata | GeneratedDocumentRepository filters orgId in reads/deletes, but binary key may be accessed directly by raw adapter | Bind signed URL issuance to CP context and scoped document permissions at the last execution point |
| Native scheduled workers | Various per-database cron jobs and event buses run outside the narrow EDI/webhook test suite | Prove every worker class, queue/topic namespace, DLQ, retry/replay, old-tenant envelope, isolation after restart and shutdown |
| End-to-end source of authority | Native AuthService JWT is **not** Baobab IAM; synthetic CP marker **not** CP proof | HYB-03/04 must verify CP current grants, IAM issuer/audience/revocation, provider binding, custody and native readback |

Treat S3, scheduled worker families, comprehensive webhook/EDI security, IAM/CP and storage-runtime wiring as **HELD** until positive *and* negative tests are recorded. This repo stores no production secrets, carrier documents or real tenant information. Do not present a native carrier booking as acknowledged based on a synthetic HTTP 200 response.
