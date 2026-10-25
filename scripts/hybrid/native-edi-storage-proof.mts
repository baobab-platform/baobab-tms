/**
 * HYB-02 runtime EDI/retry/document boundary proof, executed from a disposable
 * pinned Open TMS source checkout with REAL Prisma, pg-boss and native workers.
 * No real carrier endpoints; an HTTP sink binds loopback only.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { TradingPartnerRepository } from "./backend/src/repositories/TradingPartnerRepository.js";
import { OutboundEdiDeliveryService } from "./backend/src/services/OutboundEdiDeliveryService.js";
import { createEdiRetryWorker } from "./backend/src/workers/ediRetryWorker.js";
import { CustomerWebhookDeliveryService, verifySignature } from "./backend/src/services/webhooks/CustomerWebhookDeliveryService.js";
import { createWebhookRetryWorker } from "./backend/src/workers/webhookRetryWorker.js";
import { GeneratedDocumentRepository } from "./backend/src/repositories/GeneratedDocumentRepository.js";
import { DatabaseBinaryStorage } from "./backend/src/storage/DatabaseBinaryStorage.js";
import { PgBossQueueAdapter } from "./backend/src/queue/PgBossQueueAdapter.js";
import { bindTenantBinaryStorage } from "./hyb-storage-boundary.mjs";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const custA = "11111111-1111-4111-8111-111111111113";
const custB = "22222222-2222-4222-8222-222222222223";
const db = new PrismaClient();
const receipts = [];

const server = createServer(async (req, res) => {
  // Loopback-only synthetic carrier/customer endpoint: never contact carriers.
  let body = "";
  for await (const chunk of req) body += chunk.toString();
  receipts.push({path: req.url, body, headers: req.headers});
  res.writeHead(200, {"content-type": "text/plain"});
  res.end("SYNTHETIC-ACK");
});
const callbackAddress = async () => {
  await new Promise((resolve, reject) =>
    server.listen(0, "127.0.0.1", error => error ? reject(error) : resolve()));
  return "http://127.0.0.1:" + server.address().port;
};
async function waitJob(id) {
  for (let n = 0; n < 45; n++) {
    const rows = await db.$queryRawUnsafe("SELECT state::text AS state FROM pgboss.job WHERE id=$1::uuid", id);
    if (rows[0]?.state === "completed") return;
    if (["failed", "cancelled", "expired"].includes(rows[0]?.state))
      throw Error("Native job entered terminal failure state");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw Error("Native queued job not completed within deadline");
}
async function exerciseEdi(base, queue) {
  const repo = new TradingPartnerRepository(db);
  const service = new OutboundEdiDeliveryService(repo);
  const partners = [];
  for (const [org, suffix] of [[A, "A"], [B, "B"]]) {
    const partner = await repo.create({
      orgId: org, name: "Synthetic partner " + suffix,
      entityType: "carrier", outboundEnabled: true,
      outboundTransport: "http", httpUrl: base + "/edi/" + suffix
    });
    await repo.addTransaction({partnerId: partner.id, transactionType: "214",
      direction: "outbound", enabled: true});
    partners.push({id:partner.id, org, suffix});
  }
  const denied = await service.deliver({
    orgId:A, partnerId:partners[1].id, transactionType:"214",
    ediContent:"CROSS-ORG-MUST-NOT-SEND", referenceId:"negative"
  });
  assert.equal(denied.success, false, "A must not send via B partner credentials");
  assert.equal(receipts.length, 0);

  const logs = [];
  for (const partner of partners) {
    const log = await repo.createLog({
      orgId: partner.org, partnerId: partner.id, transactionType:"214",
      direction:"outbound", status:"error",
      fileContent:"EDI-" + partner.suffix,
      shipmentReference:"Synthetic-" + partner.suffix
    });
    logs.push(log);
  }
  // Deliberately forge an inconsistent native row: A-org EDI retry pointing
  // at B-org partner. The actual native worker must not deliver it.
  const spoof = await repo.createLog({
    orgId:A, partnerId:partners[1].id, transactionType:"214",
    direction:"outbound", status:"error",
    fileContent:"FORGED-A-B", shipmentReference:"forged"
  });
  await queue.subscribe("hyb-edi-retry",
    createEdiRetryWorker(db, repo, service), {pollingIntervalSeconds:0.5, concurrency:1});
  const id = await queue.publish("hyb-edi-retry",
    {type:"edi-retry", payload:{test:"synthetic-A-B"}});
  await waitJob(id);
  for (const log of logs) {
    const row = await repo.findLogById(log.id, log.orgId);
    assert.equal(row.status, "success");
    assert.equal(row.retryCount, 1);
  }
  const deniedRetry = await repo.findLogById(spoof.id, A);
  assert.equal(deniedRetry.status, "error");
  assert.equal(deniedRetry.retryCount, 1);
  assert.equal(receipts.length, 2, "Exactly two own-partner native HTTP ACKs");
  assert(receipts.some(r => r.path === "/edi/A" && r.body === "EDI-A"));
  assert(receipts.some(r => r.path === "/edi/B" && r.body === "EDI-B"));
  assert(!receipts.some(r => r.body.includes("FORGED") || r.body.includes("CROSS-ORG")));
  assert.equal(await repo.findLogById(logs[1].id, A), null);
  console.log(JSON.stringify({result:"NATIVE_EDI_RETRY_A_B_ISOLATED",
    cases:["actual_native_partner_lookup","loopback_ack_receipts",
      "pgboss_job_ack","wrong_org_partner_denied","mismatched_retry_denied",
      "no_foreign_log_readback"]}));
}
async function exerciseWebhook(base, queue) {
  const service = new CustomerWebhookDeliveryService(db);
  const fixture = [];
  for (const [org, customerId, suffix] of [[A,custA,"A"],[B,custB,"B"]]) {
    const webhook = await db.customerWebhook.create({data:{
      customerId, orgId:org, name:"Synthetic webhook "+suffix,
      url:base+"/webhook/"+suffix, secret:randomBytes(32).toString("hex"),
      events:["synthetic.created"]
    }});
    const delivery = await db.customerWebhookDelivery.create({data:{
      webhookId:webhook.id, eventType:"synthetic.created",
      payload:{test:"webhook-"+suffix}, status:"failed", attemptCount:1,
      createdAt:new Date(Date.now()-15*60*1000)
    }});
    fixture.push({org,suffix,webhook,delivery});
  }
  await assert.rejects(service.retry(A,fixture[1].delivery.id), /not found/);
  await assert.rejects(service.retry(B,fixture[0].delivery.id), /not found/);
  await queue.subscribe("hyb-webhook-retry",
    createWebhookRetryWorker(service), {pollingIntervalSeconds:0.5, concurrency:1});
  const id = await queue.publish("hyb-webhook-retry",
    {type:"webhook-retry",payload:{test:"A-B"}});
  await waitJob(id);
  for (const row of fixture) {
    const updated = await db.customerWebhookDelivery.findUnique({where:{id:row.delivery.id}});
    assert.equal(updated.status, "delivered");
    assert.equal(updated.attemptCount, 2);
    const hit = receipts.find(r => r.path === "/webhook/" + row.suffix);
    assert(hit, "Native delivery must reach own loopback receiver");
    assert.equal(JSON.parse(hit.body).test,"webhook-"+row.suffix);
    assert(verifySignature(row.webhook.secret,hit.headers["x-opentms-signature"],hit.body),
      "Own HMAC must validate");
    const foreign = fixture.find(x=>x.org!==row.org);
    assert(!verifySignature(foreign.webhook.secret,hit.headers["x-opentms-signature"],hit.body),
      "Foreign org signing key must not validate");
  }
  assert.equal(receipts.filter(r=>r.path.startsWith("/webhook/")).length,2);
  console.log(JSON.stringify({result:"NATIVE_WEBHOOK_RETRY_A_B_HMAC_ISOLATED",
    cases:["pgboss_retry_subscriber","native_org_scoped_delivery","wrong_org_retry_denied",
      "signed_delivery_per_org","cross_org_signature_denied","attempt_count"]}));
}
async function exerciseStorage() {
  const repo = new GeneratedDocumentRepository(db);
  const raw = new DatabaseBinaryStorage(db);
  const scope = org => bindTenantBinaryStorage(raw,{
    source:"CP",status:"CURRENT_AUTHORISED",
    // Synthetic CP-derived context is ONLY a test stand-in; no real CP call.
    tenantId:org,organisationId:org
  });
  const storeA=scope(A),storeB=scope(B);
  const idA=await storeA.store(Buffer.from("private-A-doc"));
  const idB=await storeB.store(Buffer.from("private-B-doc"));
  const docs=[];
  for(const [org,id,suffix] of [[A,idA,"A"],[B,idB,"B"]]){
    docs.push(await repo.create({orgId:org, documentType:"attachment",
      fileName:"synthetic-"+suffix+".txt",
      storageKey:id, storageBackend:"database", mimeType:"text/plain"}));
  }
  for (const [org,own,foreign] of [[A,docs[0],docs[1]],[B,docs[1],docs[0]]]) {
    assert((await repo.findById(org,own.id))?.id===own.id);
    assert.equal(await repo.findById(org,foreign.id),null);
    assert.equal(await repo.delete(org,foreign.id),false);
    assert.equal((await repo.findAll(org)).some(x=>x.id===foreign.id),false);
  }
  assert.equal((await storeA.retrieve(idA)).toString(),"private-A-doc");
  assert.equal((await storeB.retrieve(idB)).toString(),"private-B-doc");
  assert.equal(await storeA.exists(idB),false);
  assert.equal(await storeB.exists(idA),false);
  await assert.rejects(storeA.retrieve(idB),/not found/i);
  await assert.rejects(storeB.retrieve(idA),/not found/i);
  // Vendor's raw DatabaseBinaryStorage itself has NO org scope. Prove and
  // record the risky primitive; NEVER certify bypass of the Baobab port.
  const physicalA = "t/"+A+"/o/"+A+"/binary/"+idA;
  assert.equal((await raw.retrieve(physicalA)).toString(),"private-A-doc");
  console.log(JSON.stringify({result:"NATIVE_BINARY_DOCUMENT_FENCED_BUT_RAW_ADAPTER_UNSAFE",
    cases:["native_binary_db_round_trip","org_scoped_document_queries",
      "foreign_delete_refused","baobab_bound_prefix_denial"],
    hold:"RAW_VENDOR_STORAGE_NOT_ORG_SCOPED_UNTIL_BAOBAB_FENCE_IS_WIRED_AT_RUNTIME"}));
}
try {
  await db.$connect();
  const url=await callbackAddress();
  const queue=new PgBossQueueAdapter(process.env.DATABASE_URL);
  await queue.start();
  try {
    await exerciseEdi(url,queue);
    await exerciseWebhook(url,queue);
    await exerciseStorage();
  } finally {
    await queue.stop();
  }
} finally {
  await new Promise(resolve=>server.close(resolve));
  await db.$disconnect();
}
