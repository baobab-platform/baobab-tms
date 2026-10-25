import test from "node:test";
import assert from "node:assert/strict";
import {createCpNativeBinaryFence,NativeStorageDenied} from "../src/adapters/cp-native-binary-fence.mjs";

const id=(c)=>c.repeat(8)+"-"+c.repeat(4)+"-4"+c.repeat(3)+"-8"+c.repeat(3)+"-"+c.repeat(12);
const a={tenantId:id("1"),organisationId:id("2"),bindingId:id("3"),operationId:id("4")};
const b={...a,organisationId:id("5")};
const now=()=>500000;
function fixture() {
 const db=new Map();let permitted=true;const audit=[];
 const raw={
  async store(k,v){db.set(k,v);},async retrieve(k){if(!db.has(k))throw Error("Not found");return db.get(k);},
  async exists(k){return db.has(k);},async delete(k){db.delete(k);},
  async getSignedUrl(k,ttl){return k+":"+ttl;}
 };
 const verifyCurrent=async query=>{audit.push(query);return permitted?{
   ...query,source:"CP_VERIFIED",decision:"ALLOW",verifiedUntil:now()+1000
 }:null};
 const fence=createCpNativeBinaryFence({raw,verifyCurrent,now});
 return {fence,db,audit,revoke:()=>permitted=false};
}
test("missing verifier, scope, and raw physical key are denied",async()=>{
 assert.throws(()=>createCpNativeBinaryFence({raw:{}}),NativeStorageDenied);
 const {fence}=fixture(),key=fence.logicalKey();
 await assert.rejects(fence.provider.retrieve(key),NativeStorageDenied);
 await assert.rejects(fence.runInScope(a,()=>fence.provider.retrieve("t/evil/files/"+id("6"))),NativeStorageDenied);
});
test("same logical UUID scoped by canonical tenant and organisation at every operation",async()=>{
 const {fence,db,audit}=fixture(),key=fence.logicalKey();
 await fence.runInScope(a,async()=>{
  assert.equal(await fence.provider.store(key,Buffer.from("owner-A")),key);
  assert.equal((await fence.provider.retrieve(key)).toString(),"owner-A");
  assert.equal(await fence.provider.exists(key),true);
 });
 await fence.runInScope(b,async()=>{
  assert.equal(await fence.provider.exists(key),false);
  await assert.rejects(fence.provider.retrieve(key),/Not found/);
  await fence.provider.store(key,Buffer.from("owner-B"));
  assert.equal((await fence.provider.retrieve(key)).toString(),"owner-B");
 });
 assert.equal(db.size,2);
 assert.deepEqual([...new Set(audit.map(x=>x.organisationId))].sort(),[a.organisationId,b.organisationId].sort());
});
test("revocation and stale context deny even an already-entered worker callback",async()=>{
 const {fence,revoke}=fixture(),key=fence.logicalKey();
 await fence.runInScope(a,async()=>{
  await fence.provider.store(key,Buffer.from("before"));
  revoke();
  await assert.rejects(fence.provider.retrieve(key),NativeStorageDenied);
  await assert.rejects(fence.provider.delete(key),NativeStorageDenied);
 });
});
test("concurrent worker scopes do not bleed context; bounded presign",async()=>{
 const {fence}=fixture(),key=fence.logicalKey();
 const results=await Promise.all([a,b].map(s=>fence.runInScope(s,async()=>{
  await new Promise(resolve=>setImmediate(resolve));
  await fence.provider.store(key,Buffer.from(s.organisationId));
  assert.equal((await fence.provider.retrieve(key)).toString(),s.organisationId);
  assert.match(await fence.provider.getSignedUrl(key,20),/binary\/[0-9a-f-]+:20$/);
  await assert.rejects(fence.provider.getSignedUrl(key,3600),NativeStorageDenied);
  return s.organisationId;
 })));
 assert.equal(new Set(results).size,2);
});
