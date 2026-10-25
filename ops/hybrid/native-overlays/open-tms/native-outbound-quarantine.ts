// @ts-ignore First-party audited ESM gateway ships with pinned vendor overlay.
import { createTrustedOutbound } from './trusted-native-outbound.mjs';

/**
 * Native quarantine. No ungoverned EDI or webhook destination may be dialled.
 * Must be replaced only with a real CP-authorised destination verifier using
 * IAM workload identity, current binding revisions and approved hostname.
 */
const sender=createTrustedOutbound({verifyDestination:async()=>null});
export async function nativeOutboundFetch(
  url: string,
  opts: {method: string;headers?: Record<string,string>;body?: string;signal?: AbortSignal},
  context: {tenantId:string;organisationId:string;partnerId:string;kind:'EDI'|'WEBHOOK'}
): Promise<{ok:boolean;status:number;statusText:string;text:()=>Promise<string>}> {
  if(opts.method!=='POST')throw Error('Native outbound method not approved');
  const result=await sender.post(context,{
    url,content:opts.body??'',headers:opts.headers??{},timeoutMs:10000
  });
  return {ok:result.accepted,status:result.status,statusText:'',text:async()=>''};
}
