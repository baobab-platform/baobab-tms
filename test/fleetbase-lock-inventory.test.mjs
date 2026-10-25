import test from "node:test";
import assert from "node:assert/strict";
import {lockInventory} from "../scripts/hybrid/fleetbase-lock-inventory.mjs";
const pkgs=Array.from({length:22},(_,i)=>({name:"test/pkg-"+i,version:"1.2."+i,source:{reference:"f".repeat(40)},license:["MIT"]}));
test("Preliminary locked CycloneDX inventory never implies deployment",()=>{
 const r=lockInventory({packages:pkgs});
 assert.equal(r.bomFormat,"CycloneDX");assert.equal(r.components.length,22);
 assert.equal(r.metadata.properties.find(x=>x.name==="baobab:license-cleared").value,"false");
});
test("Reject mutable source refs",()=>{
 const list=[...pkgs];list[0]={...list[0],source:{reference:"main"}};
 assert.throws(()=>lockInventory({packages:list}),/Unpinned/);
});
