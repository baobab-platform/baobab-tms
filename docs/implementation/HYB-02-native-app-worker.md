# HYB-02 — Native Open TMS application and background-worker qualification

Status: **CONNECTED TEST IN IMPLEMENTATION, NOT CERTIFIED**. Accepted ADR-TMS-0020/0021; Shared canonical authority unchanged.

## What is executable in this increment

The new `hyb-native-app-worker.yml` GitHub Actions workflow launches the **actual pinned upstream** `DominicFinn/open_tms@623adec1370f1a85a92766cd0a028f7a451dab95` TypeScript Fastify application and its actual standalone integrations worker (WORKER_MODE=integrations) with PostgreSQL 17. This complements, but does not erase, the native Prisma migration and synthetic database tests in PRs #8/#9.

Two orthogonal isolation boundaries are included:

1. Two synthetic Organisations in one real Open TMS database: create separate native User, Customer, Role, and WebhookLog records. Use real upstream AuthService.login to issue **native** JWTs and real Fastify endpoints to test authorised per-org customer lists, foreign-record GET 404, cross-org update 404, missing/bad bearer denial, missing-organisation denial with two orgs, positive own-org command execution, and read-back of unchanged foreign data.
2. Dedicated native PostgreSQL 17 data planes A and B: independent private network and volume, native migration chain on both databases, and a standalone worker with a scoped connection to data plane A. Native PgBossQueueAdapter enqueues an A-org worker message referencing B-org's webhook row, plus a valid A-org message. The actual upstream inbound webhook worker must **not mutate B's row** and must process and acknowledge A's benign message.

No external real carriers, regulatory authorities, CP tenants, production IAM or secrets are involved. All source files are cloned by immutable SHA; the test is copied into a **disposable checkout**, and no vendor source is committed to Baobab. Native DB passwords are randomly created per run. The native app runs with a dedicated synthetic application role (not the database superuser); no DB host ports are published. The post-job cleanup destroys the containers, volumes and temporary credentials.

## Risk ledger and explicit limits

- This checks selected customer API operations and the inbound webhook background worker. It is **not a census of every native endpoint, read-model, report, file export, scheduler or queue consumer**. All untested operation grants remain blocked.
- AuthService.login produces **vendor-native** JWTs, not Ory/Keycloak/Hydra credentials. IAM audience, issuer, token revocation and CP canonical Principal/Organisation/Market/role/authority must be qualified in subsequent HYB-03/HYB-04. Even with this test passing, no native token may be treated as Baobab platform authorisation.
- The upstream documented nullable operational catalogue `orgId` fields have not been re-engineered, audited or proven safe. No provider admission for those resources.
- Worker proof is the real upstream `PgBossQueueAdapter` / `worker.ts` / `createInboundWebhookWorker`, but not the complete outbound EDI, scheduled jobs, object storage, job replay, credential rotation, driver GPS, carrier acknowledgments or end-to-end audit custody.
- Upstream source's bootstrap and 2026 dependency lifecycle may need remediations; this CI runs an ephemeral qualification only, not a production native provider deployment.
- No multi-tenant capability can be advertised, activated, or routed through CP until operation-specific native isolation, lifecycle, legal and credential provenance pass.

## Acceptance progression

| Dimension | Required for HYB-02 closure |
| --- | --- |
| Pinned native PG17 Prisma migrations and isolated tenant A/B SQL | Delivered and green in PR #9 |
| Actual Fastify and native token-scoped positive and negative reads/writes | This PR; must be green with genuine native app |
| Actual pg-boss standalone native worker handling own and wrong-org webhook messages | This PR; must be green and leave foreign record untouched |
| EDI/Trade Docs emissions, job retries/DLQ, native object store, carrier tracking, multi-org exports, health/restarts | Remain HELD |
| CP/IAM connected identity and provider provisioning, independent evidence/teardown | Remain HELD |
| Fleetbase native runtime/licensing choice (HYB-01) | **Deliberately deferred as requested** |

Failing the native tests is a **real blocker**. A green run narrows risk but **cannot** be promoted as the full HYB-02 gate or proof of operational carrier execution.

## HYB-02 dual native deployment increment (PR after #10)

A second native Fastify/pg-boss pair is now launched on a **separate internal Docker network, separate PostgreSQL 17 native database, separate application database principal, and separate signing and application secrets**. The same authentic upstream Prisma/AuthService/worker negative and positive tests must pass in B, concurrently with the already-live A runtime. Explicit A-to-B and B-to-A native HTTP connection attempts must fail; there are no published application or database host ports. Tenant A and B may intentionally contain the same synthetic UUIDs, making accidental shared native data plane or route resolution observable through network/config evidence.

This is stronger multi-instance negative evidence than only separating two databases. It still does not certify fleet telematics sockets, multiple background job types, S3/MinIO bucket credentials, outbound EDI, arbitrary query/export surfaces, actual issuer trust, CP binding or independently witnessed production disposal. Those HYB-02 acceptance cases remain HELD pending direct native tests and governance review. HYB-01 Fleetbase runtime/licensing remains **deferred** on Platform Owner instruction.
