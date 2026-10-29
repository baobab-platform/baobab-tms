import test from "node:test";
import assert from "node:assert/strict";
import {buildCpContextValidationRequest,inspectCpValidationReadback,
 TmsContextContractDenied} from "../src/security/cp-context-validation-contract.mjs";
const context="11111111-1111-4111-8111-111111111111";
const now=new Date("2026-10-28T12:00:00.000Z");
const bearer="synthetic-opaque-oauth-token-not-jwt";
const expected={tenantId:"tn_synthetic1",organisationId:"org-canonical-a",
 marketId:"market-za",purpose:"RUNTIME"};
const reply={context_id:context,tenant_id:"tn_synthetic1",
 organisation_id:"org-canonical-a",market_id:"market-za",
 authority_purpose:"RUNTIME",resolved_at:"2026-10-28T11:58:00.000Z",
 expires_at:"2026-10-28T12:03:00.000Z"};
const inspect=(r=reply,e=expected,at=now)=>
 inspectCpValidationReadback({contextId:context,reply:r,expected:e,now:at});
test("CP validate request is exact Shared v1 subject_token body, never client authority",()=>{
 const wire=buildCpContextValidationRequest({contextId:context,subjectToken:bearer});
 assert.deepEqual(Object.keys(wire.body).sort(),["context_id","subject_token"]);
 assert.equal(wire.path,"/v1/platform-context/validate");
 assert.equal(wire.method,"POST");
 assert.equal(wire.body.subject_token,bearer);
 assert.equal(Object.hasOwn(wire.body,"tenant_id"),false);
 assert.equal(Object.hasOwn(wire.body,"principal_id"),false);
 assert.equal(Object.hasOwn(wire.body,"audience"),false);
 for(const bad of [null,"abc", "not-a-jwt", "a".repeat(8193),
   "valid-opaque-token-with-newline\n"])
   assert.throws(()=>buildCpContextValidationRequest({contextId:context,subjectToken:bad}),TmsContextContractDenied);
 assert.throws(()=>buildCpContextValidationRequest({contextId:"not-uuid",subjectToken:bearer}),TmsContextContractDenied);
});
test("correct shaped CP validation is NEVER TMS dispatch or legal-actor permission",()=>{
 const evidence=inspect();
 assert.equal(evidence.status,"CONTEXT_SHAPE_MATCH_ONLY");
 assert.equal(evidence.canExecute,false);
 assert.equal(evidence.canActivate,false);
 assert(evidence.missingAuthority.includes("NO_ATTESTED_LEGAL_ACTOR"));
 assert.equal(JSON.stringify(evidence).includes(bearer),false);
});
test("tenant, operating organisation, market, authority purpose and bound expiry deny",()=>{
 for(const changed of [{tenant_id:"tn_other"},{organisation_id:"org-other"},
  {market_id:"market-ug"},{authority_purpose:"OTHER"},
  {expires_at:"2026-10-28T11:59:59Z"},{expires_at:undefined},
  {resolved_at:"2026-10-28T13:00:00Z"},{legal_entity_id:"legal-fake"},
  {principal_id:"injected"},{expires_at:null},{market_id:null},
  {organisation_id:null},{context_id:"22222222-2222-4222-8222-222222222222"}]){
  assert.throws(()=>inspect({...reply,...changed}),TmsContextContractDenied);
 }
 assert.throws(()=>inspect(reply,{...expected,purpose:"TENANT_PROVISIONING"}),TmsContextContractDenied);
 assert.throws(()=>inspect(reply,expected,null),TmsContextContractDenied);
});
test("bounded approved provisioning tuple matches exactly but STILL cannot provision",()=>{
 const p={tenant_provisioning_id:"tprov_abc",plan_id:"plan_abc",
  plan_version:5,plan_digest:"sha256:"+"a".repeat(64)};
 const r={...reply,authority_purpose:"TENANT_PROVISIONING",provisioning_authority:p};
 const e={...expected,purpose:"TENANT_PROVISIONING",provisioning:p};
 assert.equal(inspect(r,e).canExecute,false);
 for(const changed of [{plan_version:4},{plan_digest:"sha256:"+"b".repeat(64)},
   {plan_id:"plan_other"},{tenant_provisioning_id:"tprov_other"}])
   assert.throws(()=>inspect(r,{...e,provisioning:{...p,...changed}}),TmsContextContractDenied);
 assert.throws(()=>inspect({...r,expires_at:"2026-10-28T12:59:00Z"},e),TmsContextContractDenied);
 assert.throws(()=>inspect({...r,authority_purpose:"RUNTIME"},expected),TmsContextContractDenied);
 assert.throws(()=>inspect({...r,provisioning_authority:null},e),TmsContextContractDenied);
});
test("v1 missing Organisation and Market and extra response scope never fall through",()=>{
 for(const key of ["organisation_id","market_id","authority_purpose","tenant_id","expires_at"]){
  const copy={...reply};delete copy[key];
  assert.throws(()=>inspect(copy),TmsContextContractDenied);
 }
 assert.throws(()=>inspect(reply,{...expected,legalEntityId:"caller-selected"}),TmsContextContractDenied);
});
