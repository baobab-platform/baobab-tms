import test from "node:test";
import assert from "node:assert/strict";
import { createN07NativeAdmissionResource } from "../src/http/n07-native-resource.mjs";

const ctx="10000000-0000-4000-8000-000000000008";
const expected={
  tenantId:"tn_tmsleased",organisationId:"019a0915-a8c0-7000-8000-000000000002",
  marketId:"market-za",countryCode:"ZA",purpose:"RUNTIME",
};
const sourceOwned={
  contextId:ctx,validatorToken:"independent-cp-validator-bearer",
  legalActorToken:"separate-cp-legal-actor-bearer",
  expected,operation:"tms.booking.submit",bindingId:"reviewed-native-binding",
  nativeRequestFactory:(token)=>({
    token,request:{contextId:ctx,operation:"tms.booking.submit",
      bindingId:"reviewed-native-binding",
      expectedScope:{
        tenantId:expected.tenantId,
        operatingOrganisationId:expected.organisationId,
        marketId:expected.marketId,
      }},
  }),
};
async function ownedServer(t,{answer={canExecute:false,bookingAccepted:false}}={}){
  const previous=process.env.BAOBAB_ENVIRONMENT;
  process.env.BAOBAB_ENVIRONMENT="development";
  const calls=[];
  const preflight={
    assess:async request=>{calls.push(request);return answer;},
    execute:async()=>{throw new Error("native command must not run");},
  };
  const server=createN07NativeAdmissionResource({sourceOwned,preflight});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(async()=>{
    await new Promise(resolve=>server.close(resolve));
    if(previous===undefined)delete process.env.BAOBAB_ENVIRONMENT;
    else process.env.BAOBAB_ENVIRONMENT=previous;
  });
  return {url:"http://127.0.0.1:"+server.address().port,calls};
}
function post(url,{token="subject-issuer-original-bearer",
  context=ctx,headers={},body={context_id:context}}={}){
  return fetch(url+"/internal/tms/n07/booking/preflight",{
    method:"POST",redirect:"manual",headers:{
      Authorization:"Bearer "+token,"Content-Type":"application/json",
      ...headers},body:JSON.stringify(body),
  });
}
test("private resource does not authorize booking even with matching original current proof",async(t)=>{
  const x=await ownedServer(t);
  const r=await post(x.url);
  assert.equal(r.status,503);
  assert.equal(r.headers.get("cache-control"),"no-store");
  assert.deepEqual(await r.json(),{
    status:"N07_PROOF_OBSERVED_NATIVE_EXECUTION_HELD",
    execution_authority:false,booking_accepted:false,
  });
  assert.equal(x.calls.length,1);
  assert.equal(x.calls[0].subjectToken,"subject-issuer-original-bearer");
  assert.equal(x.calls[0].validatorToken,sourceOwned.validatorToken);
  assert.equal(x.calls[0].legalActorToken,sourceOwned.legalActorToken);
  assert.deepEqual(x.calls[0].expected,expected);
});
test("BFF cookie, alternate legal actor/market or foreign tenant never reach proof reader",async(t)=>{
  const x=await ownedServer(t);
  const outcomes=[
    await post(x.url,{headers:{Cookie:"browser-session=foo"}}),
    await post(x.url,{headers:{"X-Tenant-ID":"tn_foreign"}}),
    await post(x.url,{headers:{"X-Legal-Actor":"FORGED"}}),
    await post(x.url,{headers:{"X-Market":"UG"}}),
    await post(x.url,{context:"20000000-0000-4000-8000-000000000008"}),
    await post(x.url,{token:sourceOwned.validatorToken}),
    await post(x.url,{token:sourceOwned.legalActorToken}),
    await post(x.url,{body:{context_id:ctx,organisation_id:"foreign"}}),
  ];
  for(const r of outcomes){
    assert.ok([403,503].includes(r.status));
    assert.equal((await r.json()).booking_accepted,false);
  }
  assert.equal(x.calls.length,0);
});
test("forged success cannot enable a booked native resource or return a credential",async(t)=>{
  const x=await ownedServer(t,{answer:{canExecute:true,bookingAccepted:true}});
  const r=await post(x.url);
  assert.equal(r.status,503);
  assert.equal((await r.json()).execution_authority,false);
  assert.equal(x.calls.length,1);
});
test("no public booking or forged OPTIONS/GET acceptance exists",async(t)=>{
  const x=await ownedServer(t);
  for(const [method,path] of [["GET","/bookings"],["POST","/v1/bookings"],
    ["OPTIONS","/internal/tms/n07/booking/preflight"]]){
    const r=await fetch(x.url+path,{method,redirect:"manual"});
    assert.equal(r.status,404);
    assert.equal((await r.json()).booking_accepted,false);
  }
  assert.equal(x.calls.length,0);
});
test("native owner must opt into development; cannot start protected listener",async()=>{
  const old=process.env.BAOBAB_ENVIRONMENT;
  process.env.BAOBAB_ENVIRONMENT="production";
  try{
    assert.throws(()=>createN07NativeAdmissionResource({
      sourceOwned,preflight:{assess:async()=>({}),execute:async()=>{}},
    }),/PRIVATE_DEVELOPMENT_ONLY/);
  }finally{
    if(old===undefined)delete process.env.BAOBAB_ENVIRONMENT;
    else process.env.BAOBAB_ENVIRONMENT=old;
  }
});
