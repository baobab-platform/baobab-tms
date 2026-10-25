/**
 * HYB-02 first-party worker replay and unknown-outcome boundary.
 * Ledger MUST implement atomic durable claim/complete/unknown transitions
 * (e.g., PG17 canonical TMS DB), not a process-local Set or pg-boss alone.
 * Without independent current CP verification, DENY all operations.
 */
const digest=/^[a-f0-9]{64}$/;
const nonempty=x=>typeof x==="string"&&x.length>0;
export class NativeWorkerDenied extends Error {
  constructor(message="Native worker authority or replay custody unavailable") {
    super(message);this.name="NativeWorkerDenied";this.code="NATIVE_WORKER_DENIED";
  }
}
export const NATIVE_WORKER_ADMISSION = Object.freeze({
  "inbound-webhook":"CONNECTED_SYNTHETIC_PROOF_ONLY",
  "edi-retry":"CONNECTED_SYNTHETIC_PROOF_ONLY",
  "webhook-retry":"CONNECTED_SYNTHETIC_PROOF_ONLY",
  "document-generation":"UNQUALIFIED",
  "carrier-tracking-poll":"UNQUALIFIED",
  "carrier-user-anonymize":"UNQUALIFIED",
  "cutoff-monitor":"UNQUALIFIED",
  "eta-monitor":"UNQUALIFIED",
  "financial-cron":"UNQUALIFIED",
  "order-auto-archive":"UNQUALIFIED",
  "sla-monitor":"UNQUALIFIED",
  "wave-auto-release":"UNQUALIFIED"
});
export function createNativeWorkerFence({
  verifyCurrent,ledger,certifiedOperations=new Set(),now=()=>Date.now()
}={}) {
  if(typeof verifyCurrent!=="function"||!ledger||
     ["claim","complete","markUnknown"].some(k=>typeof ledger[k]!=="function"))
       throw new NativeWorkerDenied();
  const valid=e=>e && [e.tenantId,e.organisationId,e.bindingId,
    e.operationId,e.idempotencyKey].every(nonempty) &&
    digest.test(e.payloadDigest) && Number.isSafeInteger(e.cpFencingGeneration) &&
    e.cpFencingGeneration>0 && Object.hasOwn(NATIVE_WORKER_ADMISSION,e.workerKind);
  async function check(e) {
    const verdict=await verifyCurrent({
      tenantId:e.tenantId,organisationId:e.organisationId,
      bindingId:e.bindingId,operationId:e.operationId,
      workerKind:e.workerKind,cpFencingGeneration:e.cpFencingGeneration,
      payloadDigest:e.payloadDigest
    });
    if(!verdict||verdict.source!=="CP_VERIFIED"||
       verdict.decision!=="ALLOW"||
       verdict.tenantId!==e.tenantId||verdict.organisationId!==e.organisationId||
       verdict.bindingId!==e.bindingId||verdict.operationId!==e.operationId||
       verdict.workerKind!==e.workerKind||
       verdict.cpFencingGeneration!==e.cpFencingGeneration||
       !Number.isFinite(verdict.verifiedUntil)||
       verdict.verifiedUntil<=now()||verdict.verifiedUntil>now()+5000)
       throw new NativeWorkerDenied();
    return verdict;
  }
  return Object.freeze({
    async execute(e,handler) {
      if(!valid(e)||!certifiedOperations.has(e.workerKind)||
         typeof handler!=="function")throw new NativeWorkerDenied();
      const cp=await check(e); // independent of native job-supplied orgId
      const claim=await ledger.claim({
        ...e,cpDecisionReference:cp.decisionId,
        cpVerifiedUntil:cp.verifiedUntil
      });
      if(claim?.outcome==="COMPLETED") {
        if(claim.payloadDigest!==e.payloadDigest)
          throw new NativeWorkerDenied("Conflicting idempotency payload");
        return {status:"ALREADY_COMPLETED"};
      }
      if(claim?.outcome!=="CLAIMED"||
         !Number.isSafeInteger(claim.leaseGeneration)||claim.leaseGeneration<1)
          throw new NativeWorkerDenied("Unknown, conflicting or active worker execution");
      try {
        // A durable claim may block beyond the CP grant's short expiry.
        // Refresh authority AFTER claim, directly before the external effect.
        // A revoked or changed binding must never reach native execution.
        await check(e);
        const result=await handler(e);
        // Recheck after effect. A revoked/expired CP binding makes the result
        // UNKNOWN; never silently commit a native carrier/accounting outcome.
        await check(e);
        const completed=await ledger.complete(e,claim.leaseGeneration);
        if(completed!==true)throw new NativeWorkerDenied("Worker completion fence lost");
        return {status:"COMPLETED",result};
      } catch(err) {
        // If side effects might have occurred, never automatically retry.
        await ledger.markUnknown(e,claim.leaseGeneration);
        throw err;
      }
    }
  });
}
