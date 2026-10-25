# HYB-02 — real native S3 / MinIO tenant access isolation

**Architecture:** Accepted ADR-TMS-0020/0021, CP authority reserved. **Status:** connected test under qualification, not native runtime-certified storage binding.

The test exercises the pinned Open TMS S3FileStorage implementation rather than a substitute storage adapter. A disposable, internal-only MinIO object store is provisioned with two buckets, two non-root users, unique per-run passwords and explicit allowlist IAM policies. Each user receives ListBucket access to its own bucket and Get/Put/Delete for its own objects only. Native Open TMS revision 623adec1370f1a85a92766cd0a028f7a451dab95 is immutable. The MinIO server test image is a public third-party GitHub Container Registry mirror (coollabsio/minio, release 2025-04-22) pinned by SHA-256 manifest digest a4938f37f1be1841b8e7b627ad0207b265345fd0d063e42d7410c78af0e63e68. The disposable mc test client is a separate public clickhouse/minio-mc mirror (release 2025-04-16) pinned by SHA-256 digest aead63c77f9db9107f1696fb08ecb0faeda23729cde94b0f663edf4fe09728e3. Official Quay and Docker Hub MinIO server release tags could not be pulled in CI; these images are NOT qualified for production, and require mirror provenance verification, supported patch/CVE checks and vendor/legal acceptance before any higher-environment use.

## Live acceptance scope

- Native S3 store/retrieve/delete, identical key in distinct buckets with different contents.
- Cross-bucket GET, PUT, DELETE and LIST explicitly denied by MinIO IAM.
- Baobab bound storage port: synthetic CP-style tenant/org context and server-generated opaque UUID keys, with cross-org lookup denied.
- Real presigned GET succeeds, a foreign-bucket presigned request is refused, and an expired signed URL fails.
- Cleanup destroys the MinIO container, volume, dedicated private network and test credentials. No host ports, real carrier or corporate data.

## Critical limits and remaining HYB-02 obligations

Vendor S3FileStorage and DatabaseBinaryStorage provide NO intrinsic org-level enforcement. An upstream route or worker with direct raw-provider access can bypass Baobab's tenant-bound wrapper if it knows a physical storage key. Before provider activation, enumerate and route every native storage and signed URL call through a CP-authorised provider port, verify actual IAM/CP authority at commitment, preserve independent credential custody and reject direct vendor bypass paths by native integration tests.

Other HYB-02 obligations remain HELD: EDI/webhook egress allowlisting and SSRF defenses, genuine carrier acceptance and unknown-outcome reconciliation, untested scheduled workers and DLQ/replay idempotency, storage key rotation and object deletion, full backup/recovery and independent evidence custody, real IAM token/current CP binding readbacks and revocation.

No production object store or carrier provider is selected or certified by this disposable MinIO test. Owner-directed HYB-01 Fleetbase work remains deferred.
