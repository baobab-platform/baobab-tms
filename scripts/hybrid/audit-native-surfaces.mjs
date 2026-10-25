#!/usr/bin/env node
/**
 * HYB-02 native source admission census, pinned Open TMS upstream.
 * This script is deliberately a BLOCKING DRIFT DETECTOR, not a claim that
 * every native execution path is already certified. Security-critical vendor
 * source changes must update the classification, implementation, and tests.
 */
import {readFileSync,readdirSync,statSync,existsSync} from "node:fs";
import {join,relative} from "node:path";
import {execFileSync} from "node:child_process";

const sha="623adec1370f1a85a92766cd0a028f7a451dab95";
const nativeFiles=[
 "backend/src/di/modules/core.ts",
 "backend/src/worker.ts"
];
const consumers=[
 "backend/src/routes/attachments.ts",
 "backend/src/routes/documents.ts",
 "backend/src/routes/theme.ts",
 "backend/src/routes/themeAdmin.ts",
 "backend/src/services/DocumentGenerationService.ts",
 "backend/src/di/modules/tms.ts"
];
const outbound=[
 ["backend/src/services/OutboundEdiDeliveryService.ts",1],
 ["backend/src/services/webhooks/CustomerWebhookDeliveryService.ts",2]
];
const workers=[
 "carrierTrackingPollWorker.ts","carrierUserAnonymizeWorker.ts",
 "cutoffMonitorWorker.ts","documentGenerationWorker.ts",
 "ediRetryWorker.ts","etaMonitorWorker.ts","financialCronWorkers.ts",
 "inboundWebhookWorker.ts","orderAutoArchiveWorker.ts",
 "slaMonitorWorker.ts","waveAutoReleaseWorker.ts",
 "webhookRetryWorker.ts"
].sort();

export function examineNativeSource(root) {
 const read=p=>readFileSync(join(root,p),"utf8");
 const walk=(base,acc=[])=>{
  for(const e of readdirSync(base,{withFileTypes:true})){
   const p=join(base,e.name);
   if(e.isDirectory()) walk(p,acc);
   else if(e.isFile() && /\.(?:ts|mts)$/.test(e.name))acc.push(relative(root,p).replaceAll("\\","/"));
  }
  return acc;
 };
 const all=walk(join(root,"backend/src"));
 const constructors=all.filter(p=>/\bnew\s+(?:DatabaseBinaryStorage|S3FileStorage)\s*\(/.test(read(p))).sort();
 if(JSON.stringify(constructors)!==JSON.stringify(nativeFiles.sort()))
  throw Error("Unclassified raw native binary constructor: "+JSON.stringify(constructors));
 for(const p of [...nativeFiles,...consumers]) {
  if(!existsSync(join(root,p)))throw Error("Missing reviewed native storage surface "+p);
 }
 for(const p of consumers) {
  if(!/IBinaryStorageProvider|storageProvider|binaryStorage/.test(read(p)))
   throw Error("Native storage caller changed: "+p);
 }
 for(const [p,count] of outbound) {
  const n=(read(p).match(/\bfetch\s*\(/g)||[]).length;
  if(n!==count)throw Error("Native EDI/webhook egress callsite drift "+p+" ("+n+")");
 }
 const actualWorkers=readdirSync(join(root,"backend/src/workers")).filter(x=>x.endsWith(".ts")).sort();
 if(JSON.stringify(actualWorkers)!==JSON.stringify(workers))
  throw Error("Native scheduled/consumer worker inventory changed: "+JSON.stringify(actualWorkers));
 return {
  status:"SOURCE_CENSUS_PINNED_NATIVE_ENFORCEMENT_NOT_YET_WIRED",
  rawConstructors:constructors,
  reviewedConsumers:consumers,
  trustedOutboundCandidates:outbound.map(x=>x[0]),
  scheduledWorkerFiles:workers,
  holds:[
    "CP_CURRENT_VERIFICATION_CLIENT_NOT_YET_CONNECTED",
    "NATIVE_API_AND_WORKER_STORAGE_FENCE_COMPOSITION_NOT_YET_WIRED",
    "DIRECT_VENDOR_FETCH_CALLS_NOT_YET_REPLACED",
    "REMAINING_WORKER_DLQ_REPLAY_NOT_YET_QUALIFIED"
  ]
 };
}
if(process.argv[1]?.endsWith("audit-native-surfaces.mjs")) {
 const root=process.argv[2];
 if(!root)throw Error("Usage: audit-native-surfaces.mjs PINNED_VENDOR_CHECKOUT");
 const got=execFileSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
 if(got!==sha)throw Error("Pinned Open TMS revision drift");
 process.stdout.write(JSON.stringify(examineNativeSource(root),null,2)+"\n");
}
