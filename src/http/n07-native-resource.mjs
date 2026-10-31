/**
 * An independently fenced TMS-native resource admission endpoint.
 *
 * This deliberately exposes ONLY a private development diagnostic and
 * NEVER a booking command. The subject is a TMS-workload audience, not the
 * Thamani human BFF. Source owner must inject a current issuer/CP/legalActor
 * /native preflight before binding this handler to a private loopback server.
 *
 * Until Shared and CP register ACTIVE workload/native operation authority and
 * a native provider is qualified, all outcomes are non-executable HTTP 503.
 */
import { createServer } from "node:http";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bearer=v=>typeof v==="string"&&/^Bearer [A-Za-z0-9._~-]{16,8192}$/.test(v);
const exactly=(obj,fields)=>obj!==null&&typeof obj==="object"&&!Array.isArray(obj)&&
  Object.keys(obj).length===fields.length&&fields.every(x=>Object.hasOwn(obj,x));
const reply=(res,status,code)=>{
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store","Pragma":"no-cache",
    "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"});
  res.end(JSON.stringify({status:code,execution_authority:false,booking_accepted:false}));
};
async function body(req){
  const sizeHeader=req.headers["content-length"];
  if(sizeHeader!==undefined&&(!/^\d+$/.test(sizeHeader)||
    Number(sizeHeader)>2048))throw new Error();
  let received=0;const buffers=[];
  for await(const part of req){
    received+=part.length;
    if(received>2048)throw new Error();
    buffers.push(part);
  }
  const bytes=Buffer.concat(buffers,received);
  if(bytes.length===0)throw new Error();
  const data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  if(!exactly(data,["context_id"])||!UUID.test(data.context_id))
    throw new Error();
  return data.context_id;
}

export function createN07NativeAdmissionResource({
  sourceOwned,preflight,
}={}){
  if(process.env.BAOBAB_ENVIRONMENT!=="development"||
    !sourceOwned||typeof preflight?.assess!=="function"||
    typeof preflight?.execute!=="function"||
    !exactly(sourceOwned,["contextId","validatorToken","legalActorToken",
      "expected","operation","bindingId","nativeRequestFactory"])||
    sourceOwned.operation!=="tms.booking.submit"||
    !UUID.test(sourceOwned.contextId??"")||
    typeof sourceOwned.nativeRequestFactory!=="function")
    throw new Error("N07_NATIVE_RESOURCE_PRIVATE_DEVELOPMENT_ONLY");
  return createServer(async(req,res)=>{
    if(req.method==="GET"&&req.url==="/livez"){
      reply(res,200,"N07_PRIVATE_COMPONENT_LIVE_NOT_READY");
      return;
    }
    if(req.method!=="POST"||req.url!=="/internal/tms/n07/booking/preflight"){
      reply(res,404,"NOT_IMPLEMENTED");return;
    }
    // Caller cannot select tenant/market/legal actor/provider binding, amend
    // the policy or send Kratos/browser cookies to impersonate a workload.
    const auth=req.headers.authorization;
    if(!bearer(auth)||req.headers.cookie||req.headers["x-tenant-id"]||
      req.headers["x-organisation-id"]||req.headers["x-market"]||
      req.headers["x-legal-actor"]||
      !/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"]??"")){
      reply(res,403,"TMS_NATIVE_AUTHORITY_UNAVAILABLE");return;
    }
    try{
      const contextId=await body(req);
      if(contextId!==sourceOwned.contextId)throw new Error();
      const subjectToken=auth.slice(7);
      if(subjectToken===sourceOwned.validatorToken||
        subjectToken===sourceOwned.legalActorToken)throw new Error();
      const nativeRequest=sourceOwned.nativeRequestFactory(subjectToken);
      if(!exactly(nativeRequest,["token","request"])||
        nativeRequest.token!==subjectToken||
        nativeRequest.request?.contextId!==contextId||
        nativeRequest.request?.operation!==sourceOwned.operation||
        nativeRequest.request?.bindingId!==sourceOwned.bindingId)
        throw new Error();
      const result=await preflight.assess({
        subjectToken,validatorToken:sourceOwned.validatorToken,
        legalActorToken:sourceOwned.legalActorToken,contextId,
        expected:sourceOwned.expected,nativeRequest,
      });
      // Even when issuer/CP/mandate/native diagnostics succeed, the actual
      // provider accept/reject fence is absent. This HTTP handler CANNOT
      // execute, reserve, dispatch, book or activate a native provider.
      if(result?.canExecute!==false||result?.bookingAccepted!==false)
        throw new Error();
      reply(res,503,"N07_PROOF_OBSERVED_NATIVE_EXECUTION_HELD");
    }catch{
      reply(res,503,"TMS_NATIVE_AUTHORITY_UNAVAILABLE");
    }
  });
}
