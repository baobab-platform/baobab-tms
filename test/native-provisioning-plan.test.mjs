import test from "node:test";
import assert from "node:assert/strict";
import {draftNativeProvisioningPlan,inspectFencedOperation,
  createHeldNativeProvisioningPort,NativeLifecycleHeld} from "../src/governance/native-provisioning-plan.mjs";
const hash=n=>"sha256:"+n.repeat(64);
const desired={
 tenantId:"tenant-a",primaryOrganisationId:"org-parent",
 operatingOrganisationId:"org-a",legalEntityId:"legal-a",
 marketParticipationReference:"ZA-MARKET-REF",
 residenceAndIsolationProfileId:"cp-isolation-za",
 environment:"development",cpProviderId:"baobab-tms",
 cpEngineInstanceId:"tms-dev-a",cpCapabilityBindingRevision:"cp-rev-3",
 nativeProviderKind:"FLEETBASE_FLEETOPS",nativeProviderReleaseDigest:hash("a"),
 policyDigest:hash("b"),desiredStateDigest:hash("c"),
 provisioningGeneration:3,isolationStrategy:"DEDICATED_NATIVE_INSTANCE"
};
const clock=new Date("2026-10-28T09:00:00Z");
const operation=plan=>({
 tenantId:desired.tenantId,operatingOrganisationId:desired.operatingOrganisationId,
 legalEntityId:desired.legalEntityId,
 marketParticipationReference:desired.marketParticipationReference,
 environment:desired.environment,nativeProviderKind:desired.nativeProviderKind,
 cpCapabilityBindingRevision:desired.cpCapabilityBindingRevision,
 provisioningGeneration:desired.provisioningGeneration,
 planDigest:plan.planDigest,cpOperationId:"operation-123",
 cpAuthorizationEvidenceRef:"cp-readback-123",
 idempotencyKey:"fixture1",leaseGeneration:2,
 deadlineAt:"2026-10-28T09:05:00Z"
});
test("Fleetbase dedicated MySQL, Redis, socket lifecycle is deterministic, never approved",()=>{
 const a=draftNativeProvisioningPlan(desired);
 const reordered=Object.fromEntries(Object.entries(desired).reverse());
 const b=draftNativeProvisioningPlan(reordered);
 assert.deepEqual(a,b);
 assert.equal(a.canExecute,false);
 assert.equal(a.canActivate,false);
 assert.equal(a.status,"DRAFT_ONLY_NOT_CP_APPROVED");
 assert.ok(a.steps.some(s=>s.kind.includes("MYSQL8")));
 assert.ok(a.steps.some(s=>s.kind.includes("SOCKETCLUSTER")));
 assert.ok(a.steps.every(s=>s.execution==="HELD"));
 assert.equal(Object.isFrozen(a.scope),true);
});
test("Open TMS distinct PG17 plan and typed provider scope are preserved",()=>{
 const a=draftNativeProvisioningPlan(desired);
 const b=draftNativeProvisioningPlan({...desired,nativeProviderKind:"OPEN_TMS"});
 assert.notEqual(a.planDigest,b.planDigest);
 assert.ok(b.steps.some(s=>s.kind.includes("POSTGRESQL17")));
 assert.equal(b.steps.some(s=>s.kind.includes("MYSQL8")),false);
});
test("No caller-supplied native host, database, secrets, context or custom steps",()=>{
 for(const extra of [
  {nativeDatabase:"shared_prod"},{nativeAdminToken:"secret"},
  {nativeApiUrl:"https://example.com"},{tenantOverride:"other"},
  {steps:[]},{status:"ACTIVE"}]) {
  assert.throws(()=>draftNativeProvisioningPlan({...desired,...extra}),NativeLifecycleHeld);
 }
 for(const changed of [
  {nativeProviderReleaseDigest:"latest"},{provisioningGeneration:0},
  {environment:"prod"},{legalEntityId:""},{isolationStrategy:"SHARED_DB"},
  {policyDigest:null},{tenantId:"t; DROP TABLE"},
  {nativeProviderKind:"constructor"},{nativeProviderKind:"toString"}]) {
  assert.throws(()=>draftNativeProvisioningPlan({...desired,...changed}),NativeLifecycleHeld);
 }
});
test("Changing legal scope, generation or policy changes the draft plan digest",()=>{
 const baseline=draftNativeProvisioningPlan(desired).planDigest;
 for(const changed of [
  {tenantId:"tenant-b"},{legalEntityId:"legal-b"},
  {operatingOrganisationId:"org-b"},{provisioningGeneration:4},
  {policyDigest:hash("d")},{marketParticipationReference:"UG-MARKET-REF"}
 ])assert.notEqual(draftNativeProvisioningPlan({...desired,...changed}).planDigest,baseline);
});
test("Fencing structural preflight rejects stale generation, wrong market or expiry",()=>{
 const plan=draftNativeProvisioningPlan(desired),op=operation(plan);
 assert.equal(inspectFencedOperation(plan,op,null).status,"BLOCKED");
 assert.deepEqual(inspectFencedOperation(plan,op,clock),{
  status:"STRUCTURALLY_VALID_NOT_AUTHORISED",reason:"IAM_CP_CURRENT_VERIFICATION_UNWIRED",
  canExecute:false
 });
 for(const changed of [{tenantId:"tenant-b"},{legalEntityId:"legal-b"},
  {marketParticipationReference:"UG"},{provisioningGeneration:2},
  {planDigest:hash("f")},{leaseGeneration:0},{deadlineAt:"2026-10-28T08:59:00Z"},
  {cpAuthorizationEvidenceRef:""}]){
  assert.equal(inspectFencedOperation(plan,{...op,...changed},clock).status,"BLOCKED");
 }
});
test("No material provisioning/readback lifecycle action is exposed by the scaffold",async()=>{
 const port=createHeldNativeProvisioningPort();
 const plan=await port.plan(desired);
 assert.equal(plan.canExecute,false);
 for(const method of ["reconcile","readBack","suspend","deprovision"]){
  await assert.rejects(port[method]({source:"CP_VERIFIED",decision:"ALLOW",
    tenantId:"tenant-a",bindingId:"native-a",nativeAdminToken:"forged"}),NativeLifecycleHeld);
 }
});
