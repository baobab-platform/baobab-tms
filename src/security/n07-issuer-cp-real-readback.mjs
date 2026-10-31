/**
 * TMS IAM-N07: real Hydra issuer and Control Plane HTTP readback.
 *
 * This uses the actual Shared control-plane/v1 PlatformContextValidation wire
 * shape, NOT the illustrative HYB-04 callback model. Real response provenance
 * is TLS + bounded independent issuer / CP requests; original observation
 * is still NOT a legal mandate, executable native booking or provider permit.
 *
 * One TMS validator bearer authenticates to CP with context:validate; the
 * distinct original subject bearer is sent only to issuer introspection and
 * CP's subject_token field. No JWT-local decoding or vendor identity fallback.
 */
import {
  buildCpContextValidationRequest, inspectCpValidationReadback,
} from "./cp-context-validation-contract.mjs";

const allowedAudience = /^[a-z][a-z0-9-]{2,63}$/;
const tokenString = v => typeof v === "string" && v.length >= 16 &&
  v.length <= 8192 && !/[\x00-\x1f\x7f]/.test(v);
const url = (source, rootOnly=false) => {
  if (typeof source !== "string") throw new Error();
  const u = new URL(source);
  if (u.protocol !== "https:" || !u.hostname || u.username || u.password ||
    u.search || u.hash || (rootOnly && u.pathname !== "/")) throw new Error();
  return u;
};
const exact = (v, fields) => v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).length === fields.length && fields.every(k => Object.hasOwn(v,k));

export class N07TmsReadbackDenied extends Error {
  constructor() {
    super("TMS_CURRENT_ISSUER_CP_READBACK_UNAVAILABLE");
    this.name = "N07TmsReadbackDenied";
    this.code = "TMS_N07_AUTHORITY_HELD";
  }
}

async function jsonOriginal(fetcher, target, init) {
  const response = await fetcher(target, {
    ...init, cache: "no-store", redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (!response || response.status !== 200 ||
    !/^application\/json(?:;|$)/i.test(response.headers.get("content-type") ?? "") ||
    response.redirected) throw new N07TmsReadbackDenied();
  const raw = await response.arrayBuffer();
  if (raw.byteLength > 16384) throw new N07TmsReadbackDenied();
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  const value = JSON.parse(decoded);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new N07TmsReadbackDenied();
  return value;
}

/** Must be constructed with OWNER-PRIVATE config; caller cannot select
 * issuer/CP/validator clients from HTTP headers, query or shipment payload.
 * Transport injection is allowed only for isolated unit tests and results
 * always remain explicitly UNATTESTED, never executable.
 */
export function createN07TmsIssuerCpReadback({
  issuer, introspectionUrl, cpOrigin, audience, issuerClientId,
  issuerClientSecret, trustedValidatorClientId, fetcher=fetch,
  now=()=>Date.now(),
}={}) {
  try {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" ||
      !allowedAudience.test(audience) ||
      ![issuerClientId, issuerClientSecret, trustedValidatorClientId].every(
        v => typeof v === "string" && v.length >= 4 && v.length <= 4096) ||
      issuerClientSecret.length < 16 ||
      typeof fetcher !== "function" || typeof now !== "function")
      throw new Error();
    const publicIssuer = url(issuer), inspection = url(introspectionUrl);
    const cp = url(cpOrigin,true);
    if (inspection.origin === cp.origin || publicIssuer.origin === cp.origin ||
      inspection.pathname === "/" ||
      publicIssuer.href.trim() !== issuer || !["https:"].includes(cp.protocol))
      throw new Error();
    const endpoint = new URL("/v1/platform-context/validate",cp).href;
    const introspection = inspection.href;
    const client = Buffer.from(
      encodeURIComponent(issuerClientId)+":"+encodeURIComponent(issuerClientSecret),
    ).toString("base64");

    async function issuerCurrent(subjectToken) {
      const value = await jsonOriginal(fetcher, introspection, {
        method:"POST",
        headers: {
          "Authorization":"Basic "+client,
          "Content-Type":"application/x-www-form-urlencoded",
          "Accept":"application/json",
        },
        body:new URLSearchParams({ token:subjectToken }).toString(),
      });
      const audiences = typeof value.aud === "string" ? [value.aud] : value.aud;
      const current = now()/1000;
      if (value.active !== true || value.iss !== issuer ||
        !Array.isArray(audiences) || audiences.length !== 1 ||
        audiences[0] !== audience ||
        value.client_id !== trustedValidatorClientId ||
        value.sub !== trustedValidatorClientId ||
        typeof value.scope !== "string" ||
        !value.scope.split(" ").includes("tms:booking:submit") ||
        value.token_type && value.token_type.toLowerCase() !== "bearer" ||
        !Number.isSafeInteger(value.exp) || value.exp <= current+5 ||
        value.exp > current+900 ||
        value.nbf !== undefined && (!Number.isSafeInteger(value.nbf) || value.nbf > current) ||
        value.iat !== undefined && (!Number.isSafeInteger(value.iat) || value.iat > current))
        throw new N07TmsReadbackDenied();
      return { subject:value.sub, expiry:value.exp, issuer:value.iss,
        audience:audiences[0], clientId:value.client_id };
    }

    return Object.freeze({
      async observe({contextId, subjectToken, validatorToken, expected}={}) {
        try {
          if (!tokenString(subjectToken) || !tokenString(validatorToken) ||
            subjectToken === validatorToken ||
            !exact(expected,["tenantId","organisationId","marketId","purpose"]) ||
            expected.purpose !== "RUNTIME") throw new Error();
          const shape = buildCpContextValidationRequest({contextId,subjectToken});
          const first = await issuerCurrent(subjectToken);
          const cpResult = await jsonOriginal(fetcher,endpoint,{
            method:shape.method,
            headers:{
              "Authorization":"Bearer "+validatorToken,
              "Content-Type":"application/json",
              "Accept":"application/json",
            },
            body:JSON.stringify(shape.body),
          });
          const context = inspectCpValidationReadback({
            contextId,reply:cpResult,expected,now:new Date(now()),
          });
          if (context.canExecute !== false || context.canActivate !== false)
            throw new Error();
          const second = await issuerCurrent(subjectToken);
          if (!exact(first,["subject","expiry","issuer","audience","clientId"]) ||
            JSON.stringify(first) !== JSON.stringify(second)) throw new Error();
          return Object.freeze({
            status:"REAL_ISSUER_CP_HTTP_READBACK_UNATTESTED",
            source:"N07_CURRENT_HTTP_NOT_NATIVE_APPROVAL",
            currentIssuerObserved:true,
            currentCpContextObserved:true,
            canExecute:false, canActivate:false,
            legalActorCertified:false, nativeBindingCertified:false,
            originalTeardownCertified:false,
          });
        } catch {
          throw new N07TmsReadbackDenied();
        }
      },
      async execute() {
        throw new N07TmsReadbackDenied();
      },
    });
  } catch {
    throw new N07TmsReadbackDenied();
  }
}
