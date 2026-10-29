import test from "node:test";
import assert from "node:assert/strict";
import {
 createBookingIntentDraft,observeProviderSubmission,fixtureCarrierHmac,
 reconcileFixtureCarrierReadback,planCapacityHoldDraft,
 createHeldCarrierExecutionPort,CarrierReconciliationDenied
} from "../src/domain/carrier-booking-reconciliation.mjs";
const base={
 tenantId:"tn_synthetica",operatingOrganisationId:"org-a",legalEntityId:"legal-a",
 marketId:"market-za",bookingId:"book-a",planId:"plan-a",planRevision:1,
 carrierOrganisationRef:"carrier-a",providerKind:"OPEN_TMS",bindingId:"binding-a",
 actorRef:"actor-a",idempotencyKey:"client-idem-a"
};
const now=new Date("2026-10-28T12:00:00Z");
const key="synthetic-carrier-hmac-key-not-production-value";
const body=(input=base,override={})=>({
 tenantId:input.tenantId,operatingOrganisationId:input.operatingOrganisationId,
 legalEntityId:input.legalEntityId,marketId:input.marketId,
 bookingId:input.bookingId,carrierOrganisationRef:input.carrierOrganisationRef,
 bindingId:input.bindingId,idempotencyKey:input.idempotencyKey,
 messageId:"message-1",readbackRef:"readback-a",providerBookingRef:"vendor-book-a",
 outcome:"CONFIRMED",occurredAt:"2026-10-28T11:59:00Z",...override
});
const readback=(booking,payload)=>reconcileFixtureCarrierReadback(booking,{
 body:payload,fixtureKey:key,signature:fixtureCarrierHmac(payload,key),now
});
test("native provider is not carrier identity; intent immutable and no executable grant",()=>{
 const a=createBookingIntentDraft(base);
 const b=createBookingIntentDraft({...base,providerKind:"FLEETBASE_FLEETOPS"});
 assert.equal(a.state,"REQUESTED");assert.equal(a.canCommit,false);
 assert.equal(a.canReserve,false);assert.equal(a.canDispatch,false);
 assert.notEqual(a.intentDigest,b.intentDigest);
 assert(Object.isFrozen(a.events));
 assert.throws(()=>{a.state="CONFIRMED"},TypeError);
});
test("202 is PENDING_PROVIDER and timeout/transport failure is PROVIDER_UNKNOWN",()=>{
 for(const kind of ["TIMEOUT","TRANSPORT_ERROR"]){
  const b=observeProviderSubmission(createBookingIntentDraft(base),{kind});
  assert.equal(b.state,"PROVIDER_UNKNOWN");
 }
 const two=observeProviderSubmission(createBookingIntentDraft(base),
  {kind:"HTTP_RESPONSE",providerStatus:202});
 assert.equal(two.state,"PENDING_PROVIDER");
 assert.equal(two.canCommit,false);
 assert.throws(()=>observeProviderSubmission(two,{kind:"HTTP_RESPONSE",providerStatus:202}),
  CarrierReconciliationDenied);
});
test("signed synthetic readback reconciles unknown and duplicate identity is replay safe",()=>{
 const unknown=observeProviderSubmission(createBookingIntentDraft(base),{kind:"TIMEOUT"});
 const evidence=body();
 const confirmed=readback(unknown,evidence);
 assert.equal(confirmed.state,"CONFIRMED");
 assert.equal(confirmed.externalReference,"vendor-book-a");
 assert.equal(confirmed.canDispatch,false);
 assert.equal(readback(confirmed,evidence),confirmed);
 const changed=body(base,{outcome:"DECLINED"});
 assert.throws(()=>readback(confirmed,changed),/DIGEST_CONFLICT/);
});
test("foreign Tenant, legal actor, carrier binding, signature and expiry fail closed",()=>{
 const pending=observeProviderSubmission(createBookingIntentDraft(base),{kind:"TIMEOUT"});
 for(const change of [
  {tenantId:"tn_other"},{legalEntityId:"legal-b"},{marketId:"market-ug"},
  {operatingOrganisationId:"org-other"},{carrierOrganisationRef:"carrier-other"},
  {bindingId:"binding-other"},{idempotencyKey:"other-key"},
  {occurredAt:"2026-10-28T11:00:00Z"}
 ])assert.throws(()=>readback(pending,body(base,change)),CarrierReconciliationDenied);
 assert.throws(()=>reconcileFixtureCarrierReadback(pending,{
  body:body(),signature:"b".repeat(64),fixtureKey:key,now}),CarrierReconciliationDenied);
});
test("terminal callback correction is quarantined, not resurrected",()=>{
 const pending=observeProviderSubmission(createBookingIntentDraft(base),
  {kind:"HTTP_RESPONSE",providerStatus:202});
 const declined=readback(pending,body(base,{outcome:"DECLINED"}));
 assert.equal(declined.state,"DECLINED");
 const newer=body(base,{messageId:"message-2",outcome:"CONFIRMED"});
 assert.throws(()=>readback(declined,newer),/LATE_TERMINAL/);
});
test("capacity candidates are decimal safe, never provider reservations",()=>{
 const b=createBookingIntentDraft(base);
 const a=planCapacityHoldDraft(b,{poolId:"pool-a",quantity:"1.50",
  unit:"pallets",mode:"ROAD",offerRef:"offer-a"});
 assert.equal(a.status,"DRAFT_NO_RESERVATION");
 assert.equal(a.canReserve,false);
 assert.throws(()=>planCapacityHoldDraft(b,{poolId:"pool-a",quantity:1.5,
  unit:"pallets",mode:"ROAD",offerRef:"offer-a"}),CarrierReconciliationDenied);
 assert.throws(()=>planCapacityHoldDraft(b,{poolId:"pool-a",quantity:"1",
  unit:"pallets",mode:"MULTIMODAL",offerRef:"offer-a"}),CarrierReconciliationDenied);
});
test("no fixture key or caller forged CP grant can execute provider side effects",async()=>{
 const p=createHeldCarrierExecutionPort();
 for(const method of ["submit","retry","reconcileNative","reserveCapacity",
 "releaseCapacity","cancel"])
  await assert.rejects(p[method]({source:"CP_READBACK",decision:"ALLOW",
   tenantId:base.tenantId,subject:"fake"}),CarrierReconciliationDenied);
});

test("plan revision has exactly one positive safe integer representation",()=>{
 for(const planRevision of ["1","-1","not-a-revision",0,-1,1.5,null,Number.MAX_SAFE_INTEGER+1])
  assert.throws(()=>createBookingIntentDraft({...base,planRevision}),/MISSING_CANONICAL_BOOKING_SCOPE/);
 assert.equal(createBookingIntentDraft({...base,planRevision:1}).planRevision,1);
});
