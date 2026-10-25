/** A pinned upstream-runtime negative test. NO real carrier/storage access. */
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {guardNativeBinary} from "./backend/src/baobab/native-binary-quarantine.js";
import {nativeOutboundFetch} from "./backend/src/baobab/native-outbound-quarantine.js";

const calls=[];
const raw={
  async store(...args){calls.push(["store",args]);},
  async retrieve(...args){calls.push(["retrieve",args]);return Buffer.from("raw-secret");},
  async exists(...args){calls.push(["exists",args]);return true;},
  async delete(...args){calls.push(["delete",args]);},
  async getSignedUrl(...args){calls.push(["presign",args]);return "https://raw-private";},
};
const native=guardNativeBinary(raw);
const key="files/"+randomUUID();
for(const [op,args] of [["store",[key,Buffer.from("private")]],["retrieve",[key]],
  ["exists",[key]],["delete",[key]],["getSignedUrl",[key,60]]]){
  await assert.rejects(native[op](...args),e=>e?.code==="NATIVE_STORAGE_DENIED");
}
assert.equal(calls.length,0,"Raw native binary adapter was reached without CP");
await assert.rejects(nativeOutboundFetch("https://carrier.example.com/edi",
  {method:"POST",body:"EDI"},
  {tenantId:"",organisationId:"11111111-1111-4111-8111-111111111111",
   partnerId:"p",kind:"EDI"}),e=>e?.code==="OUTBOUND_DESTINATION_DENIED");
await assert.rejects(nativeOutboundFetch("http://127.0.0.1:9000/webhook",
  {method:"POST",body:"payload"},
  {tenantId:"",organisationId:"11111111-1111-4111-8111-111111111111",
   partnerId:"p",kind:"WEBHOOK"}),e=>e?.code==="OUTBOUND_DESTINATION_DENIED");
import { OutboundEdiDeliveryService } from "./backend/src/services/OutboundEdiDeliveryService.js";
const partner={
 id:randomUUID(),orgId:"11111111-1111-4111-8111-111111111111",
 name:"Untrusted synthetic endpoint",active:true,outboundEnabled:true,
 outboundTransport:"sftp",sftpHost:"127.0.0.1",
 transactions:[{transactionType:"214",direction:"outbound",enabled:true}]
};
const repo={
 async findById(){return partner;},
 async createLog(){return {id:randomUUID()};},
 async updateLog(){return null;}
};
const service=new OutboundEdiDeliveryService(repo);
const attempt=()=>service.deliver({
 orgId:partner.orgId,partnerId:partner.id,transactionType:"214",
 ediContent:"SYNTHETIC-214",referenceId:"quarantine"
});
const blockedSftp=await attempt();
assert.equal(blockedSftp.success,false);
assert.match(blockedSftp.errorMessage,/Native SFTP denied/);
partner.outboundTransport="http";partner.httpUrl="http://127.0.0.1:9000/edi";
const blockedHttp=await attempt();
assert.equal(blockedHttp.success,false);
assert.match(blockedHttp.errorMessage,/Destination|authorised|denied/i);

console.log(JSON.stringify({
 result:"PINNED_NATIVE_STORAGE_AND_EGRESS_FAIL_CLOSED_OVERLAY",
 tests:["DI-wrapper-no-raw-access","native-worker-wrapper-no-raw-access",
        "EDI-without-CP-denied","webhook-private-target-denied","native-EDI-SFTP-refused","native-EDI-HTTP-refused"]
}));
