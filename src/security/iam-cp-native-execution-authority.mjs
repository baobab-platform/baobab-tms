/**
 * HYB-04: IAM -> CP authority evaluation SEAM for native TMS actions.
 * ADR-TMS-0010/0013/0021. No local JWT decoding, forged CP grants or
 * vendor-user fallback. The actual IAM and CP clients are NOT yet connected.
 *
 * A positive evaluation is a NON-EXECUTABLE assessment. This module cannot
 * provision, dispatch, book or activate a native provider.
 */
const nonempty=v=>typeof v==="string" && v.length>0 && v.length<=256;
const sha=v=>typeof v==="string"&&/^sha256:[a-f0-9]{64}$/.test(v);
const internalOps=new Set([
  "native.provision","native.dispatch","native.tracking.ingest",
  "native.reconcile","native.suspend","native.deprovision"
]);
export class NativeAuthorityDenied extends Error {
  constructor(reason="IAM_CP_EXECUTION_AUTHORITY_UNAVAILABLE") {
    super(reason);this.name="NativeAuthorityDenied";this.code="NATIVE_AUTHORITY_DENIED";
  }
}
function assert(value,reason) {
  if(!value)throw new NativeAuthorityDenied(reason);
}
const requestFields=["contextId","operation","bindingId","planDigest",
 "cpCapabilityBindingRevision","provisioningGeneration","expectedScope"];
const scopeFields=["tenantId","operatingOrganisationId","legalEntityId","marketId",
 "environment","nativeProviderKind"];
function plainShape(value,fields) {
  return value && typeof value==="object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value)===Object.prototype || Object.getPrototypeOf(value)===null) &&
    Object.keys(value).length===fields.length &&
    Object.keys(value).every(k=>fields.includes(k));
}
const positive=v=>Number.isSafeInteger(v)&&v>0;
const acceptedEnvironments=new Set(["development","test","staging","production"]);
const acceptedProviders=new Set(["FLEETBASE_FLEETOPS","OPEN_TMS"]);
function validateRequest(request) {
  assert(plainShape(request,requestFields),"INVALID_OPERATION_ENVELOPE");
  assert(plainShape(request.expectedScope,scopeFields),"INVALID_EXPECTED_SCOPE");
  assert(["contextId","bindingId","cpCapabilityBindingRevision"].every(k=>nonempty(request[k])) &&
   internalOps.has(request.operation)&&sha(request.planDigest)&&
   positive(request.provisioningGeneration),"INVALID_OPERATION_IDENTITY");
  assert(scopeFields.every(k=>nonempty(request.expectedScope[k]))&&
    acceptedEnvironments.has(request.expectedScope.environment)&&
    acceptedProviders.has(request.expectedScope.nativeProviderKind),
    "INVALID_EXPECTED_SCOPE");
}
/** The injecting clients must independently prove IAM and CP origin.
 * A caller-selected or vendor-sourced callback is NOT a credential verifier.
 * No token, bearer secret, provider URL or vendor admin key is returned.
 */
export function createHeldNativeExecutionAuthority({
 verifyIamToken,redeemCpContext,expectedAudience,acceptedIssuers,
 now=()=>Date.now()
}={}) {
  assert(typeof verifyIamToken==="function"&&
    typeof redeemCpContext==="function"&&
    nonempty(expectedAudience)&&
    Array.isArray(acceptedIssuers)&&acceptedIssuers.length>0&&
    acceptedIssuers.every(nonempty),"AUTHORITY_CLIENTS_NOT_CONFIGURED");
  const issuers=new Set(acceptedIssuers);
  return Object.freeze({
    async assess({token,request}) {
      validateRequest(request);
      assert(typeof token==="string"&&token.length>8&&token.length<16384,
        "MISSING_IAM_BEARER_TOKEN");
      // Do not parse token client-side or trust an 'IAM_VERIFIED' field
      // carried by the caller; call independently configured verifier.
      let iam;
      try {
        iam=await verifyIamToken(token,{
          audience:expectedAudience,
          operation:request.operation,
          contextId:request.contextId
        });
      }catch {
        throw new NativeAuthorityDenied("IAM_VERIFICATION_UNAVAILABLE");
      }
      const at=now();
      assert(iam?.source==="IAM_VERIFIED"&&iam.active===true&&
        iam.actorType==="workload"&&nonempty(iam.subject)&&
        nonempty(iam.issuer)&&issuers.has(iam.issuer)&&
        iam.audience===expectedAudience&&nonempty(iam.tokenId)&&
        Number.isFinite(iam.expiresAt)&&iam.expiresAt>at&&
        Number.isFinite(iam.notBefore)&&iam.notBefore<=at,
        "IAM_TOKEN_INVALID_OR_REVOKED");
      // Resolve CURRENT context with the verified, issuer/subject-bound
      // Principal. A context ID supplied by the client is only a handle.
      let cp;
      try {
        cp=await redeemCpContext({
          contextId:request.contextId,
          issuer:iam.issuer,subject:iam.subject,tokenId:iam.tokenId,
          operation:request.operation,bindingId:request.bindingId,
          capabilityBindingRevision:request.cpCapabilityBindingRevision,
          provisioningGeneration:request.provisioningGeneration
        });
      }catch{
        throw new NativeAuthorityDenied("CP_CURRENT_CONTEXT_UNAVAILABLE");
      }
      assert(cp?.source==="CP_READBACK"&&cp.decision==="ALLOW"&&
        nonempty(cp.decisionId)&&nonempty(cp.principalId)&&
        cp.contextId===request.contextId&&
        cp.issuer===iam.issuer&&cp.subject===iam.subject&&
        cp.tokenId===iam.tokenId&&
        cp.operation===request.operation&&
        cp.bindingId===request.bindingId&&
        cp.cpCapabilityBindingRevision===request.cpCapabilityBindingRevision&&
        cp.provisioningGeneration===request.provisioningGeneration&&
        cp.planDigest===request.planDigest&&
        scopeFields.every(k=>cp[k]===request.expectedScope[k])&&
        Number.isFinite(cp.verifiedUntil)&&cp.verifiedUntil>at&&
        cp.verifiedUntil<=at+5000&&cp.verifiedUntil<=iam.expiresAt,
        "CP_CONTEXT_MISMATCH_REVOKED_OR_STALE");
      // The approved legal actor, issuer and Principal must originate from
      // CP/IAM. Return only non-sensitive proof references.
      return Object.freeze({
        status:"PROOF_ONLY_NOT_EXECUTABLE",
        canExecute:false,canActivate:false,
        evidence:Object.freeze({
          decisionId:cp.decisionId,principalId:cp.principalId,
          tokenId:iam.tokenId,contextId:cp.contextId,
          bindingId:cp.bindingId,
          verifiedUntil:cp.verifiedUntil
        })
      });
    },
    async execute() {throw new NativeAuthorityDenied("NATIVE_EXECUTION_NOT_WIRED");}
  });
}
