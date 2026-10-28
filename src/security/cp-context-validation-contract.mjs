/**
 * HYB-04 contract-exact Shared control-plane/v1 PlatformContext validation.
 *
 * Not an IAM/CP verifier and NOT a native-operation authorizer. This seam
 * enforces the *actual* Shared snake_case request/response shape and can
 * produce only non-executable evidence pending registered TMS workload,
 * CP native-operation authority, legal actor and provider-specific fencing.
 *
 * The caller's subject_token is an OAuth bearer, NOT necessarily a JWT.
 * The independent validator MUST send its own CP-audience bearer separately.
 */
export class TmsContextContractDenied extends Error {
  constructor(code="CP_CONTEXT_CONTRACT_REJECTED") {
    super(code);
    this.name="TmsContextContractDenied";
    this.code="TMS_CONTEXT_CONTRACT_DENIED";
  }
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tenant=/^tn_[a-z0-9]{3,60}$/;
const digest=/^sha256:[a-f0-9]{64}$/;
const id=x=>typeof x==="string"&&x.length>=3&&x.length<=128&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(x);
const iso=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
const plain=x=>x!==null&&typeof x==="object"&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(v,required,allowed)=>{
  if(!plain(v)||Object.keys(v).some(k=>!allowed.includes(k))||
     required.some(k=>!Object.hasOwn(v,k))) throw new TmsContextContractDenied("INVALID_SHARED_SHAPE");
};
const requireValue=(x,reason)=>{
  if(!x)throw new TmsContextContractDenied(reason);
};

/**
 * Body for POST /v1/platform-context/validate.
 * The actual HTTP client must authenticate as its OWN IAM workload:
 *   Authorization: Bearer <validator-workload-token>
 * The body carries only the caller's original access token and context UUID.
 * No principal/subject/audience/tenant assertion may be injected.
 *
 * Do not log, trace, serialise to telemetry, queue or persist this body.
 */
export function buildCpContextValidationRequest({contextId,subjectToken}={}) {
  requireValue(uuid.test(contextId??""),"INVALID_CONTEXT_ID");
  requireValue(typeof subjectToken==="string"&&subjectToken.length>=16&&
    subjectToken.length<=8192&&!/[\x00-\x1f\x7f]/.test(subjectToken),
    "INVALID_SUBJECT_TOKEN");
  return Object.freeze({
    method:"POST",path:"/v1/platform-context/validate",
    body:Object.freeze({context_id:contextId,subject_token:subjectToken})
  });
}
const allowed=["context_id","tenant_id","resolved_at","expires_at",
  "market_id","organisation_id","authority_purpose","provisioning_authority"];
const basic=["context_id","tenant_id","resolved_at","expires_at","authority_purpose"];
const provisioningFields=["tenant_provisioning_id","plan_id","plan_version","plan_digest"];
const planPolicy=expected=>{
  requireValue(plain(expected)&&Object.keys(expected).length===4&&
    provisioningFields.every(k=>Object.hasOwn(expected,k))&&
    typeof expected.tenant_provisioning_id==="string"&&
    typeof expected.plan_id==="string"&&
    Number.isSafeInteger(expected.plan_version)&&expected.plan_version>=1&&
    digest.test(expected.plan_digest),"INVALID_EXPECTED_PROVISIONING_PLAN");
};
/**
 * A *schema-shaped* CP response is not proof it came from CP.
 * This method is a local postcondition only: authority remains blocked.
 */
export function inspectCpValidationReadback({
  contextId,reply,expected,now=new Date()
}={}) {
  requireValue(uuid.test(contextId??""),"INVALID_CONTEXT_ID");
  requireValue(now instanceof Date&&Number.isFinite(now.getTime()),"INVALID_CLOCK");
  exact(reply,basic,allowed);
  requireValue(reply.context_id===contextId&&tenant.test(reply.tenant_id)&&
    iso(reply.resolved_at)&&iso(reply.expires_at),"INVALID_CP_CONTEXT_ID_OR_TIME");
  const created=Date.parse(reply.resolved_at),ends=Date.parse(reply.expires_at);
  requireValue(created<=now.getTime()&&ends>now.getTime()&&ends>created,"CP_CONTEXT_EXPIRED_OR_UNBOUNDED");
  requireValue(reply.authority_purpose==="RUNTIME"||
    reply.authority_purpose==="TENANT_PROVISIONING","UNKNOWN_CP_AUTHORITY_PURPOSE");
  // TMS operations must have attested operating Organisation and Market.
  // These are optional in Shared v1; absence is a TMS-denial, not a fallback.
  requireValue(id(reply.organisation_id)&&id(reply.market_id),"UNATTESTED_ORGANISATION_OR_MARKET");
  if(reply.authority_purpose==="TENANT_PROVISIONING") {
    exact(reply.provisioning_authority,provisioningFields,provisioningFields);
    requireValue(Number.isSafeInteger(reply.provisioning_authority.plan_version)&&
      reply.provisioning_authority.plan_version>=1&&
      digest.test(reply.provisioning_authority.plan_digest)&&
      typeof reply.provisioning_authority.plan_id==="string"&&
      typeof reply.provisioning_authority.tenant_provisioning_id==="string"&&
      ends-created<=15*60*1000,"INVALID_CP_PROVISIONING_AUTHORITY");
  }else{
    requireValue(!Object.hasOwn(reply,"provisioning_authority"),
      "RUNTIME_MUST_NOT_HAVE_PROVISIONING_PLAN");
  }
  requireValue(plain(expected)&&Object.keys(expected).every(k=>
    ["tenantId","organisationId","marketId","purpose","provisioning"].includes(k)),
    "INVALID_EXPECTATION");
  requireValue(reply.tenant_id===expected.tenantId&&
    reply.organisation_id===expected.organisationId&&
    reply.market_id===expected.marketId&&
    reply.authority_purpose===expected.purpose,
    "CROSS_SCOPE_OR_WRONG_PURPOSE");
  if(reply.authority_purpose==="TENANT_PROVISIONING") {
    planPolicy(expected.provisioning);
    requireValue(provisioningFields.every(k=>
      reply.provisioning_authority[k]===expected.provisioning[k]),
      "STALE_OR_WRONG_CP_PROVISIONING_PLAN");
  } else {
    requireValue(!Object.hasOwn(expected,"provisioning"),
      "RUNTIME_NOT_PROVISIONING");
  }
  return Object.freeze({
    status:"CONTEXT_SHAPE_MATCH_ONLY",
    contract:"control-plane/v1/PlatformContextValidation",
    canExecute:false,
    canActivate:false,
    missingAuthority:Object.freeze([
      "NO_REGISTERED_TMS_CONTEXT_VALIDATOR",
      "NO_CP_TMS_NATIVE_OPERATION_GRANT",
      "NO_ATTESTED_LEGAL_ACTOR",
      "NO_CURRENT_NATIVE_FENCING_AND_PROVIDER_READBACK"
    ])
  });
}
