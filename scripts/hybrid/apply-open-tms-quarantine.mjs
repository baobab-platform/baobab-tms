/**
 * Apply exact-sha, fail-closed Open TMS native API / worker quarantine patch.
 *
 * This does NOT adopt a vendor fork or create a CP authority verifier.
 * Until the real CP authority port is wired, the patched native build rejects
 * all external binary I/O and EDI/customer-webhook HTTP delivery.
 *
 * A source revision change, unknown constructor or unhandled egress call is
 * a hard error, not a best-effort textual patch.
 */
import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from "node:fs";
import {join} from "node:path";
import {execFileSync} from "node:child_process";

const PIN="623adec1370f1a85a92766cd0a028f7a451dab95";
function replaceExact(source,previous,next,count=1,label="source") {
  const found=source.split(previous).length-1;
  if(found!==count)throw Error(label+" drift expected "+count+" saw "+found);
  return source.split(previous).join(next);
}
export function patchNative(root,tms) {
  const sha=execFileSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
  if(sha!==PIN)throw Error("Open TMS source revision is not pinned");
  const file=p=>join(root,p);
  const patched=new Map();
  function load(p) {const s=readFileSync(file(p),"utf8");patched.set(p,s);return s;}
  function set(p,s){patched.set(p,s);}

  const core="backend/src/di/modules/core.ts";
  let s=load(core);
  s=replaceExact(s,"import { IBinaryStorageProvider } from '../../storage/IBinaryStorageProvider.js';",
    "import { IBinaryStorageProvider } from '../../storage/IBinaryStorageProvider.js';\nimport { guardNativeBinary } from '../../baobab/native-binary-quarantine.js';",1,core);
  s=replaceExact(s,"return new S3FileStorage({","return guardNativeBinary(new S3FileStorage({",1,core);
  s=replaceExact(s,"forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',\n      });",
    "forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',\n      }));",1,core);
  s=replaceExact(s,"return new DatabaseBinaryStorage(container.resolve(TOKENS.PrismaClient));",
    "return guardNativeBinary(new DatabaseBinaryStorage(container.resolve(TOKENS.PrismaClient)));",1,core);
  set(core,s);

  const worker="backend/src/worker.ts";
  s=load(worker);
  s=replaceExact(s,"import { S3FileStorage } from './storage/S3FileStorage.js';",
    "import { S3FileStorage } from './storage/S3FileStorage.js';\nimport { guardNativeBinary } from './baobab/native-binary-quarantine.js';",1,worker);
  s=replaceExact(s,"storageProvider = new S3FileStorage({",
    "storageProvider = guardNativeBinary(new S3FileStorage({",1,worker);
  s=replaceExact(s,"forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',\n      });",
    "forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',\n      }));",1,worker);
  s=replaceExact(s,"storageProvider = new DatabaseBinaryStorage(prisma);",
    "storageProvider = guardNativeBinary(new DatabaseBinaryStorage(prisma));",1,worker);
  set(worker,s);

  const edi="backend/src/services/OutboundEdiDeliveryService.ts";
  s=load(edi);
  s="import { nativeOutboundFetch } from '../baobab/native-outbound-quarantine.js';\n"+s;
  s=replaceExact(s,"fetch(partner.httpUrl!, {","nativeOutboundFetch(partner.httpUrl!, {",1,edi);
  s=replaceExact(s,"body: request.ediContent,\n      });",
   "body: request.ediContent,\n      }, {tenantId:'',organisationId:partner.orgId,partnerId:partner.id,kind:'EDI'});",1,edi);
  if(/\bfetch\s*\(/.test(s))throw Error("Unpatched EDI fetch");
  // SFTP must not dial an untrusted native hostname in a quarantine build.
  // Host-key pinning and CP destination policy are required before enabling it.
  s=replaceExact(s,"private async deliverViaSftp(partner: TradingPartnerWithTransactions, request: OutboundDeliveryRequest): Promise<DeliveryResult> {",
    "private async deliverViaSftp(partner: TradingPartnerWithTransactions, request: OutboundDeliveryRequest): Promise<DeliveryResult> {\n    throw new Error('Native SFTP denied without CP approved target and pinned SSH host key');",1,edi);
  set(edi,s);

  const webhook="backend/src/services/webhooks/CustomerWebhookDeliveryService.ts";
  s=load(webhook);
  s="import { nativeOutboundFetch } from '../../baobab/native-outbound-quarantine.js';\n"+s;
  s=replaceExact(s,"fetch(webhook.url, {","nativeOutboundFetch(webhook.url, {",2,webhook);
  s=replaceExact(s,"signal: controller.signal,\n      });",
   "signal: controller.signal,\n      }, {tenantId:'',organisationId:webhook.orgId,partnerId:webhook.id,kind:'WEBHOOK'});",2,webhook);
  if(/\bfetch\s*\(/.test(s))throw Error("Unpatched webhook fetch");
  set(webhook,s);

  const dir=file("backend/src/baobab");
  mkdirSync(dir,{recursive:true});
  copyFileSync(join(tms,"src/adapters/cp-native-binary-fence.mjs"),join(dir,"cp-native-binary-fence.mjs"));
  copyFileSync(join(tms,"src/security/trusted-native-outbound.mjs"),join(dir,"trusted-native-outbound.mjs"));
  copyFileSync(join(tms,"ops/hybrid/native-overlays/open-tms/native-binary-quarantine.ts"),join(dir,"native-binary-quarantine.ts"));
  copyFileSync(join(tms,"ops/hybrid/native-overlays/open-tms/native-outbound-quarantine.ts"),join(dir,"native-outbound-quarantine.ts"));
  for(const [p,value] of patched)writeFileSync(file(p),value);
  return [...patched.keys()];
}
if(process.argv[1]?.endsWith("apply-open-tms-quarantine.mjs")){
  if(process.argv.length!==4)throw Error("Usage: apply-open-tms-quarantine.mjs UPSTREAM_DIR TMS_DIR");
  process.stdout.write(JSON.stringify({
    status:"FAIL_CLOSED_VENDOR_PATCH_APPLIED_NOT_CP_CONNECTED",
    patched:patchNative(process.argv[2],process.argv[3])
  })+"\n");
}
