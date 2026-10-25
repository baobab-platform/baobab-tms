/**
 * HYB-02 actual pinned Open TMS S3FileStorage + MinIO tenant IAM acceptance.
 *
 * Runs inside a disposable docker-only S3 network, no public ports. Uses real
 * vendor S3 adapter and real MinIO IAM policy, not a mocked S3 endpoint.
 * Test authority is synthetic; real CP+IAM and full vendor wiring remain HELD.
 */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { S3FileStorage } from "./backend/src/storage/S3FileStorage.js";
import { bindTenantBinaryStorage } from "./hyb-storage-boundary.mjs";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const endpoint = "http://hyb-s3-minio:9000";
const region = "us-east-1";

function config(bucket, user, pass) {
  if (!user || !pass) throw new Error("No ephemeral tenant S3 credentials");
  return {
    endpoint, region, bucket, forcePathStyle: true,
    accessKeyId: user, secretAccessKey: pass
  };
}
const credsA = [process.env.HYB_S3_A_USER, process.env.HYB_S3_A_PASS];
const credsB = [process.env.HYB_S3_B_USER, process.env.HYB_S3_B_PASS];
const a = new S3FileStorage(config("hyb-tenant-a", ...credsA));
const b = new S3FileStorage(config("hyb-tenant-b", ...credsB));
const aWrongBucket = new S3FileStorage(config("hyb-tenant-b", ...credsA));
const bWrongBucket = new S3FileStorage(config("hyb-tenant-a", ...credsB));

function bound(native, tenantId, organisationId) {
  return bindTenantBinaryStorage(native, {
    source: "CP", status: "CURRENT_AUTHORISED",
    tenantId, organisationId
  });
}
async function forbidden(action) {
  await assert.rejects(action, e =>
    e?.$metadata?.httpStatusCode === 403 ||
    ["AccessDenied", "Forbidden"].includes(e?.name),
    "S3 cross-tenant request must be forbidden by actual bucket IAM policy");
}
const objectsA = bound(a,A,A), objectsB = bound(b,B,B);
const sibling = bound(a,A,C);
const idA = await objectsA.store(Buffer.from("A-object-secret"));
const idB = await objectsB.store(Buffer.from("B-object-secret"));
assert.equal((await objectsA.retrieve(idA)).toString(),"A-object-secret");
assert.equal((await objectsB.retrieve(idB)).toString(),"B-object-secret");
assert.equal(await sibling.exists(idA),false);
assert.equal(await objectsA.exists(idB),false);
assert.equal(await objectsB.exists(idA),false);
await assert.rejects(objectsB.retrieve(idA));
await assert.rejects(objectsA.retrieve(idB));

// Identical physical keys in two buckets must remain independent.
const duplicate = "synthetic-isolated-key";
await a.store(duplicate,Buffer.from("same-key-A"));
await b.store(duplicate,Buffer.from("same-key-B"));
assert.equal((await a.retrieve(duplicate)).toString(),"same-key-A");
assert.equal((await b.retrieve(duplicate)).toString(),"same-key-B");

// Test native operations under deliberately wrong bucket mapping. The
// vendor class cannot enforce this alone; MinIO IAM *must* deny it.
await forbidden(() => aWrongBucket.retrieve(duplicate));
await forbidden(() => bWrongBucket.retrieve(duplicate));
await forbidden(() => aWrongBucket.store("cross-write",Buffer.from("should-deny")));
await forbidden(() => bWrongBucket.store("cross-write",Buffer.from("should-deny")));
await forbidden(() => aWrongBucket.delete(duplicate));
await forbidden(() => bWrongBucket.delete(duplicate));

// Listing is a separate permission; read/write denial is not sufficient.
const s3A = new S3Client(config("hyb-tenant-a",...credsA));
const s3B = new S3Client(config("hyb-tenant-b",...credsB));
await s3A.send(new ListObjectsV2Command({Bucket:"hyb-tenant-a",MaxKeys:10}));
await s3B.send(new ListObjectsV2Command({Bucket:"hyb-tenant-b",MaxKeys:10}));
await forbidden(() => s3A.send(new ListObjectsV2Command({Bucket:"hyb-tenant-b"})));
await forbidden(() => s3B.send(new ListObjectsV2Command({Bucket:"hyb-tenant-a"})));

// Real native presigned GET and expiry enforcement by the S3 server.
const signed = await objectsA.getSignedUrl(idA,30);
const ok = await fetch(signed,{signal:AbortSignal.timeout(10000)});
assert.equal(ok.status,200);
assert.equal(await ok.text(),"A-object-secret");
const maliciousUrl = await aWrongBucket.getSignedUrl(duplicate,30);
const rejected = await fetch(maliciousUrl,{signal:AbortSignal.timeout(10000)});
assert.equal(rejected.status,403);
const oneSecondUrl = await objectsA.getSignedUrl(idA,1);
await new Promise(resolve=>setTimeout(resolve,2500));
const expired = await fetch(oneSecondUrl,{signal:AbortSignal.timeout(10000)});
assert.equal(expired.status,403,"Expiry must be enforced by S3 server");

// Own delete is effective; B data and a sibling org object are unchanged.
const siblingId = await sibling.store(Buffer.from("A-sibling"));
await objectsA.delete(idA);
assert.equal(await objectsA.exists(idA),false);
assert.equal((await objectsB.retrieve(idB)).toString(),"B-object-secret");
assert.equal((await sibling.retrieve(siblingId)).toString(),"A-sibling");

// Vendor S3FileStorage has raw-key access: a request routed around the CP
// boundary can access a known physical key within its credential's bucket.
// This proof MUST NOT be promoted to complete native runtime qualification.
console.log(JSON.stringify({
  result:"NATIVE_MINIO_BUCKET_IAM_AND_OBJECT_SCOPE_PASSED",
  cases:["native_s3_store_retrieve","bucket_IAM_cross_read",
    "bucket_IAM_cross_write","bucket_IAM_cross_delete",
    "bucket_IAM_cross_list","signed_GET_positive",
    "signed_wrong_bucket_denied","signed_URL_expiry","CP_bound_org_prefix"],
  hold:"VENDOR_RAW_S3_STORAGE_BYPASS_REQUIRES_CP_BOUND_RUNTIME_PORT"
}));
