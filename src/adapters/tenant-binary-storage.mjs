/**
 * HYB-02 Baobab native provider-bound storage boundary.
 * Open TMS raw DB and S3 adapters accept arbitrary keys; all future
 * native provider calls must go through this boundary or remain BLOCKED.
 * CP is the source for authority, not a downstream caller-owned flag.
 */
import { randomUUID } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertId(value, label) {
  if (typeof value !== "string" || !UUID.test(value))
    throw new TypeError("Invalid " + label + "; require canonical UUID");
  return value.toLowerCase();
}
export function bindTenantBinaryStorage(raw, authority) {
  if (!raw || ["store", "retrieve", "delete", "exists"].some(method => typeof raw[method] !== "function"))
    throw new TypeError("Invalid native storage provider");
  if (authority?.source !== "CP" || authority?.status !== "CURRENT_AUTHORISED")
    throw new Error("No current authoritative Control Plane binding");
  const tenant = assertId(authority.tenantId, "tenant");
  const org = assertId(authority.organisationId, "organisation");
  const prefix = "t/" + tenant + "/o/" + org + "/binary/";
  const key = id => prefix + assertId(id, "opaque binary object id");
  return Object.freeze({
    async store(content, metadata) {
      if (!Buffer.isBuffer(content) || !content.length) throw new TypeError("Nonempty Buffer required");
      const id = randomUUID();
      await raw.store(key(id), content, metadata);
      return id;
    },
    retrieve: id => raw.retrieve(key(id)),
    exists: id => raw.exists(key(id)),
    delete: id => raw.delete(key(id)),
    async getSignedUrl(id, seconds = 300) {
      if (typeof raw.getSignedUrl !== "function") throw new Error("Signed URL unsupported");
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 900)
        throw new RangeError("Signed URL lifetime out of range");
      return raw.getSignedUrl(key(id), seconds);
    }
  });
}
