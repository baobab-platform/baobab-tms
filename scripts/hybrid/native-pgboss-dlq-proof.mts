/**
 * HYB-02 native PgBoss DLQ/recovery acceptance on synthetic Postgres17.
 * Source worker = pinned upstream createDocumentGenerationWorker.
 *
 * A native external effect may succeed before a worker crashes; replay must
 * NOT perform that effect again. The fixture persists a synthetic operation
 * receipt in PostgreSQL before throwing, then uses a reconciler rather than
 * blindly invoking the worker after DLQ.
 *
 * NOT a CP/IAM-connected production replay implementation.
 */
import assert from "node:assert/strict";
import { PgBoss } from "pg-boss";
import { PrismaClient } from "@prisma/client";
import { createDocumentGenerationWorker } from "./backend/src/workers/documentGenerationWorker.js";

const db = new PrismaClient();
const boss = new PgBoss(process.env.DATABASE_URL);
const tenant = process.env.HYB_REPLAY_TENANT;
if (!["A","B"].includes(tenant)) throw Error("Synthetic tenant marker required");

const work="hyb-native-document-failure";
const dead=work+".dead";
const replayQueue="hyb-native-reconciliation";
const operationId="hyb-duplicate-proof-"+tenant;
const orgId=tenant==="A"?"11111111-1111-4111-8111-111111111111":
  "22222222-2222-4222-8222-222222222222";
const payloadDigest="a".repeat(64);
let workerCalls=0;
const docService={
  async generateBOL(scope,entityId) {
    assert.equal(scope,orgId);
    assert.equal(entityId,"synthetic-shipment");
    workerCalls++;
    const row=await db.$queryRawUnsafe(
      "INSERT INTO public.hyb_native_effect (operation_id,payload_digest,org_id) "+
      "VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING operation_id",
      operationId,payloadDigest,orgId
    );
    assert.equal(row.length,1,"First effect should be durable");
    // Simulate genuine crash or lost ACK AFTER side-effect commitment.
    throw Error("SYNTHETIC_UNKNOWN_OUTCOME_AFTER_COMMIT");
  }
};
const docRepo={async mergeMetadata(){throw Error("No document output expected");}};
const nativeDocumentWorker=createDocumentGenerationWorker(docService,docRepo);

async function waitFor(probe,label) {
  for(let i=0;i<90;i++) {
    if(await probe()) return;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw Error("No bounded native pg-boss "+label+" observation");
}
let bossStarted=false;
try {
  await db.$connect();
  await db.$executeRawUnsafe(
    "CREATE TABLE public.hyb_native_effect ("+
    "operation_id text PRIMARY KEY, payload_digest text NOT NULL, org_id text NOT NULL)");
  await boss.start(); bossStarted=true;
  await boss.createQueue(dead,{retryLimit:0,deleteAfterSeconds:7200});
  await boss.createQueue(work,{
    retryLimit:0,deadLetter:dead,deleteAfterSeconds:7200,expireInSeconds:60
  });
  await boss.createQueue(replayQueue,{
    retryLimit:0,deleteAfterSeconds:7200,expireInSeconds:60
  });
  await boss.work(work,{localConcurrency:1,pollingIntervalSeconds:0.5},
    async jobs=>{
      for(const job of jobs)await nativeDocumentWorker(job.data);
    });
  const message={
    type:"document.generation",payload:{
      kind:"bol",entityId:"synthetic-shipment",orgId,
      correlationId:operationId,requestedBy:null,templateId:null
    },metadata:{canonicalOperationId:operationId,payloadDigest}
  };
  const failedJobId=await boss.send(work,message,{retryLimit:0});
  assert(failedJobId);
  await waitFor(async()=>{
    const count=await db.$queryRawUnsafe(
      "SELECT COUNT(*)::int AS count FROM pgboss.job WHERE name=$1 AND state='created'",dead);
    return Number(count[0]?.count)>0;
  },"dead-letter move");
  assert.equal(workerCalls,1,"One real native handler invocation");
  const committed=await db.$queryRawUnsafe(
    "SELECT payload_digest,org_id FROM public.hyb_native_effect WHERE operation_id=$1",
    operationId);
  assert.equal(committed.length,1);
  assert.equal(committed[0].org_id,orgId);
  assert.equal(committed[0].payload_digest,payloadDigest);

  // The native DLQ is real. Recover the message but route to a reconciliation
  // lane instead of blindly re-running the native document effect.
  const candidate=await boss.fetch(dead,{batchSize:1});
  assert.equal(candidate?.length,1);
  assert.equal(candidate[0].data.metadata.canonicalOperationId,operationId);
  const reconciled=[];
  await boss.work(replayQueue,{localConcurrency:1,pollingIntervalSeconds:0.5},
    async jobs=>{
      for(const job of jobs){
        const operation=job.data.metadata?.canonicalOperationId;
        const digest=job.data.metadata?.payloadDigest;
        assert.equal(operation,operationId);
        const receipt=await db.$queryRawUnsafe(
          "SELECT payload_digest FROM public.hyb_native_effect WHERE operation_id=$1",operation);
        if(receipt.length===1&&receipt[0].payload_digest===digest){
          // No native re-execution: unknown outcome requires audited external
          // source readback, here represented by a synthetic durable receipt.
          reconciled.push("ALREADY_COMMITTED_REQUIRES_OWNER_RECONCILIATION");
        }else {
          throw Error("Unrecognised or contradictory replay payload");
        }
      }
    });
  const r1=await boss.send(replayQueue,candidate[0].data);
  const r2=await boss.send(replayQueue,candidate[0].data);
  assert(r1&&r2);
  await waitFor(async()=>reconciled.length===2,"reconciliation-only replay");
  await boss.complete(dead,candidate[0].id);
  const actual=await db.$queryRawUnsafe("SELECT COUNT(*)::int AS count FROM public.hyb_native_effect");
  assert.equal(Number(actual[0].count),1,"Replay must not duplicate native effect");
  assert.equal(workerCalls,1,"Native worker must not be blindly replayed");

  console.log(JSON.stringify({
    result:"NATIVE_PGBOSS_DLQ_UNKNOWN_OUTCOME_REPLAY_FENCED",
    tenant, tests:[
      "actual_upstream_document_worker", "effect_before_crash",
      "real_dead_letter_queue", "synthetic_durable_receipt",
      "reconciliation_lane_not_native_replay",
      "two_duplicate_job_replays_one_effect"
    ],status:"SYNTHETIC_DLQ_PROOF_ONLY"
  }));
} finally {
  if(bossStarted)await boss.stop({graceful:false}).catch(()=>{});
  await db.$disconnect();
}
