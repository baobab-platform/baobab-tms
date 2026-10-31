/**
 * N07 native preflight composition: actual issuer+CP HTTP proof is mandatory
 * BEFORE invoking the existing HYB-04 native operation-assessment seam.
 *
 * The published HYB-04 native port still has execute() hard-denied.
 * A valid subject context is NOT legal actor, native provider, plan revision
 * or booking acceptance. Nothing in this composition can alter that.
 */
export class N07NativePreflightDenied extends Error {
  constructor() {
    super("TMS_NATIVE_EXECUTION_REQUIRES_INDEPENDENT_CP_AND_PROVIDER_PROOF");
    this.name="N07NativePreflightDenied";
    this.code="TMS_N07_NATIVE_EXECUTION_HELD";
  }
}

const exactShape = (x,fields)=>x!==null&&typeof x==="object"&&!Array.isArray(x)&&
  Object.keys(x).length===fields.length&&fields.every(k=>Object.hasOwn(x,k));

export function createN07NativeAuthorityPreflight({
  realIssuerCp, nativeAuthority, now=()=>Date.now(),
}={}) {
  if (!realIssuerCp || typeof realIssuerCp.observe!=="function" ||
    typeof nativeAuthority?.assess!=="function" ||
    typeof nativeAuthority.execute!=="function" ||
    typeof now!=="function")
    throw new N07NativePreflightDenied();

  return Object.freeze({
    async assess({subjectToken,validatorToken,contextId,expected,nativeRequest}={}) {
      try {
        if (!exactShape(nativeRequest,["token","request"]) ||
          nativeRequest.token!==subjectToken ||
          !exactShape(expected,["tenantId","organisationId","marketId","purpose"]) ||
          expected.purpose!=="RUNTIME" ||
          nativeRequest.request?.contextId!==contextId ||
          nativeRequest.request?.expectedScope?.tenantId!==expected.tenantId ||
          nativeRequest.request?.expectedScope?.operatingOrganisationId!==expected.organisationId ||
          nativeRequest.request?.expectedScope?.marketId!==expected.marketId ||
          nativeRequest.request?.operation!=="tms.booking.submit")
          throw new Error();
        const observation = await realIssuerCp.observe({
          subjectToken,validatorToken,contextId,expected,
        });
        if (observation.status!=="REAL_ISSUER_CP_HTTP_READBACK_UNATTESTED" ||
          observation.currentIssuerObserved!==true ||
          observation.currentCpContextObserved!==true ||
          observation.canExecute!==false ||
          observation.canActivate!==false)
          throw new Error();
        // This second assessment is still the explicit HYB-04 non-executable
        // native port, which requires separate current IAM and operation CP.
        const native = await nativeAuthority.assess(nativeRequest);
        if (native?.status!=="PROOF_ONLY_NOT_EXECUTABLE" ||
          native.canExecute!==false || native.canActivate!==false)
          throw new Error();
        return Object.freeze({
          status:"REAL_CONTEXT_AND_NATIVE_PREFLIGHT_NON_EXECUTABLE",
          issuerCpObserved:true,
          nativePreflightObserved:true,
          canExecute:false,
          canActivate:false,
          legalActorCertified:false,
          carrierProviderCertified:false,
          bookingAccepted:false,
        });
      } catch {
        throw new N07NativePreflightDenied();
      }
    },
    async execute() {
      throw new N07NativePreflightDenied();
    },
  });
}
