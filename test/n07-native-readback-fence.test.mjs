import test from "node:test";
import assert from "node:assert/strict";
import {
  createN07NativeAuthorityPreflight,N07NativePreflightDenied,
} from "../src/security/n07-native-readback-fence.mjs";

const ctx="10000000-0000-4000-8000-000000000008";
const expected={
  tenantId:"tn_tmsleased",organisationId:"019a0915-a8c0-7000-8000-000000000002",
  marketId:"market-za",countryCode:"ZA",purpose:"RUNTIME",
};
const subjectToken="original-issuer-tms-subject-token";
const request={
  subjectToken,validatorToken:"separate-CP-context-validator-token",
  legalActorToken:"separate-CP-legal-actor-token",
  contextId:ctx,expected,nativeRequest:{
    token:subjectToken,request:{
      contextId:ctx,bindingId:"reviewed-native-binding",operation:"tms.booking.submit",
      expectedScope:{
        tenantId:expected.tenantId,operatingOrganisationId:expected.organisationId,
        marketId:expected.marketId,
      },
    },
  },
};
function fixture({issuerError=false,legalError=false,nativeError=false,
  legalChanged=false,legalExpired=false,observed={}}={}){
  const steps=[];let checked=0;
  const realIssuerCp={observe:async()=>{
    steps.push("issuer-current-CP-current-issuer-current");
    if(issuerError)throw Error("issuer or CP unavailable");
    return {status:"REAL_ISSUER_CP_HTTP_READBACK_UNATTESTED",
      currentIssuerObserved:true,currentCpContextObserved:true,
      canExecute:false,canActivate:false,...observed};
  }};
  const legalActorReader={assess:async({contextId,market,operationReference,accessToken})=>{
    steps.push("CP-LA05A-legal-current");
    if(legalError)throw Error("legal actor revoked");
    assert.equal(contextId,ctx);
    assert.equal(market,"ZA");
    assert.equal(operationReference,"tms.booking.submit:reviewed-native-binding");
    assert.equal(accessToken,request.legalActorToken);
    checked++;
    return {
      source:"CP_LA05_CURRENT_AUTHORIZED_MANDATE_ONLY",
      role:"SERVICE_PROVIDER_OF_RECORD",operation:"tms.booking.submit",contextId:ctx,
      legalActorCurrent:true,canExecute:false,providerAuthorized:false,
      mandateDigest:legalChanged&&checked===2?"b".repeat(64):"a".repeat(64),
      validUntil:legalExpired?0:Date.now()+3000,
    };
  }};
  const nativeAuthority={
    assess:async()=>{
      steps.push("native-HYB04-proof-only");
      if(nativeError)throw Error("native operation authority missing");
      return {status:"PROOF_ONLY_NOT_EXECUTABLE",canExecute:false,canActivate:false};
    },
    execute:async()=>{steps.push("DANGEROUS-NATIVE-EXECUTION");throw Error("never call");},
  };
  return {steps,fence:createN07NativeAuthorityPreflight({
    realIssuerCp,legalActorReader,nativeAuthority,
  })};
}
test("real issuer+CP, current legal actor, native guard, second legal read all precede refused booking",async()=>{
  const f=fixture(),r=await f.fence.assess(request);
  assert.deepEqual(f.steps,[
    "issuer-current-CP-current-issuer-current","CP-LA05A-legal-current",
    "native-HYB04-proof-only","CP-LA05A-legal-current",
    "issuer-current-CP-current-issuer-current"]);
  assert.equal(r.status,"REAL_ISSUER_CP_LEGAL_AND_NATIVE_PREFLIGHT_NON_EXECUTABLE");
  assert.equal(r.legalMandateObserved,true);
  assert.equal(r.canExecute,false);
  assert.equal(r.bookingAccepted,false);
  await assert.rejects(f.fence.execute(),N07NativePreflightDenied);
  assert.ok(!f.steps.includes("DANGEROUS-NATIVE-EXECUTION"));
});
test("issuer, CP legal, native provider outage or mandate change veto",async()=>{
  for(const option of [{issuerError:true},{legalError:true},{nativeError:true},
    {legalChanged:true},{legalExpired:true},
    {observed:{canExecute:true}},{observed:{currentIssuerObserved:false}}]){
    const f=fixture(option);
    await assert.rejects(f.fence.assess(request),N07NativePreflightDenied);
    assert.ok(!f.steps.includes("DANGEROUS-NATIVE-EXECUTION"));
  }
});
test("wrong resource scope, operation, credentials or country refused before calling real services",async()=>{
  for(const changes of [
    {subjectToken:"other-workload"},
    {validatorToken:subjectToken},
    {legalActorToken:request.validatorToken},
    {contextId:"20000000-0000-4000-8000-000000000008"},
    {expected:{...expected,tenantId:"tn_foreign"}},
    {expected:{...expected,marketId:"market-ug"}},
    {expected:{...expected,countryCode:"US"}},
    {expected:{...expected,purpose:"TENANT_PROVISIONING"}},
    {nativeRequest:{...request.nativeRequest,request:{
      ...request.nativeRequest.request,operation:"tms.booking.intent.create"}}},
    {nativeRequest:{...request.nativeRequest,request:{
      ...request.nativeRequest.request,expectedScope:{
        ...request.nativeRequest.request.expectedScope,tenantId:"tn_foreign"}}}},
  ]){
    const f=fixture();
    await assert.rejects(f.fence.assess({...request,...changes}),N07NativePreflightDenied);
    assert.equal(f.steps.length,0);
  }
});
