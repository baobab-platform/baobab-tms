import test from "node:test";
import assert from "node:assert/strict";
import {
  createN07TmsIssuerCpReadback, N07TmsReadbackDenied,
} from "../src/security/n07-issuer-cp-real-readback.mjs";

const contextId = "10000000-0000-4000-8000-000000000008";
const now = Date.parse("2026-10-31T12:00:00Z");
const expected = {tenantId:"tn_tmsleased",organisationId:"019a0915-a8c0-7000-8000-000000000002",
  marketId:"market-za",countryCode:"ZA",purpose:"RUNTIME"};
const config = {
  issuer:"https://issuer.example.test/",
  introspectionUrl:"https://issuer-admin.example.test/admin/oauth2/introspect",
  cpOrigin:"https://cp.example.test",
  audience:"baobab-tms",
  issuerClientId:"tms-private-validation-client",
  issuerClientSecret:"synthetic-original-private-secret",
  trustedSubjectClientId:"baobab-dev-tms-subject",
  now:()=>now,
};

function fixture(changes={}) {
  const calls=[];
  const issuer = {active:true,iss:config.issuer,sub:config.trustedSubjectClientId,
    client_id:config.trustedSubjectClientId,aud:config.audience,
    scope:"tms:booking:submit",exp:Math.floor((now+60_000)/1000),iat:Math.floor((now-10_000)/1000)};
  const cp = {context_id:contextId,tenant_id:expected.tenantId,
    organisation_id:expected.organisationId,market_id:expected.marketId,
    authority_purpose:"RUNTIME",
    resolved_at:new Date(now-10_000).toISOString(),
    expires_at:new Date(now+60_000).toISOString()};
  const fetcher=async (address, options) => {
    calls.push({address,options});
    if (address === config.introspectionUrl) {
      const n=calls.filter(c=>c.address===address).length;
      return Response.json({...issuer,...(n>1?changes.afterIssuer:changes.issuer)});
    }
    if (address === config.cpOrigin+"/v1/platform-context/validate")
      return Response.json({...cp,...changes.cp});
    return new Response(null,{status:404});
  };
  const gate=createN07TmsIssuerCpReadback({...config,fetcher});
  const request={contextId,subjectToken:"synthetic-original-subject-credential",
    validatorToken:"separate-CP-validator-credential",expected};
  return {calls,gate,request};
}

test("two actual protocol calls to issuer bracket exact Shared CP validation, no native execution",async()=>{
  const f=fixture(),observed=await f.gate.observe(f.request);
  assert.equal(observed.status,"REAL_ISSUER_CP_HTTP_READBACK_UNATTESTED");
  assert.equal(observed.canExecute,false);
  assert.equal(observed.legalActorCertified,false);
  assert.equal(observed.nativeBindingCertified,false);
  assert.deepEqual(f.calls.map(x=>x.address),
    [config.introspectionUrl,config.cpOrigin+"/v1/platform-context/validate",config.introspectionUrl]);
  assert.equal(f.calls[1].options.headers.Authorization,"Bearer separate-CP-validator-credential");
  assert.deepEqual(JSON.parse(f.calls[1].options.body),{
    context_id:contextId,subject_token:f.request.subjectToken});
  assert.ok(!JSON.stringify(observed).includes("synthetic-original"));
  await assert.rejects(f.gate.execute(),N07TmsReadbackDenied);
});
test("revocation between CP and second issuer readback fails closed",async()=>{
  const f=fixture({afterIssuer:{active:false}});
  await assert.rejects(f.gate.observe(f.request),N07TmsReadbackDenied);
});
test("wrong audience, subject, scope, client and inactive issuer all deny",async()=>{
  for(const bad of [{active:false},{aud:"baobab-control-plane"},
    {sub:"neighbour"},{client_id:"unregistered"},{scope:"context:resolve"},
    {exp:1},{iat:Math.floor(now/1000)+60}]) {
    const f=fixture({issuer:bad});
    await assert.rejects(f.gate.observe(f.request),N07TmsReadbackDenied);
  }
});
test("CP response cannot manufacture legal actor or foreign scope",async()=>{
  for(const bad of [{tenant_id:"tn_foreign"},
    {organisation_id:undefined},{market_id:undefined},
    {authority_purpose:"TENANT_PROVISIONING"},
    {expires_at:new Date(now-1000).toISOString()}]) {
    const f=fixture({cp:bad});
    await assert.rejects(f.gate.observe(f.request),N07TmsReadbackDenied);
  }
});
test("browser or vendor cannot replace validator credentials or current expectation",async()=>{
  const f=fixture();
  for(const change of [{validatorToken:f.request.subjectToken},
    {validatorToken:"short"}, {contextId:"foreign"},
    {expected:{...expected,tenantId:"tn_foreign"}},
    {expected:{...expected,kind:"EXECUTE"}},
    {expected:{...expected,purpose:"TENANT_PROVISIONING"}}]) {
    await assert.rejects(f.gate.observe({...f.request,...change}),N07TmsReadbackDenied);
  }
});
test("unknown TLS, unreviewed URLs and incomplete private client reject startup",()=>{
  for(const altered of [{issuer:"http://issuer.example.test"},
    {cpOrigin:"http://cp.example.test"}, {cpOrigin:"https://cp.example.test/other"},
    {introspectionUrl:"https://user:pass@issuer-admin.example.test/introspect"},
    {issuerClientSecret:"not-long"}]) {
    assert.throws(()=>createN07TmsIssuerCpReadback({...config,...altered}),N07TmsReadbackDenied);
  }
});
test("issuer and CP returned HTTP transport must be actual 200 JSON",async()=>{
  const f=createN07TmsIssuerCpReadback({...config,fetcher:async()=>new Response("Not ready",{status:503})});
  await assert.rejects(f.observe(fixture().request),N07TmsReadbackDenied);
});
