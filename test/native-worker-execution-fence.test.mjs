import test from "node:test";
import assert from "node:assert/strict";
import {createNativeWorkerFence,NativeWorkerDenied,NATIVE_WORKER_ADMISSION} from "../src/security/native-worker-execution-fence.mjs";

let clock=()=>10000;
const envelope={tenantId:"t",organisationId:"o",bindingId:"b",operationId:"op1",
  idempotencyKey:"idempotent-1",payloadDigest:"a".repeat(64),
  workerKind:"edi-retry",cpFencingGeneration:1};
function setup() {
 let grant=true;const state=new Map();const journal=[];
 const ledger={
  async claim(e) {
   const key=e.tenantId+"/"+e.bindingId+"/"+e.operationId;
   const v=state.get(key);
   if(v)return {outcome:v.status==="COMPLETED"?"COMPLETED":v.status==="UNKNOWN"?"UNKNOWN":"ACTIVE",
     payloadDigest:v.digest,leaseGeneration:v.generation};
   const row={status:"CLAIMED",digest:e.payloadDigest,generation:1};state.set(key,row);
   return {outcome:"CLAIMED",leaseGeneration:1};
  },
  async complete(e,generation) {
   const row=state.get(e.tenantId+"/"+e.bindingId+"/"+e.operationId);
   if(!row||row.status!=="CLAIMED"||row.generation!==generation)return false;
   row.status="COMPLETED";journal.push("COMPLETED");return true;
  },
  async markUnknown(e,generation) {
   const row=state.get(e.tenantId+"/"+e.bindingId+"/"+e.operationId);
   if(row&&row.generation===generation&&row.status==="CLAIMED"){
     row.status="UNKNOWN";journal.push("UNKNOWN");
   }
  }
 };
 const verifyCurrent=async e=>grant?{...e,source:"CP_VERIFIED",decision:"ALLOW",verifiedUntil:clock()+1000,decisionId:"cp-test"}:null;
 const fence=createNativeWorkerFence({verifyCurrent,ledger,
   certifiedOperations:new Set(["edi-retry"]),now:clock});
 return {fence,revoke:()=>grant=false,state,journal};
}
test("all twelve scheduled/consumer categories classified, only granted operation runnable",async()=>{
 assert.equal(Object.keys(NATIVE_WORKER_ADMISSION).length,12);
 const {fence}=setup();
 await assert.rejects(fence.execute({...envelope,workerKind:"document-generation"},async()=>{}),NativeWorkerDenied);
 await assert.rejects(fence.execute({...envelope,workerKind:"new-unknown-job"},async()=>{}),NativeWorkerDenied);
});
test("exact same transport operation replays once, even with duplicate job IDs",async()=>{
 const {fence,journal}=setup();let effects=0;
 const one=await fence.execute(envelope,async()=>++effects);
 assert.equal(one.status,"COMPLETED");
 const dup=await fence.execute({...envelope,jobId:"replayed-native-job-2"},async()=>++effects);
 assert.equal(dup.status,"ALREADY_COMPLETED");assert.equal(effects,1);
 assert.deepEqual(journal,["COMPLETED"]);
 await assert.rejects(fence.execute({...envelope,payloadDigest:"b".repeat(64)},async()=>++effects),NativeWorkerDenied);
});
test("revocation and uncertain external outcome never silently retry",async()=>{
 const {fence,revoke,state}=setup();let effects=0;
 await assert.rejects(fence.execute(envelope,async()=>{effects++;revoke();return 200;}),NativeWorkerDenied);
 assert.equal(effects,1);
 assert.equal([...state.values()][0].status,"UNKNOWN");
 await assert.rejects(fence.execute(envelope,async()=>{effects++;return 200;}),NativeWorkerDenied);
 assert.equal(effects,1);
});
test("CP revocation while acquiring durable claim prevents any external effect",async()=>{
 let grant=true,effects=0;
 const ledger={
  async claim(){grant=false;return {outcome:"CLAIMED",leaseGeneration:1};},
  async complete(){throw Error("must never complete");},
  async markUnknown(){return true;}
 };
 const verifyCurrent=async e=>grant?{
  ...e,source:"CP_VERIFIED",decision:"ALLOW",verifiedUntil:clock()+1000,decisionId:"cp-test"
 }:null;
 const fence=createNativeWorkerFence({verifyCurrent,ledger,certifiedOperations:new Set(["edi-retry"]),now:clock});
 await assert.rejects(fence.execute(envelope,async()=>{effects++;}),NativeWorkerDenied);
 assert.equal(effects,0,"No external effect may begin after claim-time revocation");
});
test("malformed or missing identity, concurrency and stale generation fail closed",async()=>{
 const {fence}=setup();
 for(const changed of [{tenantId:""},{payloadDigest:"wrong"},{cpFencingGeneration:0}]){
  await assert.rejects(fence.execute({...envelope,...changed},async()=>{}),NativeWorkerDenied);
 }
 let effects=0;
 const ops=await Promise.allSettled([0,1].map(()=>fence.execute(envelope,async()=>{
   effects++;await new Promise(resolve=>setImmediate(resolve));return effects;
 })));
 assert.equal(ops.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(effects,1);
});
