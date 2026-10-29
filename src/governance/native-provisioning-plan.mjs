/**
 * HYB-03 first-party TMS NATIVE lifecycle DRAFT planner.
 * ADR-TMS-0020/0021. This is NOT a CP planner, authorisation proof or
 * executable provisioning endpoint. No host, database name, secret or
 * arbitrary vendor URL enters the plan. Actual CP lifecycle contracts/pins
 * and execution-point IAM verification remain to be integrated.
 */
import {createHash} from "node:crypto";

export class NativeLifecycleHeld extends Error {
  constructor(reason="NATIVE_LIFECYCLE_HELD") {
    super(reason);this.name="NativeLifecycleHeld";this.code="NATIVE_LIFECYCLE_HELD";
  }
}
const providers=Object.freeze({
  FLEETBASE_FLEETOPS:Object.freeze([
    "ATTEST_NATIVE_RELEASE_AND_LEGAL_ROUTE",
    "RESERVE_ISOLATED_MYSQL8_DATABASE_AND_ROLE",
    "ALLOCATE_TENANT_SCOPED_SECRET_REFS",
    "CONFIGURE_PRIVATE_PHP_API_AND_STORAGE",
    "APPLY_FLEETBASE_AND_FLEETOPS_MIGRATIONS",
    "CONFIGURE_ISOLATED_REDIS_QUEUE_AND_SCHEDULER",
    "CONFIGURE_AUTHENTICATED_SOCKETCLUSTER",
    "CREATE_NATIVE_ORGANISATION_MAPPING",
    "INDEPENDENT_NATIVE_READBACK_AND_NEGATIVE_ISOLATION"
  ]),
  OPEN_TMS:Object.freeze([
    "ATTEST_NATIVE_RELEASE_AND_LICENCE",
    "RESERVE_ISOLATED_POSTGRESQL17_DATABASE_AND_ROLE",
    "ALLOCATE_TENANT_SCOPED_SECRET_REFS",
    "APPLY_PRISMA_MIGRATIONS",
    "CONFIGURE_ISOLATED_PGBOSS_AND_WORKERS",
    "CONFIGURE_TENANT_SCOPED_BINARY_AND_EDI_EGRESS",
    "CREATE_NATIVE_ORGANISATION_MAPPING",
    "INDEPENDENT_NATIVE_READBACK_AND_NEGATIVE_ISOLATION"
  ])
});
const fields=Object.freeze([
  "tenantId","primaryOrganisationId","operatingOrganisationId",
  "legalEntityId","marketParticipationReference",
  "residenceAndIsolationProfileId","environment",
  "cpProviderId","cpEngineInstanceId","cpCapabilityBindingRevision",
  "nativeProviderKind","nativeProviderReleaseDigest","policyDigest",
  "desiredStateDigest","provisioningGeneration","isolationStrategy"
]);
const sha=/^sha256:[0-9a-f]{64}$/;
const label=x=>typeof x==="string"&&x.length>=1&&x.length<=160 &&
  /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(x);
const positive=x=>Number.isSafeInteger(x)&&x>0;
const environments=new Set(["development","test","staging","production"]);
const isolation=new Set(["DEDICATED_NATIVE_INSTANCE","DEDICATED_NATIVE_DATABASE"]);
const digest=x=>"sha256:"+createHash("sha256").update(JSON.stringify(x)).digest("hex");
export function draftNativeProvisioningPlan(input) {
  // Reject mass assignment, vendor-created Tenant and unsafe infrastructure
  // knobs (DB/role/host/port/image, raw credentials, global admin API tokens).
  if(!input||typeof input!=="object"||Array.isArray(input)||
    Object.keys(input).length!==fields.length||
    Object.keys(input).some(k=>!fields.includes(k)))
    throw new NativeLifecycleHeld("INVALID_CP_DESIRED_STATE_SHAPE");
  if(fields.filter(k=>!["provisioningGeneration","nativeProviderKind",
    "nativeProviderReleaseDigest","policyDigest","desiredStateDigest",
    "environment","isolationStrategy"].includes(k))
    .some(k=>!label(input[k]))||
    !Object.hasOwn(providers,input.nativeProviderKind)||
    !environments.has(input.environment)||
    !isolation.has(input.isolationStrategy)||
    !sha.test(input.nativeProviderReleaseDigest)||
    !sha.test(input.desiredStateDigest)||
    !sha.test(input.policyDigest)||
    !positive(input.provisioningGeneration))
    throw new NativeLifecycleHeld("INVALID_CP_DESIRED_STATE_VALUES");
  const scope=Object.fromEntries(fields.map(k=>[k,input[k]]));
  const steps=providers[input.nativeProviderKind].map((kind,index)=>Object.freeze({
    ordinal:index+1,kind,execution:"HELD",independentEvidenceRequired:true
  }));
  const planDigest=digest({schema:"tms.native.plan.draft.v1",scope,
    steps:steps.map(x=>x.kind)});
  return Object.freeze({
    schema:"tms.native.plan.draft.v1",
    status:"DRAFT_ONLY_NOT_CP_APPROVED",
    planDigest,
    scope:Object.freeze(scope),
    steps:Object.freeze(steps),
    canExecute:false,
    canActivate:false,
    providerCapabilityRegistration:"NOT_AUTHORISED"
  });
}
/**
 * Validates *structure* and scope correlation only, NOT a CP or IAM grant.
 * A successful preflight MUST NOT be used to initiate an external side effect.
 */
export function inspectFencedOperation(plan, operation, at=new Date()) {
  if(!plan||plan.status!=="DRAFT_ONLY_NOT_CP_APPROVED"||
     !plan.scope||!sha.test(plan.planDigest)||
     !operation||typeof operation!=="object"||Array.isArray(operation)||
     !(at instanceof Date)||!Number.isFinite(at.getTime()))return Object.freeze({status:"BLOCKED",reason:"INVALID_PLAN_OR_OPERATION"});
  const scope=plan.scope;
  const matches=["tenantId","operatingOrganisationId","legalEntityId",
    "marketParticipationReference","environment","nativeProviderKind",
    "cpCapabilityBindingRevision","provisioningGeneration"];
  if(matches.some(k=>operation[k]!==scope[k])||
     operation.planDigest!==plan.planDigest||
     !label(operation.cpOperationId)||!label(operation.idempotencyKey)||
     !label(operation.cpAuthorizationEvidenceRef)||
     !positive(operation.leaseGeneration)||
     typeof operation.deadlineAt!=="string"||
     !Number.isFinite(Date.parse(operation.deadlineAt))||
     Date.parse(operation.deadlineAt)<=at.getTime()||
     Date.parse(operation.deadlineAt)>at.getTime()+5000)
    return Object.freeze({status:"BLOCKED",reason:"STALE_OR_MISMATCHED_CP_FENCE"});
  return Object.freeze({
    status:"STRUCTURALLY_VALID_NOT_AUTHORISED",
    reason:"IAM_CP_CURRENT_VERIFICATION_UNWIRED",
    canExecute:false
  });
}
/**
 * Deliberate no-op implementation of illustrative ADR-TMS-0021 §6 port.
 * Only PLAN is supported and returns a non-executable draft.
 * Material operations are never enabled from caller fields, local env
 * toggles, native JWTs or passing synthetic CI.
 */
export function createHeldNativeProvisioningPort() {
  const block=async()=>{throw new NativeLifecycleHeld();};
  return Object.freeze({
    plan:async desired=>draftNativeProvisioningPlan(desired),
    reconcile:block,readBack:block,suspend:block,deprovision:block
  });
}
