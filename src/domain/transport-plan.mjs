/**
 * ADR-TMS-0003 / TMS-PLAN-01: pure canonical transport planning foundation.
 * Does not verify IAM/CP, approve/commit a plan, book capacity, dispatch a
 * movement, publish Shared events or invoke Fleetbase/Open TMS providers.
 * TMS-PLAN-02 persistence/CAS and TMS-PLAN-05 authority remain HELD.
 */
const modes=new Set(["ROAD","RAIL","SEA","AIR","INLAND_WATERWAY"]);
const scopeKeys=["tenantId","operatingOrganisationId","legalEntityId","marketId"];
const positive=/^(?:0*[1-9]\d*(?:\.\d+)?|0*\.\d*[1-9]\d*)$/;
const rfc3339=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const requireText=(x,name)=>{
 if(typeof x!=="string"||x.length===0||x.length>160||x.trim()!==x||
    /[\x00-\x1f\x7f]/.test(x))throw new TypeError(name+" must be explicit canonical text");
 return x;
};
const strictInteger=(x,name)=>{
 if(!Number.isSafeInteger(x)||x<1)throw new TypeError(name+" must be a positive integer");
 return x;
};
function freeze(x){
 if(Array.isArray(x))return Object.freeze(x.map(freeze));
 if(x!==null&&typeof x==="object")
  return Object.freeze(Object.fromEntries(Object.entries(x).map(([k,v])=>[k,freeze(v)])));
 return x;
}
function scope(context){
 if(context===null||typeof context!=="object"||Array.isArray(context))
  throw new TypeError("Explicit operating context required");
 return Object.fromEntries(scopeKeys.map(k=>[k,requireText(context[k],k)]));
}
function sameScope(a,b){
 if(scopeKeys.some(k=>a[k]!==b[k]))throw new Error("SCOPE_MISMATCH");
}
function references(items,id,name,{allowEmpty=false}={}){
 if(!Array.isArray(items)||(!allowEmpty&&items.length===0))
  throw new TypeError("Explicit "+name+" array required");
 const seen=new Set();
 return items.map(x=>{
  const v=requireText(x?.[id],id);
  if(seen.has(v))throw new Error("DUPLICATE_"+name.toUpperCase());
  seen.add(v);
  return v;
 });
}
function ordered(items,name){
 if(!Array.isArray(items))throw new TypeError(name+" array required");
 items.forEach((v,i)=>{
  if(strictInteger(v?.sequence,"sequence")!==i+1)
   throw new Error("NONCONTIGUOUS_"+name.toUpperCase()+"_ORDER");
 });
}
function moment(value,name){
 if(value===undefined||value===null)return null;
 if(typeof value!=="string"||!rfc3339.test(value)||!Number.isFinite(Date.parse(value)))
  throw new TypeError(name+" must be an RFC3339 instant with explicit offset");
 return {original:value,utc:new Date(value).toISOString()};
}
const utcMillis=v=>v?Date.parse(v.utc):null;
function estimate(value){
 if(value===null||value===undefined)return null; // never invent estimates.
 const result={
  value:requireText(value.value,"estimate.value"),
  unit:requireText(value.unit,"estimate.unit"),
  sourceReference:requireText(value.sourceReference,"estimate.sourceReference"),
  observedAt:moment(value.observedAt,"estimate.observedAt"),
  confidence:requireText(value.confidence,"estimate.confidence"),
  policyVersion:requireText(value.policyVersion,"estimate.policyVersion")
 };
 if(!positive.test(result.value)||!result.observedAt||
    !["LOW","MEDIUM","HIGH"].includes(result.confidence))
  throw new TypeError("INVALID_ESTIMATE_PROVENANCE");
 return result;
}
/** Routes are version-specific alternatives. A corridor reference is NOT legal approval. */
export function createRouteAlternative({
 routeId,planId,planRevision,waypoints,corridorReferences=[],alternativeEstimate=null
}={}){
 const nodes=references(waypoints,"waypointId","waypoint");
 if(nodes.length<2)throw new TypeError("Route needs two ordered waypoints");
 ordered(waypoints,"waypoint");
 const corridors=references(corridorReferences.map(x=>({reference:x})),
  "reference","corridor",{allowEmpty:true});
 return freeze({
  kind:"TransportRoute",routeId:requireText(routeId,"routeId"),
  planId:requireText(planId,"planId"),
  planRevision:strictInteger(planRevision,"planRevision"),
  waypoints:waypoints.map(x=>({
   waypointId:requireText(x.waypointId,"waypointId"),
   sequence:x.sequence,nodeReference:requireText(x.nodeReference,"nodeReference")
  })),
  corridorReferences:corridors,alternativeEstimate:estimate(alternativeEstimate),
  authority:"DRAFT_ALTERNATIVE_NOT_APPROVED"
 });
}
/** Plan identity and revisions are separate from TradeShipment and bookings. */
export function createTransportPlanDraft({
 planId,context,sources,editorReference,causationReference
}={}){
 references(sources,"sourceReference","requirement");
 return freeze({
  kind:"TransportPlan",planId:requireText(planId,"planId"),
  context:scope(context),
  revisions:[{
    revision:1,status:"DRAFT",previousVersion:null,
    sourceRequirements:sources.map(x=>({
      sourceType:requireText(x.sourceType,"sourceType"),
      sourceReference:requireText(x.sourceReference,"sourceReference")
    })),
    routes:[],editorReference:requireText(editorReference,"editorReference"),
    causationReference:requireText(causationReference,"causationReference"),
    reason:"INITIAL_DRAFT",requiresCommittedEffectReconciliation:false
  }],
  currentRevision:1,
  canCommit:false,canDispatch:false
 });
}
/** No actor authorisation is inferred from the supplied editor reference. */
export function reviseTransportPlanDraft(plan,{
 expectedRevision,reason,editorReference,causationReference,routes=[]
}={}){
 if(plan?.kind!=="TransportPlan"||!Array.isArray(plan.revisions)||
   plan.revisions.length!==plan.currentRevision)
  throw new TypeError("Valid TransportPlan history required");
 const previous=plan.revisions.at(-1);
 if(expectedRevision!==plan.currentRevision)
  throw new Error("STALE_PLAN_REVISION");
 if(previous.revision!==plan.currentRevision||previous.status!=="DRAFT")
  throw new Error("COMMITTED_OR_APPROVED_PLAN_REQUIRES_GOVERNED_REPLAN");
 if(!Array.isArray(routes))throw new TypeError("Route alternatives required");
 const ids=new Set();
 for(const route of routes){
  if(route?.kind!=="TransportRoute"||route.planId!==plan.planId||
     route.planRevision!==plan.currentRevision+1||ids.has(route.routeId))
   throw new Error("ROUTE_PLAN_REVISION_MISMATCH");
  ids.add(route.routeId);
 }
 return freeze({
  kind:"TransportPlan",planId:plan.planId,context:scope(plan.context),
  revisions:[...plan.revisions,{
   revision:plan.currentRevision+1,status:"DRAFT",previousVersion:plan.currentRevision,
   sourceRequirements:previous.sourceRequirements,routes,
   editorReference:requireText(editorReference,"editorReference"),
   causationReference:requireText(causationReference,"causationReference"),
   reason:requireText(reason,"reason"),requiresCommittedEffectReconciliation:false
  }],
  currentRevision:plan.currentRevision+1,
  canCommit:false,canDispatch:false
 });
}
function callsOf(items){
 if(!Array.isArray(items))throw new TypeError("Calls must be an array");
 references(items,"callId","call",{allowEmpty:true});
 ordered(items,"call");
 const calls=items.map(x=>{
  const arrival=moment(x.plannedArrival,"plannedArrival");
  const departure=moment(x.plannedDeparture,"plannedDeparture");
  if((arrival||departure)&&!x.timeZone)
   throw new Error("MISSING_ORIGINAL_TIME_ZONE");
  if(arrival&&departure&&utcMillis(departure)<utcMillis(arrival))
   throw new Error("REVERSED_CALL_CHRONOLOGY");
  return {
   callId:requireText(x.callId,"callId"),sequence:x.sequence,
   facilityReference:requireText(x.facilityReference,"facilityReference"),
   timeZone:x.timeZone?requireText(x.timeZone,"timeZone"):null,
   plannedArrival:arrival,plannedDeparture:departure
  };
 });
 for(let i=1;i<calls.length;i++){
  const prev=calls[i-1].plannedDeparture;
  const next=calls[i].plannedArrival;
  if(prev&&next&&utcMillis(next)<utcMillis(prev))
   throw new Error("REVERSED_MOVEMENT_CHRONOLOGY");
 }
 return calls;
}
function legsOf(items,calls,mode){
 if(!Array.isArray(items))throw new TypeError("Legs must be an array");
 references(items,"legId","leg",{allowEmpty:true});
 ordered(items,"leg");
 const c=new Map(calls.map(x=>[x.callId,x]));
 return items.map(x=>{
  const a=c.get(x.originCallId),b=c.get(x.destinationCallId);
  if(!a||!b||b.sequence<=a.sequence||b.sequence!==a.sequence+1)
   throw new Error("UNRELATED_OR_REVERSED_CALL_LEG");
  if(x.mode!==mode)throw new Error("MOVEMENT_LEG_MODE_MISMATCH");
  return {
   legId:requireText(x.legId,"legId"),sequence:x.sequence,
   originCallId:a.callId,destinationCallId:b.callId,mode
  };
 });
}
/** A repositioning movement may have no consignments and no transport plan. */
export function createTransportMovementDraft({
 movementId,context,mode,operatingOrganisationReference,calls=[],legs=[],
 repositioningOnly=false
}={}){
 if(!modes.has(mode))throw new Error("INVALID_MOVEMENT_MODE");
 if(typeof repositioningOnly!=="boolean")throw new TypeError("repositioningOnly must be boolean");
 const scoped=scope(context),c=callsOf(calls),l=legsOf(legs,c,mode);
 return freeze({
  kind:"TransportMovement",
  movementId:requireText(movementId,"movementId"),
  context:scoped,mode,
  operatingOrganisationReference:requireText(operatingOrganisationReference,"operatingOrganisationReference"),
  repositioningOnly,calls:c,legs:l,
  status:"DRAFT",canDispatch:false,carrierAcknowledged:false
 });
}
/** Consignment association, not booking/capacity or physical custody. */
export function associateMovementConsignment(movement,consignment,legIds){
 if(movement?.kind!=="TransportMovement"||consignment?.kind!=="Consignment")
  throw new TypeError("TransportMovement and canonical Consignment required");
 sameScope(movement.context,consignment.context);
 if(movement.repositioningOnly)throw new Error("REPOSITIONING_CANNOT_CARRY_CARGO");
 if(!Array.isArray(legIds)||legIds.length===0)throw new Error("SEGMENT_LEGS_REQUIRED");
 const allowed=new Set(movement.legs.map(x=>x.legId));
 if(new Set(legIds).size!==legIds.length||legIds.some(x=>!allowed.has(x)))
  throw new Error("INVALID_CONSIGNMENT_SEGMENT");
 return freeze({
  kind:"MovementConsignmentSegment",
  movementId:movement.movementId,consignmentId:consignment.consignmentId,
  context:scope(movement.context),legIds,
  status:"DRAFT_ALLOCATION_NO_CAPACITY_COMMITMENT"
 });
}
