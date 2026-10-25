/**
 * Fail-closed transport adapter for native EDI and webhook HTTP.
 *
 * Do not use native fetch(url) directly. Caller-supplied URL is NOT authority.
 * TMS calls verifyDestination (a trusted CP-governed policy readback) for EVERY
 * send and pins a public DNS result as the TLS TCP destination. TLS verifies
 * the original hostname; redirects and ambient proxy variables are ignored.
 */
import https from "node:https";
import { lookup as defaultLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [network,prefix] of [
  ["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],
  ["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],
  ["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],
  ["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],
  ["224.0.0.0",4],["240.0.0.0",4]
]) blocked.addSubnet(network,prefix,"ipv4");
for (const [network,prefix] of [
  ["::",128],["::1",128],["fc00::",7],["fe80::",10],
  ["ff00::",8],["2001:db8::",32],["2001::",32]
]) blocked.addSubnet(network,prefix,"ipv6");
const deniedHost=/(\.localhost|\.local|\.internal|\.test|\.invalid|^localhost$)$/i;

export class UntrustedDestinationError extends Error {
  constructor(message="Destination not currently authorised") {
    super(message);this.name="UntrustedDestinationError";this.code="OUTBOUND_DESTINATION_DENIED";
  }
}
export function checkPublicAddress(address) {
  const kind=isIP(address);
  if (!kind || blocked.check(address,kind===4?"ipv4":"ipv6") ||
      (kind===6 && /^(::ffff:|0:0:0:0:0:ffff:)/i.test(address))) {
    throw new UntrustedDestinationError("Non-public outbound destination");
  }
  return {address,family:kind};
}
function normalisedTarget(candidate) {
  let u;
  try { u=new URL(candidate); } catch { throw new UntrustedDestinationError(); }
  if(u.protocol!=="https:" || (u.port && u.port!=="443") ||
     u.username || u.password || u.hash ||
     !u.hostname || u.hostname.length>253 || deniedHost.test(u.hostname) ||
     isIP(u.hostname) || !/^[a-z0-9.-]+$/i.test(u.hostname) ||
     u.hostname.split(".").length<2) throw new UntrustedDestinationError();
  return u;
}
export async function qualifyOutboundDestination(
  {url,tenantId,organisationId,partnerId,kind},
  {verifyDestination,lookup=defaultLookup,now=()=>Date.now()}
) {
  if(typeof verifyDestination!=="function")throw new UntrustedDestinationError();
  const u=normalisedTarget(url);
  if(typeof tenantId!=="string"||typeof organisationId!=="string"||
     typeof partnerId!=="string"||!["EDI","WEBHOOK"].includes(kind))throw new UntrustedDestinationError();
  const evidence=await verifyDestination({
    tenantId,organisationId,partnerId,kind,host:u.hostname,protocol:"https:",port:443
  });
  if(evidence?.source!=="CP_VERIFIED"||evidence?.decision!=="ALLOW"||
     evidence?.tenantId!==tenantId||evidence?.organisationId!==organisationId||
     evidence?.partnerId!==partnerId||evidence?.kind!==kind||
     evidence?.hostname!==u.hostname||
     !Number.isFinite(evidence.verifiedUntil)||
     evidence.verifiedUntil<=now()||evidence.verifiedUntil>now()+30000)
       throw new UntrustedDestinationError();
  let addrs;
  try { addrs=await lookup(u.hostname,{all:true,verbatim:true}); }
  catch { throw new UntrustedDestinationError("Destination DNS not available"); }
  if(!Array.isArray(addrs)||!addrs.length)throw new UntrustedDestinationError();
  // Fail when any DNS answer is not public: never quietly select a public A
  // record while a private A/AAAA record can be reached by later requests.
  const clean=addrs.map(({address})=>checkPublicAddress(address));
  return Object.freeze({url:u,ip:clean[0].address,family:clean[0].family});
}
export function createTrustedOutbound({verifyDestination,lookup=defaultLookup,transport=https,now=()=>Date.now()}) {
  if(typeof verifyDestination!=="function")throw new UntrustedDestinationError();
  return Object.freeze({
    async post(context,{url,content,headers={},timeoutMs=10000}) {
      if(typeof content!=="string"&& !Buffer.isBuffer(content))
        throw new UntrustedDestinationError("Invalid outbound content");
      if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>10000)
        throw new UntrustedDestinationError("Invalid network deadline");
      const target=await qualifyOutboundDestination({...context,url},{verifyDestination,lookup,now});
      const safeHeaders={};
      for(const [k,v] of Object.entries(headers)) {
        if(!/^[a-z0-9-]+$/i.test(k)||/^(host|connection|proxy-|forwarded|x-forwarded|transfer-encoding|content-length)$/i.test(k)||
           typeof v!=="string"||v.length>8192||/[\r\n]/.test(v))
          throw new UntrustedDestinationError("Untrusted outbound header");
        safeHeaders[k]=v;
      }
      return new Promise((resolve,reject)=>{
        const req=transport.request(target.url,{
          method:"POST",servername:target.url.hostname,rejectUnauthorized:true,
          minVersion:"TLSv1.2",timeout:timeoutMs,maxHeaderSize:8192,
          lookup:(_host,_opts,done)=>done(null,target.ip,target.family),
          headers:{...safeHeaders,"Content-Length":Buffer.byteLength(content)}
        },res=>{
          const status=res.statusCode??0;
          // Never follow 3xx; a trusted host must not redirect us to local DNS.
          let bytes=0;
          res.on("data",chunk=>{
            bytes+=chunk.length;
            if(bytes>4096)req.destroy(new UntrustedDestinationError("Oversized outbound response"));
          });
          res.on("end",()=>{
            if(status>=300&&status<400)reject(new UntrustedDestinationError("Redirect blocked"));
            else resolve({status,accepted:status>=200&&status<300});
          });
          res.on("error",reject);
        });
        req.on("timeout",()=>req.destroy(new UntrustedDestinationError("Outbound timeout")));
        req.on("error",reject);
        req.end(content);
      });
    }
  });
}
