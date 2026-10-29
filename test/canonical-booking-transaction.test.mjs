import test from "node:test";
import assert from "node:assert/strict";
import {CurrentAuthorityUnavailable,createHeldCanonicalBookingTransactionPort,
 previewCanonicalBookingTransaction,inspectProposedAuthorityFence}
 from "../src/repositories/canonical-booking-transaction.mjs";
const input={tenantId:"tn_synthetica",bookingId:"book-a",planId:"plan-a",
 planRevision:1,operatingOrganisationId:"org-a",legalEntityId:"legal-a",
 marketId:"market-za",nativeBindingReference:"bind-a",
 intentDigest:"sha256:"+"a".repeat(64),idempotencyKey:"idem-a"};
test("canonical first-party transaction identity is scoped, frozen and non-executable",()=>{
 const x=previewCanonicalBookingTransaction(input);
 assert.equal(x.canExecute,false);
 assert.equal(x.values.length,10);
 assert.equal(Object.isFrozen(x.values),true);
 assert(x.missingAuthority.includes("CURRENT_CP_LEGAL_ACTOR_MANDATE"));
});
test("reject source-forged authority, extra provider fields and stale input",()=>{
 for(const extra of [{nativeAdminKey:"spoof"},{cpSource:"VERIFIED"},
  {carrierOrganisationReference:"caller-specified"},{status:"ACTIVE"}])
  assert.throws(()=>previewCanonicalBookingTransaction({...input,...extra}),
   CurrentAuthorityUnavailable);
 for(const extra of [{planRevision:0},{tenantId:""},{intentDigest:"latest"}])
  assert.throws(()=>previewCanonicalBookingTransaction({...input,...extra}),
   CurrentAuthorityUnavailable);
});
test("candidate CP scope readback is never an executable lease",()=>{
 const now=new Date("2026-10-28T12:00:00Z");
 const a={tenant_id:input.tenantId,operating_organisation_id:input.operatingOrganisationId,
 legal_entity_id:input.legalEntityId,market_id:input.marketId,
 capability_binding_id:input.nativeBindingReference,intent_digest:input.intentDigest,
 fencing_generation:2,expires_at:"2026-10-28T12:00:05Z"};
 assert.equal(inspectProposedAuthorityFence(a,a,now).canExecute,false);
 for(const changed of [{tenant_id:"tn_other"},{legal_entity_id:"legal-b"},
  {market_id:"market-ug"},{fencing_generation:1},
  {expires_at:"2026-10-28T11:59:00Z"}])
  assert.equal(inspectProposedAuthorityFence({...a,...changed},a,now).status,"BLOCKED");
});
test("all future repository transactions fail before invoking SQL or external effects",async()=>{
 let writes=0;const p=createHeldCanonicalBookingTransactionPort({db:async()=>writes++});
 for(const method of ["createBookingIntent","advancePlanRevision","acquireBookingLease",
  "reserveCapacity","releaseCapacity","appendAttempt","commitOutbox"])
  await assert.rejects(p[method]({source:"CP_READBACK",decision:"ALLOW",
   tenantId:input.tenantId,fencingGeneration:100}),CurrentAuthorityUnavailable);
 assert.equal(writes,0);
});
