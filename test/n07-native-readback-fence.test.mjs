import test from "node:test";
import assert from "node:assert/strict";
import {createN07NativeAuthorityPreflight,N07NativePreflightDenied} from "../src/security/n07-native-readback-fence.mjs";

const ctx="10000000-0000-4000-8000-000000000008";
const expected={tenantId:"tn_tmsleased",organisationId:"019a0915-a8c0-7000-8000-000000000002",
  marketId:"market-za",purpose:"RUNTIME"};
const subjectToken="synthetic-original-current-subject";
const request={
  subjectToken,validatorToken:"synthetic-CP-separate-validator",
  contextId:ctx,expected,
  nativeRequest:{
    token:subjectToken,
    request:{
      contextId:ctx,operation:"tms.booking.submit",
      expectedScope:{
        tenantId:expected.tenantId,
        operatingOrganisationId:expected.organisationId,
        marketId:expected.marketId,
      },
    },
  },
};
function fixture({readerError=false,nativeError=false,readback={}}={}) {
  const steps=[];
  const reader={
    observe:async ()=>{
      steps.push("real-issuer-cp");
      if(readerError)throw new Error("real current provider unavailable");
      return {status:"REAL_ISSUER_CP_HTTP_READBACK_UNATTESTED",
        currentIssuerObserved:true,currentCpContextObserved:true,
        canExecute:false,canActivate:false,...readback};
    },
  };
  const native={
    assess:async ()=>{
      steps.push("native-proof-only");
      if(nativeError)throw new Error("current CP native status absent");
      return {status:"PROOF_ONLY_NOT_EXECUTABLE",canExecute:false,canActivate:false};
    },
    execute:async()=>{steps.push("DANGEROUS-NATIVE-EXECUTION");throw new Error("never call");},
  };
  return {steps,fence:createN07NativeAuthorityPreflight({realIssuerCp:reader,nativeAuthority:native})};
}
test("live IAM/CP source result precedes native guard and cannot imply booking",async()=>{
  const f=fixture(),r=await f.fence.assess(request);
  assert.deepEqual(f.steps,["real-issuer-cp","native-proof-only"]);
  assert.equal(r.status,"REAL_CONTEXT_AND_NATIVE_PREFLIGHT_NON_EXECUTABLE");
  assert.equal(r.canExecute,false);
  assert.equal(r.bookingAccepted,false);
  await assert.rejects(f.fence.execute(),N07NativePreflightDenied);
  assert.deepEqual(f.steps,["real-issuer-cp","native-proof-only"]);
});
test("issuer/CP outage, suspicious success, or native missing proof fails before effects",async()=>{
  for(const options of [{readerError:true},{nativeError:true},
    {readback:{canExecute:true}},{readback:{status:"SIGNED_FIXTURE_NOT_REAL_HTTP"}},
    {readback:{currentIssuerObserved:false}}]) {
    const f=fixture(options);
    await assert.rejects(f.fence.assess(request),N07NativePreflightDenied);
    assert.ok(!f.steps.includes("DANGEROUS-NATIVE-EXECUTION"));
    if(options.readerError || options.readback)
      assert.deepEqual(f.steps,["real-issuer-cp"]);
  }
});
test("foreign organisation, cross tenant, wrong market, token and operation all refuse",async()=>{
  for(const changes of [
    {subjectToken:"other-current-token"},
    {contextId:"20000000-0000-4000-8000-000000000008"},
    {expected:{...expected,tenantId:"tn_foreign"}},
    {expected:{...expected,marketId:"market-ug"}},
    {nativeRequest:{...request.nativeRequest,request:{
      ...request.nativeRequest.request,operation:"tms.booking.intent.create"}}},
    {nativeRequest:{...request.nativeRequest,request:{
      ...request.nativeRequest.request,expectedScope:{
        ...request.nativeRequest.request.expectedScope,tenantId:"tn_foreign"}}}},
  ]) {
    const f=fixture();
    await assert.rejects(f.fence.assess({...request,...changes}),N07NativePreflightDenied);
    assert.equal(f.steps.length,0);
  }
});
