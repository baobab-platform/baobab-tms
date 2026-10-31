#!/usr/bin/env node
/* IAM-N07/TMS real-readback producer: owner-only source, real issuer and CP.
 * No simulated tokens, no website endpoints, no booking execution, no
 * acceptance promotion. Exit 3 = HTTP observation only; 2 = BLOCKED.
 */
import { constants } from "node:fs";
import {
  closeSync, existsSync, fstatSync, lstatSync, mkdirSync,
  openSync, readFileSync, statSync, writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createN07TmsIssuerCpReadback } from "../src/security/n07-issuer-cp-real-readback.mjs";
import { createN07TmsLegalActorReader } from "../src/security/n07-cp-legal-actor-readback.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHA = /^[a-f0-9]{40}$/;
const RUN = /^[a-f0-9]{32}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
class Held extends Error {}

function privateRead(path,limit=16384) {
  if (typeof path !== "string" || !isAbsolute(path)) throw new Held();
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const s = fstatSync(fd);
    if (!s.isFile() || s.uid !== process.getuid() || s.nlink !== 1 ||
      (s.mode & 0o077) !== 0 || s.size > limit || s.size < 1) throw new Held();
    return readFileSync(fd,{encoding:"utf8"});
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function profile(path) {
  const p = JSON.parse(privateRead(path,65536));
  const pins = p?.source_pins;
  if (p?.schema !== "baobab.tms.n07.issuer-cp-original.v1" ||
    p.environment !== "development" || !RUN.test(p.run_id) ||
    !pins || !["baobab-iam","baobab-cp","baobab-tms","shared"].every(
      name=>SHA.test(pins[name])) ||
    !uuid.test(p.context_id) ||
    !p.expected || p.expected.purpose !== "RUNTIME" ||
    !["UG","ZA"].includes(p.expected.countryCode) ||
    !/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/.test(p.expected_legal_entity_id ?? "") ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(p.native_binding_id ?? "") ||
    p.operation_reference !== "tms.booking.submit:"+p.native_binding_id)
    throw new Held();
  for (const field of ["subject_token_file","validator_token_file","issuer_secret_file","legal_actor_token_file"]) {
    if (typeof p[field] !== "string" || !isAbsolute(p[field]))
      throw new Held();
  }
  const current = execFileSync("git",["-C",ROOT,"rev-parse","HEAD"],{
    encoding:"utf8",timeout:5000}).trim();
  const dirty = execFileSync("git",["-C",ROOT,"status","--porcelain"],{
    encoding:"utf8",timeout:5000}).trim();
  if (current !== pins["baobab-tms"] || dirty) throw new Held();
  return p;
}

function original(directory,doc) {
  if (!isAbsolute(directory)) throw new Held();
  if (!existsSync(directory)) mkdirSync(directory,{mode:0o700,recursive:false});
  const s = statSync(directory);
  if (!s.isDirectory() || s.uid !== process.getuid() || (s.mode & 0o077) !== 0)
    throw new Held();
  const bytes=Buffer.from(JSON.stringify(doc)+"\n");
  const hash=createHash("sha256").update(bytes).digest("hex")+"\n";
  const receipt=join(directory,"original.json"),digest=join(directory,"original.sha256");
  if (existsSync(receipt) || existsSync(digest)) throw new Held();
  writeFileSync(receipt,bytes,{mode:0o600,flag:"wx"});
  writeFileSync(digest,hash,{mode:0o600,flag:"wx"});
}

async function main() {
  if (process.env.BAOBAB_ENVIRONMENT !== "development" ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" ||
    process.argv.length !== 4) throw new Held();
  const p = profile(process.argv[2]);
  const gate=createN07TmsIssuerCpReadback({
    issuer:p.issuer, introspectionUrl:p.introspection_url, cpOrigin:p.cp_origin,
    audience:p.audience, issuerClientId:p.issuer_client_id,
    trustedSubjectClientId:p.subject_client_id,
    issuerClientSecret:privateRead(p.issuer_secret_file,8192).trim(),
  });
  const subjectToken=privateRead(p.subject_token_file,8192).trim();
  const validatorToken=privateRead(p.validator_token_file,8192).trim();
  const legalActorToken=privateRead(p.legal_actor_token_file,8192).trim();
  if(new Set([subjectToken,validatorToken,legalActorToken]).size!==3)
    throw new Held();
  const expected=p.expected;
  const observe=()=>gate.observe({
    contextId:p.context_id,subjectToken,validatorToken,expected,
  });
  const result=await observe();
  const legal=createN07TmsLegalActorReader({
    cpOrigin:p.cp_origin,expectedLegalEntityId:p.expected_legal_entity_id,
  });
  const assess=()=>legal.assess({
    contextId:p.context_id,market:expected.countryCode,
    operationReference:p.operation_reference,accessToken:legalActorToken,
  });
  const legalBefore=await assess();
  const after=await observe();
  const legalAfter=await assess();
  if(result.canExecute!==false||after.canExecute!==false||
    legalBefore.canExecute!==false||legalAfter.canExecute!==false||
    legalBefore.mandateDigest!==legalAfter.mandateDigest||
    legalBefore.validUntil<=Date.now()||
    legalAfter.validUntil<=Date.now())
    throw new Held();
  original(process.argv[3],{
    schema:"baobab.tms.n07.issuer-cp-observation.v1",
    classification:"REAL_ISSUER_CP_LEGAL_READBACK_UNATTESTED",
    run_id:p.run_id,source_pins:p.source_pins,
    issuer_current:true,cp_context_current:true,
    cp_legal_mandate_observed:true,issuer_cp_second_readback:true,
    original_signed_jwt_verified:false,
    cp_legal_mandate_verified:false,
    native_binding_verified:false,
    native_execution_accepted:false,
    independent_teardown_verified:false,
    fully_qualified:false,
  });
  process.stdout.write("TMS_N07_REAL_HTTP_READBACK_UNATTESTED\n");
  process.exitCode=3;
}

try {
  await main();
} catch {
  process.stderr.write("TMS_N07_AUTHORITY_BLOCKED_NO_ACCEPTANCE\n");
  process.exitCode=2;
}
