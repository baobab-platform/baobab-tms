#!/usr/bin/env node
/* HYB-01 Fleetbase/Fleet-Ops source and licence qualification; does not admit runtime. */
import {readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
const expected={fleetbase:"9c5e164e5476b6038d24653f6e557b43aa27959c",fleetops:"33032e53ebee5e4a514970ee2379c12348c77c54"};
const read=(r,p)=>readFileSync(join(r,p),"utf8");
const json=(r,p)=>JSON.parse(read(r,p));
export function inspect(core,ops) {
 const host=json(core,"api/composer.json"),ext=json(ops,"composer.json"),lock=json(core,"api/composer.lock"),socket=json(core,"socket/package.json");
 const docker=read(core,"docker/Dockerfile"),compose=read(core,"docker-compose.yml");
 if(host.require.php!==">=8.0 <8.3"||host.require["fleetbase/fleetops-api"]!=="^0.6.74"||
    ext.name!=="fleetbase/fleetops-api"||ext.version!=="0.6.74"||ext.license!=="AGPL-3.0-or-later"||
    host.license!=="AGPL-3.0-or-later")throw Error("HYB-01 PHP/Fleet-Ops/license contract drift");
 if(!/GNU Affero General Public License/.test(read(core,"LICENSE.md")+read(ops,"LICENSE.md")))
   throw Error("HYB-01 license contents drift");
 if(!docker.includes("dunglas/frankenphp:1.13.2-php8.2-bookworm")||
   !docker.includes('"8.2.35"')||!docker.includes("install-php-extensions")||
   !/image: mysql:8/.test(compose)||!/redis:/i.test(compose)||
   !compose.includes("QUEUE_CONNECTION: redis")||!compose.includes("SOCKETCLUSTER_AUTH_MODE")||
   socket.engines.node!==">=22")throw Error("HYB-01 runtime assumptions drift");
 if(!Array.isArray(lock.packages)||lock.packages.length<20)throw Error("HYB-01 composer.lock missing");
 const locked=n=>lock.packages.find(x=>x.name===n);
 const opsPkg=locked("fleetbase/fleetops-api"),corePkg=locked("fleetbase/core-api");
 if(!opsPkg||!corePkg)throw Error("HYB-01 core/Fleet-Ops Composer artifacts missing");
 return {
  schema:"baobab.tms.hyb01.fleetbase-source.v1",
  source:{fleetbase:expected.fleetbase,fleetops:expected.fleetops},
  runtime:{phpRange:host.require.php,patchedPHP:"8.2.35",frankenphp:"1.13.2",
   database:"MySQL 8",cacheQueue:"Redis",realtime:"SocketCluster",socketNode:socket.engines.node},
  composer:{packages:lock.packages.length,
   fleetops:{version:opsPkg.version,revision:opsPkg.source?.reference??null,
     reviewedSourceMatchesLock:opsPkg.source?.reference===expected.fleetops},
   core:{version:corePkg.version,revision:corePkg.source?.reference??null},
   unpinnedSources:lock.packages.filter(p=>!(/^[0-9a-f]{40}$/).test(p.source?.reference??"")).length},
  legal:{sourceLicences:["AGPL-3.0-or-later","AGPL-3.0-or-later"],
    commercialAgreement:"NOT_PROVIDED",legalDisposition:"HELD"},
  status:"HYB01_HELD_NOT_NATIVE_RUNTIME_OR_LICENCE_CERTIFIED",
  activatedOperations:[],
  blockers:["FLEETBASE_COMMERCIAL_OR_AGPL_LEGAL_APPROVAL",
    "EXACT_FLEETOPS_PACKAGED_SOURCE_AND_COMPOSER_LOCK_RECONCILIATION",
    "LOCKED_NATIVE_PHP_INSTALL_MIGRATION_EXECUTION",
    "SUPPORTED_PATCHED_IMAGE_SBOM_CVE_AND_BUILD_PROVENANCE",
    "TENANT_SAFE_NATIVE_API_WORKER_SCHEDULER_SOCKET_QUALIFICATION",
    "IAM_CP_NATIVE_EXECUTION_BINDING_AND_READBACK"]
 };
}
if(process.argv[1]?.endsWith("/qualify-fleetbase-source.mjs")){
 const root=process.argv[2];if(!root)throw Error("Expected directory containing fleetbase and fleetops pinned source");
 for(const [dir,sha] of Object.entries(expected)){
  const actual=execFileSync("git",["-C",join(root,dir),"rev-parse","HEAD"],{encoding:"utf8"}).trim();
  if(actual!==sha)throw Error("HYB-01 upstream revision mismatch: "+dir);
 }
 const result=inspect(join(root,"fleetbase"),join(root,"fleetops"));
 if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify(result,null,2));
}
