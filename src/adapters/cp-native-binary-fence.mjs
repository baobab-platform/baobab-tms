/**
 * Runtime storage fence for adoption of native Open TMS binary adapters.
 *
 * The vendor's DatabaseBinaryStorage and S3FileStorage accept raw physical
 * keys. Never export the underlying object from this composition root.
 * Native HTTP and worker entry points MUST use runInScope() after resolving
 * the current canonical CP execution context. No scope => no I/O.
 *
 * verifyCurrent is a trusted CP client port, not a caller-supplied claim.
 * Until its production implementation is wired and independently attested,
 * this fence DENIES ALL native storage access.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const logical = /^files\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const ops = new Set(["binary.store","binary.retrieve","binary.delete","binary.exists","binary.presign"]);
const normal = (v) => typeof v === "string" && uuid.test(v) ? v.toLowerCase() : null;
export class NativeStorageDenied extends Error {
  constructor(reason="CP-authorised native storage operation unavailable") {
    super(reason); this.name = "NativeStorageDenied"; this.code = "NATIVE_STORAGE_DENIED";
  }
}

export function createCpNativeBinaryFence({raw, verifyCurrent, now=()=>Date.now()}) {
  if (!raw || typeof verifyCurrent !== "function" ||
      ["store","retrieve","delete","exists"].some(k=>typeof raw[k]!=="function")) {
    throw new NativeStorageDenied("Native storage unavailable without CP verifier");
  }
  const context = new AsyncLocalStorage();
  const parse = key => {
    const match = typeof key === "string" && key.match(logical);
    if (!match) throw new NativeStorageDenied("Only opaque logical files/UUID keys are permitted");
    return match[1].toLowerCase();
  };
  // Request and worker envelopes remain untrusted until the CP verifier
  // independently validates the issuer, Principal, current binding and grant.
  async function assertCurrent(op, key) {
    if (!ops.has(op)) throw new NativeStorageDenied();
    const s = context.getStore();
    if (!s || !normal(s.tenantId) || !normal(s.organisationId) ||
        !normal(s.bindingId) || !normal(s.operationId)) throw new NativeStorageDenied();
    const result = await verifyCurrent({
      tenantId:s.tenantId, organisationId:s.organisationId,
      bindingId:s.bindingId, operationId:s.operationId,
      operation:op, objectKey:key
    });
    if (!result || result.source!=="CP_VERIFIED" || result.decision!=="ALLOW" ||
        normal(result.tenantId)!==s.tenantId ||
        normal(result.organisationId)!==s.organisationId ||
        normal(result.bindingId)!==s.bindingId ||
        normal(result.operationId)!==s.operationId ||
        !Number.isFinite(result.verifiedUntil) ||
        result.verifiedUntil <= now() ||
        result.verifiedUntil > now()+30_000) {
      throw new NativeStorageDenied();
    }
    return "t/"+s.tenantId+"/o/"+s.organisationId+"/binary/"+key;
  }
  async function invoke(op,key,action) {
    const objectId = parse(key);
    const physical = await assertCurrent(op,objectId);
    return action(physical);
  }
  return Object.freeze({
    // Bound callback MUST be executed by a TMS execution-point gate and
    // cannot come from Open TMS native JWT or queued orgId alone.
    runInScope: async (claim, action) => {
      if(typeof action!=="function" || !claim ||
         !normal(claim.tenantId) || !normal(claim.organisationId) ||
         !normal(claim.bindingId) || !normal(claim.operationId))
        throw new NativeStorageDenied();
      return context.run(Object.freeze({
        tenantId:normal(claim.tenantId),organisationId:normal(claim.organisationId),
        bindingId:normal(claim.bindingId),operationId:normal(claim.operationId)
      }),action);
    },
    provider:Object.freeze({
      async store(key,content,metadata) {
        if (!Buffer.isBuffer(content) || !content.length) throw new NativeStorageDenied("Nonempty Buffer required");
        return invoke("binary.store",key,async physical => {
          await raw.store(physical,content,metadata); return key;
        });
      },
      retrieve:key=>invoke("binary.retrieve",key,physical=>raw.retrieve(physical)),
      exists:key=>invoke("binary.exists",key,physical=>raw.exists(physical)),
      delete:key=>invoke("binary.delete",key,physical=>raw.delete(physical)),
      async getSignedUrl(key,seconds=300) {
        if (typeof raw.getSignedUrl!=="function" ||
            !Number.isInteger(seconds) || seconds<1 || seconds>300)
          throw new NativeStorageDenied("Native signed URL disabled or out of policy");
        return invoke("binary.presign",key,physical=>raw.getSignedUrl(physical,seconds));
      }
    }),
    logicalKey:()=> "files/"+randomUUID()
  });
}
