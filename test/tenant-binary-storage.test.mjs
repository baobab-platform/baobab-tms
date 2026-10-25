import { test } from "node:test";
import assert from "node:assert/strict";
import { bindTenantBinaryStorage } from "../src/adapters/tenant-binary-storage.mjs";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
function makeNative() {
  const values = new Map();
  return {
    values,
    async store(key, value) { values.set(key, value); },
    async retrieve(key) { if (!values.has(key)) throw Error("Missing object"); return values.get(key); },
    async exists(key) { return values.has(key); },
    async delete(key) { values.delete(key); },
    async getSignedUrl(key) { return "opaque:" + key; }
  };
}
const bind = (raw, tenantId, organisationId) => bindTenantBinaryStorage(raw, {
  source: "CP", status: "CURRENT_AUTHORISED", tenantId, organisationId
});
test("no implicit source or tenant inference", () => {
  assert.throws(() => bindTenantBinaryStorage(makeNative(), {source:"caller",status:"CURRENT_AUTHORISED",tenantId:A,organisationId:C}));
  assert.throws(() => bind(makeNative(), "bad-id", C));
});
test("tenant and organisation cannot read or mutate each other's raw storage", async () => {
  const raw = makeNative(), a = bind(raw, A, C), b = bind(raw, B, C), sibling = bind(raw, A, B);
  const id = await a.store(Buffer.from("secret-A"));
  assert.equal((await a.retrieve(id)).toString(), "secret-A");
  assert.equal(await b.exists(id), false);
  assert.equal(await sibling.exists(id), false);
  await assert.rejects(b.retrieve(id), /Missing object/);
  assert.throws(() => a.retrieve("t/" + A + "/o/" + C + "/binary/" + id), /Invalid opaque/);
  assert.throws(() => a.delete("../" + id), /Invalid opaque/);
  await b.delete(id);
  assert.equal(await a.exists(id), true);
  assert.equal(raw.values.size, 1);
});
test("signed URL requires native support and bounded expiry", async () => {
  const a = bind(makeNative(), A, C);
  const id = await a.store(Buffer.from("content"));
  assert.match(await a.getSignedUrl(id,45), new RegExp("t/"+A+"/o/"+C+"/binary/"+id));
  await assert.rejects(a.getSignedUrl(id,3600), /range/);
  assert.throws(() => bindTenantBinaryStorage({}, {source:"CP",status:"CURRENT_AUTHORISED",tenantId:A,organisationId:C}));
});
