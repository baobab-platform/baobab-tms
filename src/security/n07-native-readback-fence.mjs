/**
 * TMS native IAM/CP composition. Current Hydra->CP Context, separately current
 * CP LA-05A legal mandate and operation-specific HYB-04 source guard are all
 * mandatory BEFORE any private TMS provider admission can be considered.
 *
 * No source port can presently execute: Shared's TMS clients are PROVISIONED
 * and CP's TMS-native operation route is unmounted. This code must NEVER
 * substitute a synthetic success for those original dependencies.
 */
export class N07NativePreflightDenied extends Error {
  constructor(){
    super("TMS_NATIVE_EXECUTION_REQUIRES_INDEPENDENT_CP_AND_PROVIDER_PROOF");
    this.name="N07NativePreflightDenied";
    this.code="TMS_N07_NATIVE_EXECUTION_HELD";
  }
}
const exact=(v,fields)=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&
  Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));
const ownedToken=v=>typeof v==="string"&&v.length>=16&&v.length<=8192&&
  !/[\x00-\x1f\x7f]/.test(v);
const binding=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const allowed=new Set(["UG","ZA"]);

export function createN07NativeAuthorityPreflight({
  realIssuerCp,legalActorReader,nativeAuthority,now=()=>Date.now(),
}={}){
  if(typeof realIssuerCp?.observe!=="function"||
    typeof legalActorReader?.assess!=="function"||
    typeof nativeAuthority?.assess!=="function"||
    typeof nativeAuthority?.execute!=="function"||
    typeof now!=="function")throw new N07NativePreflightDenied();
  return Object.freeze({
    async assess({subjectToken,validatorToken,legalActorToken,contextId,
      expected,nativeRequest}={}){
      try{
        if(!ownedToken(subjectToken)||!ownedToken(validatorToken)||
          !ownedToken(legalActorToken)||new Set(
            [subjectToken,validatorToken,legalActorToken]).size!==3||
          !exact(nativeRequest,["token","request"])||
          nativeRequest.token!==subjectToken||
          !exact(expected,["tenantId","organisationId","marketId","countryCode","purpose"])||
          expected.purpose!=="RUNTIME"||!allowed.has(expected.countryCode)||
          nativeRequest.request?.contextId!==contextId||
          nativeRequest.request?.expectedScope?.tenantId!==expected.tenantId||
          nativeRequest.request?.expectedScope?.operatingOrganisationId!==expected.organisationId||
          nativeRequest.request?.expectedScope?.marketId!==expected.marketId||
          nativeRequest.request?.operation!=="tms.booking.submit"||
          !binding.test(nativeRequest.request?.bindingId??""))
          throw new Error();
        // Original subject issuer validity is observed BOTH sides of CP read.
        const observed=await realIssuerCp.observe({
          subjectToken,validatorToken,contextId,expected,
        });
        if(observed?.status!=="REAL_ISSUER_CP_HTTP_READBACK_UNATTESTED"||
          observed.currentIssuerObserved!==true||
          observed.currentCpContextObserved!==true||
          observed.canExecute!==false||observed.canActivate!==false)
          throw new Error();
        const opRef="tms.booking.submit:"+nativeRequest.request.bindingId;
        // A CP-audience legalActorToken from the SAME CP Principal, not a
        // human BFF token or resource audience. CP verifies owner of context.
        const before=await legalActorReader.assess({
          contextId,market:expected.countryCode,
          operationReference:opRef,accessToken:legalActorToken,
        });
        if(before?.source!=="CP_LA05_CURRENT_AUTHORIZED_MANDATE_ONLY"||
          before.role!=="SERVICE_PROVIDER_OF_RECORD"||
          before.operation!=="tms.booking.submit"||
          before.contextId!==contextId||before.legalActorCurrent!==true||
          before.canExecute!==false||before.providerAuthorized!==false||
          !(/^[0-9a-f]{64}$/.test(before.mandateDigest??""))||
          !Number.isSafeInteger(before.validUntil)||
          before.validUntil<=now())throw new Error();
        // The existing native HYB-04 port requires separately current IAM and
        // CP operation/binding/generation facts and always denies actual effect.
        const native=await nativeAuthority.assess(nativeRequest);
        if(native?.status!=="PROOF_ONLY_NOT_EXECUTABLE"||
          native.canExecute!==false||native.canActivate!==false)
          throw new Error();
        const after=await legalActorReader.assess({
          contextId,market:expected.countryCode,
          operationReference:opRef,accessToken:legalActorToken,
        });
        if(after?.source!==before.source||
          after.mandateDigest!==before.mandateDigest||
          after.contextId!==contextId||
          after.validUntil<=now()||before.validUntil<=now()||
          after.legalActorCurrent!==true||
          after.canExecute!==false||after.providerAuthorized!==false)
          throw new Error();
        // Recheck original subject token and CP context after the potentially
        // slow native/legal observations. Revocation mid-attempt must not
        // produce a stale "current" diagnostic.
        const finalIssuerCp=await realIssuerCp.observe({
          subjectToken,validatorToken,contextId,expected,
        });
        if(finalIssuerCp?.status!==observed.status||
          finalIssuerCp.currentIssuerObserved!==true||
          finalIssuerCp.currentCpContextObserved!==true||
          finalIssuerCp.canExecute!==false||finalIssuerCp.canActivate!==false)
          throw new Error();
        return Object.freeze({
          status:"REAL_ISSUER_CP_LEGAL_AND_NATIVE_PREFLIGHT_NON_EXECUTABLE",
          issuerCpObserved:true,legalMandateObserved:true,
          nativePreflightObserved:true,canExecute:false,canActivate:false,
          providerPermission:false,carrierProviderCertified:false,
          bookingAccepted:false,
        });
      }catch{throw new N07NativePreflightDenied();}
    },
    async execute(){throw new N07NativePreflightDenied();}
  });
}
