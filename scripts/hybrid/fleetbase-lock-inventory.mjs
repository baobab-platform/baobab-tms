#!/usr/bin/env node
/* Lock-derived CycloneDX inventory: NOT an installed-package or signed image SBOM. */
import {readFileSync,writeFileSync} from "node:fs";
export function lockInventory(lock) {
 if(!Array.isArray(lock?.packages)||lock.packages.length<20)throw Error("Composer lock required");
 const components=lock.packages.map(p=>{
  if(typeof p.name!=="string"||!p.name.includes("/")||
     typeof p.version!=="string"||!(/^[0-9a-f]{40}$/).test(p.source?.reference??""))
     throw Error("Unpinned Composer source: "+p.name);
  const id="pkg:composer/"+p.name+"@"+encodeURIComponent(p.version);
  const licences=Array.isArray(p.license)?p.license.filter(x=>typeof x==="string"&&x.length>0):[];
  return {type:"library",name:p.name,version:p.version,"bom-ref":id,purl:id,
   ...(licences.length?{licenses:licences.map(x=>({license:{id:x}}))}:{}),
   properties:[
    {name:"baobab:source-reference",value:p.source.reference},
    {name:"baobab:component-bytes-verified",value:"false"}
   ]};
 });
 if(new Set(components.map(x=>x["bom-ref"])).size!==components.length)
   throw Error("Composer component collision");
 return {bomFormat:"CycloneDX",specVersion:"1.5",version:1,
  metadata:{component:{type:"application",name:"Fleetbase lock-derived, NOT INSTALLED",version:"HYB-01"},
   properties:[
    {name:"baobab:qualification",value:"HELD_PRELIMINARY_LOCK_ONLY"},
    {name:"baobab:locked-source",value:"fleetbase/fleetbase@9c5e164e5476b6038d24653f6e557b43aa27959c"},
    {name:"baobab:installed-packages-proven",value:"false"},
    {name:"baobab:license-cleared",value:"false"}
   ]},
  components};
}
if(process.argv[1]?.endsWith("/fleetbase-lock-inventory.mjs")){
 const [lockpath,out]=process.argv.slice(2);
 if(!lockpath||!out)throw Error("Usage: fleetbase-lock-inventory.mjs vendor/api/composer.lock output.json");
 const data=lockInventory(JSON.parse(readFileSync(lockpath,"utf8")));
 writeFileSync(out,JSON.stringify(data,null,2)+"\n");
 console.log(JSON.stringify({status:"PRELIMINARY_LOCK_ONLY_NOT_SBOM_PROOF",count:data.components.length,out}));
}
