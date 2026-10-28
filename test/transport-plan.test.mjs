import test from "node:test";
import assert from "node:assert/strict";
import {createConsignmentDraft} from "../src/domain/shipment.mjs";
import {
 createTransportPlanDraft,createRouteAlternative,reviseTransportPlanDraft,
 createTransportMovementDraft,associateMovementConsignment
} from "../src/domain/transport-plan.mjs";

const scope={tenantId:"tenant-a",operatingOrganisationId:"org-a",
 legalEntityId:"legal-a",marketId:"market-za"};
const requirement=[{sourceType:"LogisticsShipment",sourceReference:"shipment-a"}];
const plan=()=>createTransportPlanDraft({
 planId:"plan-a",context:scope,sources:requirement,
 editorReference:"synthetic-planner",causationReference:"synthetic-demand"
});
const route=(revision=2)=>createRouteAlternative({
 routeId:"route-a",planId:"plan-a",planRevision:revision,
 waypoints:[
  {waypointId:"waypoint-1",sequence:1,nodeReference:"Cape-Town-Port"},
  {waypointId:"waypoint-2",sequence:2,nodeReference:"Durban-Port"}
 ],
 corridorReferences:["ZA-coastal-reference"]
});
const calls=[
 {callId:"call-a",sequence:1,facilityReference:"Cape-Town-Port",
  timeZone:"Africa/Johannesburg",plannedDeparture:"2026-11-02T11:00:00+02:00"},
 {callId:"call-b",sequence:2,facilityReference:"Durban-Port",
  timeZone:"Africa/Johannesburg",plannedArrival:"2026-11-03T13:00:00+02:00"}
];
const legs=[{legId:"leg-a",sequence:1,originCallId:"call-a",
 destinationCallId:"call-b",mode:"ROAD"}];
const movement=(context=scope,extra={})=>createTransportMovementDraft({
 movementId:"movement-a",context,mode:"ROAD",
 operatingOrganisationReference:"org-a",calls,legs,...extra
});
const consignment=(context=scope)=>createConsignmentDraft({
 consignmentId:"consignment-a",context,
 consignorReference:"supplier-a",consigneeReference:"customer-a"
});
test("a plan is a frozen draft, not a booking, carrier acceptance or legal grant",()=>{
 const p=plan();
 assert.equal(p.kind,"TransportPlan");
 assert.equal(p.currentRevision,1);
 assert.equal(p.revisions[0].status,"DRAFT");
 assert.equal(p.canCommit,false);
 assert.equal(p.canDispatch,false);
 assert(Object.isFrozen(p.revisions[0].sourceRequirements));
 assert.throws(()=>{p.revisions[0].status="COMMITTED"},TypeError);
 assert.equal("providerId" in p,false);
});
test("route alternatives carry exact version, ordered nodes and non-legal corridor references",()=>{
 const r=route();
 assert.equal(r.planRevision,2);
 assert.deepEqual(r.waypoints.map(x=>x.sequence),[1,2]);
 assert.equal(r.authority,"DRAFT_ALTERNATIVE_NOT_APPROVED");
 assert.equal(r.alternativeEstimate,null);
 assert(Object.isFrozen(r.waypoints[0]));
 assert.throws(()=>createRouteAlternative({
  routeId:"r1",planId:"plan-a",planRevision:2,
  waypoints:[{waypointId:"a",sequence:2,nodeReference:"A"},
   {waypointId:"b",sequence:1,nodeReference:"B"}]
 }),/NONCONTIGUOUS/);
 assert.throws(()=>createRouteAlternative({
  routeId:"r1",planId:"plan-a",planRevision:2,
  waypoints:[{waypointId:"a",sequence:1,nodeReference:"A"},
   {waypointId:"a",sequence:2,nodeReference:"B"}]
 }),/DUPLICATE/);
});
test("revisions are deterministic, linked, immutable and CAS-style stale-checked",()=>{
 const p=plan();
 const action={expectedRevision:1,reason:"weather-disruption",
  editorReference:"planner-a",causationReference:"weather-observation-a",routes:[route()]};
 const second=reviseTransportPlanDraft(p,action);
 assert.equal(second.currentRevision,2);
 assert.equal(second.revisions[1].previousVersion,1);
 assert.equal(second.revisions[1].routes[0].planRevision,2);
 assert.deepEqual(second.revisions[0],p.revisions[0]);
 assert.deepEqual(second,reviseTransportPlanDraft(p,action));
 assert.equal(p.currentRevision,1);
 assert(Object.isFrozen(second.revisions[1].routes[0].waypoints));
 assert.throws(()=>reviseTransportPlanDraft(second,action),/STALE_PLAN_REVISION/);
 assert.throws(()=>reviseTransportPlanDraft(p,{...action,routes:[route(3)]}),/ROUTE_PLAN_REVISION_MISMATCH/);
 const committed={...p,revisions:[{...p.revisions[0],status:"COMMITTED"}]};
 assert.throws(()=>reviseTransportPlanDraft(committed,action),/GOVERNED_REPLAN/);
});
test("estimates require original source, measurement, time and confidence",()=>{
 const r=createRouteAlternative({
  routeId:"route-est",planId:"plan-a",planRevision:2,
  waypoints:[{waypointId:"w1",sequence:1,nodeReference:"A"},
    {waypointId:"w2",sequence:2,nodeReference:"B"}],
  alternativeEstimate:{value:"112.50",unit:"km",sourceReference:"route-metric-a",
   observedAt:"2026-11-01T12:00:00+02:00",confidence:"LOW",policyVersion:"v1"}
 });
 assert.equal(r.alternativeEstimate.observedAt.utc,"2026-11-01T10:00:00.000Z");
 assert.throws(()=>createRouteAlternative({
  routeId:"bad",planId:"plan-a",planRevision:2,
  waypoints:r.waypoints,
  alternativeEstimate:{...r.alternativeEstimate,value:112.5}
 }),/explicit canonical text/);
});
test("scheduled movements are independent of route/plan and preserve timezone",()=>{
 const m=movement();
 assert.equal(m.kind,"TransportMovement");
 assert.equal(m.status,"DRAFT");
 assert.equal(m.canDispatch,false);
 assert.equal(m.carrierAcknowledged,false);
 assert.equal(m.calls[0].plannedDeparture.utc,"2026-11-02T09:00:00.000Z");
 assert.equal(m.calls[0].plannedDeparture.original,"2026-11-02T11:00:00+02:00");
 assert.equal(m.legs[0].originCallId,"call-a");
 assert.equal(m.legs[0].destinationCallId,"call-b");
 assert(Object.isFrozen(m.calls[0].plannedDeparture));
 assert.equal(Object.hasOwn(m,"planId"),false);
});
test("multimodal means separate mode-specific movements, never a vehicle mode",()=>{
 const road=movement();
 const sea=createTransportMovementDraft({
  movementId:"movement-sea",context:scope,mode:"SEA",
  operatingOrganisationReference:"carrier-sea"
 });
 assert.equal(road.mode,"ROAD");
 assert.equal(sea.mode,"SEA");
 assert.equal(sea.calls.length,0);
 assert.throws(()=>movement(scope,{mode:"MULTIMODAL"}),/INVALID_MOVEMENT_MODE/);
});
test("unknown calls, duplicate calls, invalid legs and reversed chronology fail",()=>{
 assert.throws(()=>movement(scope,{legs:[{...legs[0],destinationCallId:"not-a-call"}]}),/UNRELATED/);
 assert.throws(()=>movement(scope,{legs:[{...legs[0],mode:"SEA"}]}),/MODE_MISMATCH/);
 assert.throws(()=>movement(scope,{calls:[calls[0],{...calls[1],sequence:3}]}),/NONCONTIGUOUS/);
 assert.throws(()=>movement(scope,{calls:[calls[0],{...calls[1],callId:"call-a"}]}),/DUPLICATE/);
 assert.throws(()=>movement(scope,{calls:[{
  ...calls[0],plannedArrival:"2026-11-02T12:00:00+02:00"
 },calls[1]]}),/REVERSED_CALL_CHRONOLOGY/);
 assert.throws(()=>movement(scope,{calls:[calls[0],{
  ...calls[1],plannedArrival:"2026-11-01T09:00:00+02:00"
 }]}),/REVERSED_MOVEMENT_CHRONOLOGY/);
 assert.throws(()=>movement(scope,{calls:[{
  ...calls[0],plannedDeparture:"2026-11-02T11:00:00"
 },calls[1]]}),/RFC3339/);
});
test("consignment-to-movement association is scoped, segment-specific and not capacity",()=>{
 const m=movement(),a=associateMovementConsignment(m,consignment(),["leg-a"]);
 assert.equal(a.kind,"MovementConsignmentSegment");
 assert.deepEqual(a.legIds,["leg-a"]);
 assert.equal(a.status,"DRAFT_ALLOCATION_NO_CAPACITY_COMMITMENT");
 assert(Object.isFrozen(a.legIds));
 for(const changed of [{tenantId:"tenant-b"},{legalEntityId:"legal-b"},
  {operatingOrganisationId:"org-b"},{marketId:"market-ug"}])
  assert.throws(()=>associateMovementConsignment(m,consignment({...scope,...changed}),["leg-a"]),/SCOPE_MISMATCH/);
 assert.throws(()=>associateMovementConsignment(m,consignment(),["unknown"]),/INVALID_CONSIGNMENT_SEGMENT/);
 assert.throws(()=>associateMovementConsignment(movement(scope,{repositioningOnly:true}),consignment(),["leg-a"]),/REPOSITIONING/);
});
test("no implicit tenant, source requirement or source reference may be supplied",()=>{
 assert.throws(()=>createTransportPlanDraft({planId:"one",context:{...scope,tenantId:""},
   sources:requirement,editorReference:"actor",causationReference:"demand"}),/tenantId/);
 assert.throws(()=>createTransportPlanDraft({planId:"one",context:scope,sources:[],
   editorReference:"actor",causationReference:"demand"}),/requirement/);
 assert.throws(()=>createTransportPlanDraft({planId:"one",context:scope,sources:[...requirement,...requirement],
   editorReference:"actor",causationReference:"demand"}),/DUPLICATE/);
});
