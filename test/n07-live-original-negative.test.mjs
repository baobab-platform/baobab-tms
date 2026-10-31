import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {join,resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
const script=join(root,"scripts/n07-real-issuer-cp-observe.mjs");
const example=join(root,"docs/implementation/n07-issuer-cp-profile.example.json");

test("unprovisioned development cannot claim issuer, CP or provider success",()=>{
  const result=spawnSync(process.execPath,[script,example,"/tmp/tms-n07-should-not-write"],{
    cwd:root,env:{...process.env,BAOBAB_ENVIRONMENT:"development"},encoding:"utf8",timeout:8000,
  });
  assert.equal(result.status,2);
  assert.match(result.stderr,/TMS_N07_AUTHORITY_BLOCKED_NO_ACCEPTANCE/);
  assert.doesNotMatch(result.stdout,/ACCEPTED/);
});
test("protected environment is rejected even if synthetic profile exists",()=>{
  const result=spawnSync(process.execPath,[script,example,"/tmp/tms-n07-should-not-write"],{
    cwd:root,env:{...process.env,BAOBAB_ENVIRONMENT:"production"},encoding:"utf8",timeout:8000,
  });
  assert.equal(result.status,2);
  assert.match(result.stderr,/NO_ACCEPTANCE/);
});
test("original worksheet has no credential or real source pin",()=>{
  const profile=JSON.parse(readFileSync(example,"utf8"));
  assert.equal(profile.environment,"development");
  assert.equal(profile.source_pins["baobab-tms"],"0".repeat(40));
  assert.equal(profile.issuer_secret_file.startsWith("/run/private/"),true);
  assert.ok(!JSON.stringify(profile).includes("client_secret"));
});
