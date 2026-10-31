/**
 * DEV-08 / IAM-N07 — current legal actor readback from the REAL CP API.
 * Existing CP endpoint: POST /internal/legal-actor/v1/assess (LA-05A).
 * This is a legal-actor fact for a source-bound RUNTIME Context, NOT
 * booking permission, provider readiness, capability binding or transport.
 */
export class N07LegalActorDenied extends Error {
  constructor() {
    super("TMS_CURRENT_LEGAL_ACTOR_AUTHORITY_UNAVAILABLE");
    this.name="N07LegalActorDenied";
    this.code="TMS_N07_LEGAL_ACTOR_HELD";
  }
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const legal=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,159}$/;
const canonicalLegal=/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;
const token=v=>typeof v==="string"&&v.length>=16&&v.length<=8192&&
  !/[\x00-\x1f\x7f]/.test(v);
const exactly=(x,keys)=>x!==null&&typeof x==="object"&&!Array.isArray(x)&&
  Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
function trustedOrigin(value) {
  if(typeof value!=="string")throw new N07LegalActorDenied();
  const u=new URL(value);
  if(u.protocol!=="https:"||!u.hostname||u.username||u.password||
    (u.pathname!=="/"&&u.pathname!=="")||u.search||u.hash)
    throw new N07LegalActorDenied();
  return u.origin;
}
async function responseJSON(fetcher,endpoint,bearer,payload) {
  const resp=await fetcher(endpoint,{
    method:"POST",headers:{
      Authorization:"Bearer "+bearer,Accept:"application/json",
      "Content-Type":"application/json",
    },body:JSON.stringify(payload),cache:"no-store",redirect:"error",
    signal:AbortSignal.timeout(5000),
  });
  if(resp.status!==200||resp.redirected||!/^application\/json(?:\s*;|$)/i.test(
    resp.headers.get("content-type")??""))throw new N07LegalActorDenied();
  if(!resp.body)throw new N07LegalActorDenied();
  const reader=resp.body.getReader();
  const chunks=[];let size=0;
  try {
    for(;;){
      const part=await reader.read();
      if(part.done)break;
      size+=part.value.byteLength;
      if(size>16384)throw new N07LegalActorDenied();
      chunks.push(Buffer.from(part.value));
    }
  }finally{await reader.cancel().catch(()=>undefined);}
  const result=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(
    Buffer.concat(chunks,size)));
  if(!result||typeof result!=="object"||Array.isArray(result))
    throw new N07LegalActorDenied();
  return result;
}

/**
 * The reviewed context, market, business operation, legal entity and
 * OAuth access token come ONLY from a private owner provisioning profile
 * plus independent CP/issuer readbacks. They must NOT come from a browser
 * tenant header or a TMS native/vendor user. Owner's TLS roots are installed
 * separately: NODE_EXTRA_CA_CERTS; disabling TLS is always forbidden.
 *
 * fetcher override is for pure source unit tests, never acceptance.
 */
export function createN07TmsLegalActorReader({
  cpOrigin,expectedLegalEntityId,fetcher=fetch,now=()=>Date.now(),
}={}){
  try{
    if(process.env.NODE_TLS_REJECT_UNAUTHORIZED==="0"||
      !canonicalLegal.test(expectedLegalEntityId??"")||expectedLegalEntityId.length>63||typeof fetcher!=="function"||
      typeof now!=="function")throw new Error();
    const endpoint=trustedOrigin(cpOrigin)+"/internal/legal-actor/v1/assess";
    return Object.freeze({
      async assess({contextId,market,operationReference,accessToken}={}){
        try{
          if(!UUID.test(contextId??"")||!["UG","ZA"].includes(market)||
            !legal.test(operationReference??"")||
            !operationReference.startsWith("tms.booking.submit:")||
            !token(accessToken))throw new Error();
          const payload=Object.freeze({
            context_id:contextId,role:"SERVICE_PROVIDER_OF_RECORD",
            activity:"B2B_TRANSPORT_BOOKING",market,
            operation_reference:operationReference,
          });
          const row=await responseJSON(fetcher,endpoint,accessToken,payload);
          const resolution=row.legal_actor_resolution;
          const t=now();
          const evaluated=Date.parse(resolution?.evaluated_at??"");
          const until=Date.parse(resolution?.valid_until??"");
          if(!exactly(row,["context_id","operation_reference",
            "provider_permissions_granted","legal_actor_resolution"])||
            row.context_id!==contextId||
            row.operation_reference!==operationReference||
            row.provider_permissions_granted!==false||
            resolution?.outcome!=="AUTHORIZED"||
            !UUID.test(resolution.mandate_id??"")||
            resolution.responsible_legal_entity_id!==expectedLegalEntityId||
            typeof resolution.policy_reference!=="string"||
            !Array.isArray(resolution.evidence_references)||
            resolution.evidence_references.length===0||
            !Number.isFinite(t)||!Number.isFinite(evaluated)||
            !Number.isFinite(until)||evaluated>t||
            t-evaluated>5000||until<=t||
            !Number.isSafeInteger(t))throw new Error();
          return Object.freeze({
            source:"CP_LA05_CURRENT_AUTHORIZED_MANDATE_ONLY",
            role:"SERVICE_PROVIDER_OF_RECORD",
            operation:"tms.booking.submit",contextId,
            legalActorCurrent:true,
            validUntil:Math.min(until,t+5000),
            canExecute:false,
            providerAuthorized:false,
            // Deliberately no mandate ID or evidence references exported to
            // browser or native adapter; CP original remains authoritative.
          });
        }catch{throw new N07LegalActorDenied();}
      },
      async execute(){throw new N07LegalActorDenied();},
    });
  }catch{throw new N07LegalActorDenied();}
}
