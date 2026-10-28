import test from "node:test";
import assert from "node:assert/strict";
import {createHeldNativeExecutionAuthority,NativeAuthorityDenied} from "../src/security/iam-cp-native-execution-authority.mjs";
const now=()=>100000;
const contextId="context-ref1";
const expectedScope={
  tenantId:"tenant-a",operatingOrganisationId:"org-a",legalEntityId:"legal-a",
  marketId:"market-za",environment:"development",nativeProviderKind:"FLEETBASE_FLEETOPS"
};
const request={
  contextId,operation:"native.dispatch",bindingId:"bind-a",
  planDigest:"sha256:"+"b".repeat(64),
  cpCapabilityBindingRevision:"rev-3",
  provisioningGeneration:2,expectedScope
};
const token="test-token-placeholder-only";
function fixture({identity={},current={},denyIdentity=false,denyCp=false}={}) {
  const calls={iam:0,cp:0};
  const verifyIamToken=async(v,opts)=>{
    calls.iam++;
    assert.equal(v,token);assert.equal(opts.audience,"baobab-tms-internal");
    if(denyIdentity)throw Error("unavailable");
    return {source:"IAM_VERIFIED",active:true,actorType:"workload",
      subject:"synthetic-sub",issuer:"https://synthetic-issuer.example",
      audience:"baobab-tms-internal",tokenId:"id1",
      notBefore:now()-1000,expiresAt:now()+4000,...identity};
  };
  const redeemCpContext=async input=>{
    calls.cp++;
    if(denyCp)throw Error("unavailable");
    return {source:"CP_READBACK",decision:"ALLOW",
      decisionId:"decision-1",principalId:"principal-1",
      contextId,issuer:input.issuer,subject:input.subject,tokenId:input.tokenId,
      operation:request.operation,bindingId:request.bindingId,
      cpCapabilityBindingRevision:request.cpCapabilityBindingRevision,
      provisioningGeneration:request.provisioningGeneration,
      planDigest:request.planDigest,...expectedScope,
      verifiedUntil:now()+2000,...current};
  };
  const port=createHeldNativeExecutionAuthority({
    verifyIamToken,redeemCpContext,
    expectedAudience:"baobab-tms-internal",
    acceptedIssuers:["https://synthetic-issuer.example"],now
  });
  return {port,calls};
}
test("missing independently configured authority clients rejects construction",()=>{
 assert.throws(()=>createHeldNativeExecutionAuthority({}),NativeAuthorityDenied);
});
test("positive synthetic evidence is NOT a native dispatch grant or activation",async()=>{
 const {port,calls}=fixture();
 const proof=await port.assess({token,request});
 assert.equal(proof.status,"PROOF_ONLY_NOT_EXECUTABLE");
 assert.equal(proof.canExecute,false);
 assert.equal(proof.canActivate,false);
 assert.equal(proof.evidence.bindingId,request.bindingId);
 assert.deepEqual(calls,{iam:1,cp:1});
 await assert.rejects(port.execute(proof,async()=>{}),NativeAuthorityDenied);
});
test("IAM wrong issuer, audience, expired/revoked/native human cannot reach CP",async()=>{
 for(const identity of [
  {issuer:"https://foreign-issuer.example"},
  {audience:"other-service"},
  {active:false},{actorType:"human"},
  {expiresAt:now()-1},{notBefore:now()+100},
  {tokenId:""},{source:"NATIVE_FLEETBASE_TOKEN"}
 ]) {
   const {port,calls}=fixture({identity});
   await assert.rejects(port.assess({token,request}),NativeAuthorityDenied);
   assert.equal(calls.cp,0);
 }
 for(const failure of [{denyIdentity:true},{denyCp:true}]){
   const {port}=fixture(failure);
   await assert.rejects(port.assess({token,request}),NativeAuthorityDenied);
 }
});
test("CP tenant, legal, market, operating organisation and binding must all match",async()=>{
 for(const current of [
  {decision:"DENY"},{source:"NATIVE_ROLE"},{principalId:""},
  {tenantId:"tenant-b"},{legalEntityId:"legal-b"},
  {marketId:"market-ug"},{operatingOrganisationId:"org-b"},
  {bindingId:"bind-b"},{cpCapabilityBindingRevision:"rev-2"},
  {provisioningGeneration:1},{planDigest:"sha256:"+"c".repeat(64)},
  {verifiedUntil:now()-1},{verifiedUntil:now()+6000},
  {issuer:"https://foreign-issuer.example"}, {tokenId:"somebody-else"}
 ]) {
   const {port}=fixture({current});
   await assert.rejects(port.assess({token,request}),NativeAuthorityDenied);
 }
});
test("caller forged scope, unknown native operation, extra credentials and JWT-like object deny",async()=>{
 const {port,calls}=fixture();
 for(const req of [
   {...request, nativeAdminKey:"caller-secret"},
   {...request,operation:"native.book"},
   {...request,expectedScope:{...expectedScope,tenantId:"tenant-b"}},
   {...request,contextId:""},
   {...request,provisioningGeneration:0},
   {...request,expectedScope:{...expectedScope,nativeProviderKind:"constructor"}},
   {...request,expectedScope:{...expectedScope,endpoint:"http://localhost"}}
 ]) {
   await assert.rejects(port.assess({token,request:req}),NativeAuthorityDenied);
 }
 await assert.rejects(port.assess({token:{source:"IAM_VERIFIED"},request}),NativeAuthorityDenied);
 assert.equal(calls.iam,1);
});
test("every fresh assessment independently rechecks IAM and CP; no cached ALLOW",async()=>{
 const {port,calls}=fixture();
 await port.assess({token,request});
 await port.assess({token,request});
 assert.deepEqual(calls,{iam:2,cp:2});
});
