import test from "node:test";
import assert from "node:assert/strict";
import {qualifyOutboundDestination,checkPublicAddress,createTrustedOutbound,UntrustedDestinationError} from "../src/security/trusted-native-outbound.mjs";
const ctx={tenantId:"t-1",organisationId:"o-1",partnerId:"p-1",kind:"EDI"};
let now=()=>10000;
const verifyDestination=async input=>({...input,source:"CP_VERIFIED",decision:"ALLOW",hostname:input.host,verifiedUntil:now()+1000});
const lookup=async()=>[{address:"8.8.8.8",family:4},{address:"1.1.1.1",family:4}];
test("reject native caller endpoints, redirects, IP literals and any internal DNS answers",async()=>{
 for (const bad of ["http://public.example.com/api","https://127.0.0.1/","https://user:pass@public.example.com/",
 "https://public.example.com:8443","https://internal.local","https://public.example.com/#secret"]) {
   await assert.rejects(qualifyOutboundDestination({...ctx,url:bad},{verifyDestination,lookup,now}),UntrustedDestinationError);
 }
 for(const ip of ["127.0.0.1","10.1.1.1","172.20.1.1","192.168.1.2","169.254.169.254","::1","fc00::1","::ffff:127.0.0.1"]) {
   assert.throws(()=>checkPublicAddress(ip),UntrustedDestinationError);
 }
 await assert.rejects(qualifyOutboundDestination({...ctx,url:"https://public.example.com/path"},
 {verifyDestination,lookup:async()=>[{address:"8.8.8.8",family:4},{address:"10.0.0.1",family:4}],now}),UntrustedDestinationError);
});
test("deny missing, stale, mismatched CP binding; require trusted HTTPS and DNS pin",async()=>{
 const url="https://carrier.example.com/v1/edi";
 await assert.rejects(qualifyOutboundDestination({...ctx,url},{lookup,now}),UntrustedDestinationError);
 await assert.rejects(qualifyOutboundDestination({...ctx,url},{verifyDestination:async()=>({...ctx,source:"CP_VERIFIED",decision:"ALLOW",hostname:"wrong.example",verifiedUntil:now()+1000}),lookup,now}),UntrustedDestinationError);
 await assert.rejects(qualifyOutboundDestination({...ctx,url},{verifyDestination:async p=>({...p,source:"CP_VERIFIED",decision:"ALLOW",hostname:p.host,verifiedUntil:now()-1}),lookup,now}),UntrustedDestinationError);
 const result=await qualifyOutboundDestination({...ctx,url},{verifyDestination,lookup,now});
 assert.equal(result.ip,"8.8.8.8");assert.equal(result.url.hostname,"carrier.example.com");
});
test("native HTTPS call pins verified IP, never redirects and forbids crafted auth headers",async()=>{
 let captured;const transport={request(url,opt,handler){
  captured={url,opt};
  const listeners={};const req={on(type,fn){listeners[type]=fn;return req;},end(){const res={statusCode:204,on(name,fn){if(name==="end")queueMicrotask(fn);return res;}};handler(res);},destroy(e){listeners.error?.(e);}};
  return req;
 }};
 const sender=createTrustedOutbound({verifyDestination,lookup,transport,now});
 const r=await sender.post(ctx,{url:"https://carrier.example.com/send",content:"EDI",headers:{"Content-Type":"application/edi-x12"}});
 assert.equal(r.accepted,true);
 let cbValue;captured.opt.lookup("carrier.example.com",{},(_error,address,family)=>cbValue={address,family});
 assert.deepEqual(cbValue,{address:"8.8.8.8",family:4});
 assert.equal(captured.opt.servername,"carrier.example.com");assert.equal(captured.opt.rejectUnauthorized,true);
 await assert.rejects(sender.post(ctx,{url:"https://carrier.example.com/send",content:"EDI",headers:{"Host":"internal"}}),UntrustedDestinationError);
});
