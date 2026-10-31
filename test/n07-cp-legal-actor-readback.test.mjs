import test from "node:test";
import assert from "node:assert/strict";
import {createN07TmsLegalActorReader,N07LegalActorDenied} from "../src/security/n07-cp-legal-actor-readback.mjs";

const moment=Date.parse("2026-10-31T12:00:00Z");
const uuid="10000000-0000-4000-8000-000000000008";
const operationReference="tms.booking.submit:reviewed-operation-1";
const input={
  contextId:uuid,market:"ZA",operationReference,
  accessToken:"synthetic-tms-own-context-token",
};
const expectedEntity="THAMANI-ZA";
const base={
  context_id:uuid,operation_reference:operationReference,
  provider_permissions_granted:false,
  legal_actor_resolution:{
    outcome:"AUTHORIZED",evaluated_at:new Date(moment-1000).toISOString(),
    policy_reference:"owner-review-opaque",mandate_id:"20000000-0000-4000-8000-000000000008",
    responsible_legal_entity_id:expectedEntity,evidence_references:["receipt-opaque"],
    valid_until:new Date(moment+120000).toISOString(),
  },
};
function fixture(changes={},status=200){
  const calls=[];
  const fetcher=async(u,init)=>{
    calls.push({u,init});
    return Response.json({...base,...changes}, {status});
  };
  return {calls,reader:createN07TmsLegalActorReader({
    cpOrigin:"https://cp.example.test",expectedLegalEntityId:expectedEntity,
    now:()=>moment,fetcher,
  })};
}
test("real CP LA-05A legal-actor protocol binds service-provider booking to context, cannot execute",async()=>{
  const x=fixture();
  const y=await x.reader.assess(input);
  assert.deepEqual(x.calls.map(v=>v.u),["https://cp.example.test/internal/legal-actor/v1/assess"]);
  assert.deepEqual(JSON.parse(x.calls[0].init.body),{
    context_id:uuid,role:"SERVICE_PROVIDER_OF_RECORD",
    activity:"B2B_TRANSPORT_BOOKING",market:"ZA",operation_reference:operationReference,
  });
  assert.equal(x.calls[0].init.headers.Authorization,"Bearer "+input.accessToken);
  assert.equal(y.legalActorCurrent,true);
  assert.equal(y.validUntil,moment+5000);
  assert.equal(y.canExecute,false);
  assert.equal(y.providerAuthorized,false);
  assert.ok(!JSON.stringify(y).includes("receipt-opaque"));
  await assert.rejects(x.reader.execute(),N07LegalActorDenied);
});
test("unknown mandate, foreign legal entity, stale or fake grant fail even when CP says 200",async()=>{
  const bad=[
    {provider_permissions_granted:true},
    {context_id:"30000000-0000-4000-8000-000000000008"},
    {operation_reference:"other-operation"},
    {legal_actor_resolution:{...base.legal_actor_resolution,outcome:"NO_APPLICABLE_MANDATE"}},
    {legal_actor_resolution:{...base.legal_actor_resolution,responsible_legal_entity_id:"FOREIGN-LTD"}},
    {legal_actor_resolution:{...base.legal_actor_resolution,valid_until:new Date(moment-100).toISOString()}},
    {legal_actor_resolution:{...base.legal_actor_resolution,evaluated_at:new Date(moment-6000).toISOString()}},
    {legal_actor_resolution:{...base.legal_actor_resolution,evidence_references:[]}},
    {legal_actor_resolution:{...base.legal_actor_resolution,mandate_id:"none"}},
  ];
  for(const change of bad){
    const x=fixture(change);
    await assert.rejects(x.reader.assess(input),N07LegalActorDenied);
  }
});
test("caller cannot choose activity, role, market, or operation grant",async()=>{
  const x=fixture();
  for(const change of [
    {contextId:"foreign"}, {market:"US"},{market:"za"},
    {operationReference:"tms.native.provision:reviewed-operation"},
    {accessToken:"bearer-too-short"},
  ]){
    await assert.rejects(x.reader.assess({...input,...change}),N07LegalActorDenied);
  }
});
test("requires current TLS CP and source-configured canonical legal entity",()=>{
  for(const change of [
    {cpOrigin:"http://cp.example.test"},
    {cpOrigin:"https://untrusted:pass@cp.example.test"},
    {cpOrigin:"https://cp.example.test/secret"},
    {expectedLegalEntityId:"00000000-0000-4000-8000-000000000008"},
    {expectedLegalEntityId:"thamani-za"},
  ]){
    assert.throws(()=>createN07TmsLegalActorReader({
      cpOrigin:"https://cp.example.test",expectedLegalEntityId:expectedEntity,
      ...change}),N07LegalActorDenied);
  }
});
test("CP outage is held and cannot be relabeled as authority",async()=>{
  const x=fixture({},503);
  await assert.rejects(x.reader.assess(input),N07LegalActorDenied);
});
