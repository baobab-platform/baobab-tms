#!/usr/bin/env node
/** Immutable Shared/CP/IAM source contract drift test. NO runtime grant. */
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {join} from "node:path";
const root=process.argv[2]??".sources";
const pin=JSON.parse(readFileSync("config/contracts/hyb-04-source-pin.json","utf8"));
const sources=[["shared",pin.shared],["cp",pin.controlPlane],["iam",pin.iam]];
function check(ok,reason){if(!ok)throw Error("HYB04_SOURCE_CONTRACT_DRIFT: "+reason)}
for(const [dir,p] of sources){
 check(/^[a-f0-9]{40}$/.test(p.commit),"invalid SHA "+dir);
 const actual=execFileSync("git",["-C",join(root,dir),"rev-parse","HEAD"],{encoding:"utf8"}).trim();
 check(actual===p.commit,"unreviewed "+dir+" source revision");
}
const file=(r,p)=>readFileSync(join(root,r,p),"utf8");
const json=(r,p)=>JSON.parse(file(r,p));
const context=json("shared","contracts/control-plane/v1/platform-context.schema.json");
const v2=json("shared","contracts/control-plane/v2/platform-context.schema.json");
const operations=json("shared","contracts/control-plane/v1/execution-operation.schema.json");
const resolution=json("shared","contracts/capability/v1/resolution.schema.json");
const token=json("shared","contracts/identity/v1/workload-token-response.schema.json");
const request=context.$defs.PlatformContextValidateRequest;
const validation=context.$defs.PlatformContextValidation;
const eq=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
check(request.type==="object"&&request.additionalProperties===false&&
 eq(request.required,["context_id","subject_token"])&&
 eq(Object.keys(request.properties),["context_id","subject_token"]),
 "CP validate request must contain context and subject token only");
check(request.properties.subject_token.minLength===16&&
 request.properties.subject_token.maxLength===8192&&
 request.properties.subject_token.writeOnly===true,
 "subject-token opaque credential contract changed");
check(validation.additionalProperties===false&&
 eq(validation.required,["context_id","tenant_id","resolved_at","expires_at","authority_purpose"]),
 "CP readback core/expiry/purpose drift");
check(!Object.hasOwn(validation.properties,"legal_entity_id")&&
 !Object.hasOwn(validation.properties,"principal_id")&&
 !Object.hasOwn(validation.properties,"binding_id"),
 "CP context is not legal actor or operation grant");
check(validation.properties.provisioning_authority.$ref==="#/$defs/ProvisioningContextAuthority"&&
 eq(context.$defs.ProvisioningContextAuthority.required,
 ["tenant_provisioning_id","plan_id","plan_version","plan_digest"]),
 "CP provisioning plan tuple drift");
check(context.$defs.ContextAuthorityPurpose.enum.includes("TENANT_PROVISIONING")&&
 context.$defs.ContextAuthorityPurpose.enum.includes("RUNTIME"),"authority purpose drift");
check(v2.$defs.PlatformContextValidation.allOf.some(x=>
 Array.isArray(x.required)&&x.required.includes("organisation_id")),
 "v2 CP attested primary Organisation missing");
check(eq(resolution.$defs.resolutionRequest.required,
 ["capability_key","context_id","correlation_id"])&&
 !Object.hasOwn(resolution.$defs.resolutionRequest.properties,"tenant_id"),
 "capability resolution must redeem own context");
check(operations.$defs.operationType.enum.every(x=>!x.includes("TMS")&&!x.includes("NATIVE"))&&
 operations.$defs.ExecutionOperation.properties.operation_type.$ref==="#/$defs/operationType",
 "TMS native operation now exists; review CP and Shared acceptance");
check(token.$defs.WorkloadTokenResponse.required.includes("access_token")&&
 token.$defs.WorkloadTokenResponse.required.includes("expires_in"),
 "IAM token response drift");
const registry=file("shared","contracts/identity/v1/workload-registry.yaml");
check(!registry.includes("baobab-tms")&&!registry.includes("baobab-dev-tms"),
 "TMS workload registry changed: new authority review required");
const cpValidation=file("cp","api/platform_context_validate_handler.go");
const cpResolve=file("cp","api/capability_resolve_handler.go");
check(cpValidation.includes("POST /v1/platform-context/validate")&&
 cpValidation.includes("auth.ContextValidateScope")&&
 cpValidation.includes("verifySubject(")&&
 cpValidation.includes('json:"subject_token"')&&
 cpValidation.includes('json:"authority_purpose"')&&
 cpValidation.includes("writeJSON(w, http.StatusOK, response)"),
 "CP validator path or subject/validator verification drift");
check(cpResolve.includes("callerOwnsContext(")&&
 cpResolve.includes("POST /v1/capabilities/resolve"),
 "CP capability context ownership drift");
const iam=file("iam","internal/tokenprofile/profile.go");
check(iam.includes("SharedCommit")&&iam.includes("allowed_audiences")&&
 iam.includes("allowed_scopes")&&iam.includes("FederatedGrant"),
 "IAM workload profile drift");
check(pin.admission.tmsValidatorRegistered===false&&
 pin.admission.tmsNativeExecutionOperationRegistered===false&&
 pin.admission.connectedAuthQualified===false&&
 pin.admission.nativeProviderAdmission===false,
 "source pin cannot claim connected/runtime qualification");
console.log(JSON.stringify({status:"PINNED_SHARED_CP_IAM_CONTRACT_SHAPES_ONLY",
 shared:pin.shared.commit,cp:pin.controlPlane.commit,iam:pin.iam.commit,
 contextSchemaPinned:true,tmsValidatorRegistered:false,
 tmsNativeOperationRegistered:false,canExecute:false}));
