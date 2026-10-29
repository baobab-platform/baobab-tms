/**
 * ADR-TMS-0004/0011/0013 — BOOK-04 deterministic, provider-neutral
 * reconciliation. No carrier network, native bookings, CP activation,
 * external capacity or release authority. This fixture reducer is explicitly
 * NOT a production provider verifier (each real carrier needs its own profile).
 */
import {createHash,createHmac,timingSafeEqual} from "node:crypto";
const raw=x=>typeof x==="string"&&x.length>0&&x.length<=256&&x.trim()===x&&
 !/[\x00-\x1f\x7f]/.test(x);
const required=(ok,code)=>{if(!ok)throw new CarrierReconciliationDenied(code)};
const hex=/^[0-9a-f]{64}$/;
const terminal=new Set(["CONFIRMED","DECLINED","EXPIRED","CANCELLED","FAILED_RECONCILIATION"]);
const immutableFields=["tenantId","operatingOrganisationId","legalEntityId","marketId",
  "bookingId","planId","planRevision","carrierOrganisationRef",
  "providerKind","bindingId","actorRef","idempotencyKey"];
function freeze(value){
 if(Array.isArray(value))return Object.freeze(value.map(freeze));
 if(value&&typeof value==="object")
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([k,v])=>[k,freeze(v)])));
 return value;
}
export class CarrierReconciliationDenied extends Error {
 constructor(reason="CARRIER_RECONCILIATION_HELD"){
  super(reason);this.name="CarrierReconciliationDenied";this.code=reason;
 }
}
export function createBookingIntentDraft(input){
 required(input&&typeof input==="object"&&!Array.isArray(input),"INVALID_BOOKING_INPUT");
 required(immutableFields.every(k=>k==="planRevision"
   ? Number.isSafeInteger(input[k])&&input[k]>0 : raw(input[k])),"MISSING_CANONICAL_BOOKING_SCOPE");
 required(["OPEN_TMS","FLEETBASE_FLEETOPS"].includes(input.providerKind),"UNKNOWN_PROVIDER");
 const scope=Object.fromEntries(immutableFields.map(k=>[k,input[k]]));
 const digest=createHash("sha256").update(JSON.stringify(scope)).digest("hex");
 return freeze({schema:"tms.booking.fixture.v1",...scope,
  intentDigest:"sha256:"+digest,state:"REQUESTED",
  externalReference:null,lastReadbackRef:null,
  events:[],canCommit:false,canDispatch:false,canReserve:false});
}
/**
 * HTTP 202 is not carrier acceptance. Timeouts are unknown: no automatic
 * second submission, cancellation or new provider idempotency key.
 */
export function observeProviderSubmission(booking,{kind,providerStatus}={}){
 required(booking?.schema==="tms.booking.fixture.v1"&&booking.state==="REQUESTED",
  "INVALID_BOOKING_SUBMISSION_STATE");
 required(["HTTP_RESPONSE","TIMEOUT","TRANSPORT_ERROR"].includes(kind),
  "UNKNOWN_SUBMISSION_OBSERVATION");
 const is202=kind==="HTTP_RESPONSE"&&providerStatus===202;
 const state=is202?"PENDING_PROVIDER":"PROVIDER_UNKNOWN";
 return freeze({...booking,state,
  events:[...booking.events,{kind:"SUBMISSION_OBSERVED",outcome:state}],
  canCommit:false,canDispatch:false,canReserve:false});
}
function digestOf(data){return createHash("sha256").update(data).digest("hex")}
export function fixtureCarrierHmac(body,key){
 required(raw(key)&&key.length>=32,"FIXTURE_KEY_REQUIRED");
 return createHmac("sha256",key).update(JSON.stringify(body)).digest("hex");
}
/** Synthetic signed fixture only. Production protocols need carrier-specific
 * source/endpoint binding, key custody and independently verified readback.
 */
export function reconcileFixtureCarrierReadback(booking,{
 body,signature,fixtureKey,now=new Date()
}={}){
 required(booking?.schema==="tms.booking.fixture.v1"&&
  ["PENDING_PROVIDER","PROVIDER_UNKNOWN","CONFIRMED","DECLINED"].includes(booking.state),
  "READBACK_NOT_PERMITTED");
 required(body&&typeof body==="object"&&!Array.isArray(body) &&
  now instanceof Date&&Number.isFinite(now.getTime()),"INVALID_READBACK");
 for(const k of ["tenantId","operatingOrganisationId","legalEntityId","marketId",
   "bookingId","carrierOrganisationRef","bindingId","idempotencyKey"]){
  required(body[k]===booking[k],"FOREIGN_OR_STALE_PROVIDER_BINDING");
 }
 required(raw(body.messageId)&&raw(body.readbackRef)&&raw(body.providerBookingRef),
  "MISSING_PROVIDER_READBACK_REFERENCE");
 required(body.outcome==="CONFIRMED"||body.outcome==="DECLINED","UNKNOWN_PROVIDER_OUTCOME");
 required(typeof body.occurredAt==="string"&&!Number.isNaN(Date.parse(body.occurredAt)),
  "INVALID_SOURCE_TIME");
 const epoch=Date.parse(body.occurredAt);
 required(Math.abs(now.getTime()-epoch)<=300_000,"STALE_PROVIDER_MESSAGE");
 required(typeof signature==="string"&&hex.test(signature),"PROVIDER_SIGNATURE_INVALID");
 const expected=fixtureCarrierHmac(body,fixtureKey);
 required(timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(signature,"hex")),
   "PROVIDER_SIGNATURE_INVALID");
 const messageDigest=digestOf(JSON.stringify(body));
 const prior=booking.events.find(x=>x.kind==="VERIFIED_FIXTURE_READBACK"&&x.messageId===body.messageId);
 if(prior){
  required(prior.messageDigest===messageDigest,"PROVIDER_EVENT_ID_DIGEST_CONFLICT");
  return booking; // stable idempotent replay, no double transition.
 }
 if(terminal.has(booking.state))
  throw new CarrierReconciliationDenied("LATE_TERMINAL_READBACK_QUARANTINED");
 required(!booking.externalReference||booking.externalReference===body.providerBookingRef,
  "PROVIDER_BOOKING_REF_CONFLICT");
 return freeze({
  ...booking,
  state:body.outcome,
  externalReference:body.providerBookingRef,
  lastReadbackRef:body.readbackRef,
  events:[...booking.events,{
   kind:"VERIFIED_FIXTURE_READBACK",messageId:body.messageId,
   messageDigest,sourceOccurredAt:body.occurredAt,
   receivedAt:now.toISOString(),outcome:body.outcome,
   readbackRef:body.readbackRef
  }],
  canCommit:false,canDispatch:false,canReserve:false
 });
}
/** A capacity candidate is never a reservation or financial procurement. */
export function planCapacityHoldDraft(booking,{poolId,quantity,unit,mode,offerRef}={}){
 required(booking?.schema==="tms.booking.fixture.v1"&&
  ["REQUESTED","PENDING_PROVIDER","PROVIDER_UNKNOWN","CONFIRMED"].includes(booking.state),
  "INVALID_BOOKING_FOR_CAPACITY_PLAN");
 required([poolId,unit,mode,offerRef].every(raw)&&
  ["ROAD","RAIL","SEA","AIR","INLAND_WATERWAY"].includes(mode)&&
  typeof quantity==="string"&&/^(?:0*[1-9]\d*(?:\.\d+)?|0*\.\d*[1-9]\d*)$/.test(quantity),
  "INVALID_CAPACITY_QUANTITY_OR_SCOPE");
 return freeze({schema:"tms.capacity.fixture.v1",
  tenantId:booking.tenantId,operatingOrganisationId:booking.operatingOrganisationId,
  legalEntityId:booking.legalEntityId,marketId:booking.marketId,
  bookingId:booking.bookingId,poolId,quantity,unit,mode,offerRef,
  status:"DRAFT_NO_RESERVATION",canReserve:false});
}
/**
 * Future transactional/native execution surface. No injected client, fake
 * issuer response, testing flag or synthetic credential can activate it.
 * Separate accepted Shared/CP/IAM operation authority is not yet installed.
 */
export function createHeldCarrierExecutionPort(){
 const denied=async()=>{throw new CarrierReconciliationDenied("CP_IAM_NATIVE_EXECUTION_NOT_ACCEPTED")};
 return Object.freeze({
  submit:denied,retry:denied,reconcileNative:denied,
  reserveCapacity:denied,releaseCapacity:denied,cancel:denied
 });
}
