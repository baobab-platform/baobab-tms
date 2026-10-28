/**
 * HYB-04/TMS-API-02: canonical first-party transactional booking port.
 * Shared #409 is PROPOSED, not an accepted/current CP authority. No
 * arbitrary callbacks, vendor JWTs or client flags may enable effects.
 */
export class CurrentAuthorityUnavailable extends Error {
 constructor(reason="CP_NATIVE_EXECUTION_AUTHORITY_NOT_ACCEPTED"){
  super(reason);this.name="CurrentAuthorityUnavailable";
  this.code="TMS_CURRENT_AUTHORITY_HELD";
 }
}
const fields=["tenantId","bookingId","planId","planRevision",
 "operatingOrganisationId","legalEntityId","marketId",
 "nativeBindingReference","intentDigest","idempotencyKey"];
const safe=x=>typeof x==="string"&&x.length>0&&x.length<=256&&
 x.trim()===x&&!/[\x00-\x1f\x7f]/.test(x);
const digest=x=>typeof x==="string"&&/^sha256:[0-9a-f]{64}$/.test(x);
const plain=x=>x!==null&&typeof x==="object"&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
/** A candidate operation identity is not an executable SQL command. */
export function previewCanonicalBookingTransaction(input){
 if(!plain(input)||Object.keys(input).length!==fields.length||
  fields.some(k=>!Object.hasOwn(input,k)))
  throw new CurrentAuthorityUnavailable("INVALID_BOOKING_RECORD_SHAPE");
 if(fields.some(k=>k!=="planRevision"&&k!=="intentDigest"&&!safe(input[k]))||
    !Number.isSafeInteger(input.planRevision)||input.planRevision<1||
    !digest(input.intentDigest))
  throw new CurrentAuthorityUnavailable("INVALID_BOOKING_RECORD_VALUES");
 return Object.freeze({
  status:"SCOPED_TRANSACTION_INPUT_ONLY",
  canExecute:false,
  fieldOrder:Object.freeze([...fields]),
  values:Object.freeze(fields.map(k=>input[k])),
  missingAuthority:Object.freeze([
    "ACCEPTED_TMS_NATIVE_EXECUTION_CONTRACT","CURRENT_IAM_WORKLOAD",
    "CURRENT_CP_LEGAL_ACTOR_MANDATE","CURRENT_CAPABILITY_AND_BINDING",
    "LEASE_GENERATION_AND_REVOCATION","TRANSACTIONAL_OUTBOX"
  ])
 });
}
/** A forged validly-shaped CP response never carries current authority. */
export function inspectProposedAuthorityFence(proposed,expected,now=new Date()){
 const keys=["tenant_id","operating_organisation_id","legal_entity_id",
  "market_id","capability_binding_id","intent_digest",
  "fencing_generation","expires_at"];
 if(!plain(proposed)||!plain(expected)||!(now instanceof Date)||
    !Number.isFinite(now.getTime())||
    keys.some(k=>proposed[k]!==expected[k])||
    !Number.isSafeInteger(proposed.fencing_generation)||
    proposed.fencing_generation<1||
    !digest(proposed.intent_digest)||
    !Number.isFinite(Date.parse(proposed.expires_at))||
    Date.parse(proposed.expires_at)<=now.getTime()||
    Date.parse(proposed.expires_at)>now.getTime()+300000)
  return Object.freeze({status:"BLOCKED",canExecute:false});
 return Object.freeze({status:"SHAPE_ONLY_CONTRACT_PROPOSED",
  canExecute:false,reason:"NOT_AN_AUTHENTICATED_CP_OPERATION_LEASE"});
}
/** Methods deliberately refuse before touching the injected database. */
export function createHeldCanonicalBookingTransactionPort({db}={}){
 const deny=async()=>{throw new CurrentAuthorityUnavailable()};
 return Object.freeze({
  createBookingIntent:deny,advancePlanRevision:deny,acquireBookingLease:deny,
  reserveCapacity:deny,releaseCapacity:deny,appendAttempt:deny,
  commitOutbox:deny
 });
}
