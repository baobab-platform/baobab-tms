import test from "node:test";
import assert from "node:assert/strict";
import {inspect} from "../scripts/hybrid/qualify-fleetbase-source.mjs";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
test("census retains HELD and detects vendor PHP drift",()=>{
 const root=mkdtempSync(join(tmpdir(),"hyb01-")),core=join(root,"core"),ops=join(root,"ops");
 const save=(base,path,contents)=>{const p=join(base,path);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,contents);};
 try{
 save(core,"api/composer.json",JSON.stringify({license:"AGPL-3.0-or-later",require:{php:">=8.0 <8.3","fleetbase/fleetops-api":"^0.6.74"}}));
 save(core,"api/composer.lock",JSON.stringify({packages:Array.from({length:22},(_,i)=>({name:i===0?"fleetbase/fleetops-api":i===1?"fleetbase/core-api":"dep/"+i,version:"0.6.74",source:{reference:"a".repeat(40)}}))}));
 save(ops,"composer.json",JSON.stringify({name:"fleetbase/fleetops-api",version:"0.6.74",license:"AGPL-3.0-or-later"}));
 for(const dir of [core,ops])save(dir,"LICENSE.md","GNU Affero General Public License");
 save(core,"docker/Dockerfile",'FROM dunglas/frankenphp:1.13.2-php8.2-bookworm\nRUN install-php-extensions \nRUN php -r \'PHP_VERSION, "8.2.35"\'\n');
 save(core,"docker-compose.yml","image: mysql:8\ncache: redis:7\nQUEUE_CONNECTION: redis\nSOCKETCLUSTER_AUTH_MODE: enforce");
 save(core,"socket/package.json",JSON.stringify({engines:{node:">=22"}}));
 const r=inspect(core,ops);assert.equal(r.status,"HYB01_HELD_NOT_NATIVE_RUNTIME_OR_LICENCE_CERTIFIED");
 assert.equal(r.composer.fleetops.reviewedSourceMatchesLock,false);
 save(core,"api/composer.json",JSON.stringify({license:"AGPL-3.0-or-later",require:{php:"^8.4","fleetbase/fleetops-api":"^0.6.74"}}));
 assert.throws(()=>inspect(core,ops),/contract drift/);
 } finally {rmSync(root,{recursive:true,force:true});}
});
