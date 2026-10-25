'use strict';
// Native two-instance SocketCluster JWT and channel enforcement acceptance.
// Runs inside EACH pinned Fleetbase socket/server.js instance, no exposed ports.
// Synthetic vendor JWTs are NOT Baobab IAM/CP principals.
const assert=require('node:assert/strict');
const {create}=require('socketcluster-client');
const {signJwt,userClaims,memoryAuthEngine,trySubscribe,withTimeout}=require('./test/helpers');
const own=process.env.HYB_SOCKET_OWN_KEY;
const foreign=process.env.HYB_SOCKET_FOREIGN_KEY;
if(!own||!foreign||own.length<32||foreign.length<32||own===foreign)throw Error("Independent native socket keys required");
async function connect(token){
 const client=create({
  hostname:'127.0.0.1',port:8000,path:'/socketcluster/',
  autoReconnect:false,ackTimeout:4000,
  authEngine:memoryAuthEngine(token),
  wsOptions:{origin:process.env.HYB_SOCKET_ORIGIN},
  query:{client:'hyb01-native-test/1.0'}
 });
 try{
  const status=await withTimeout(client.listener('connect').once(),5000,'pinned socket connect');
  return {client,status};
 }catch(e){client.disconnect();throw e;}
}
(async()=>{
 const good=await connect(signJwt(userClaims(),own));
 try{
  assert.equal(good.status.isAuthenticated,true,"Correct native key must authenticate");
  const ok=await trySubscribe(good.client,'user.user-uuid-1',3000);
  assert.equal(ok.ok,true,"Own channel must be allowed");
  const other=await trySubscribe(good.client,'user.somebody-else',3000);
  assert.equal(other.ok,false,"Other user's channel must be denied without API");
 }finally{good.client.disconnect();}
 const wrong=await connect(signJwt(userClaims(),foreign));
 try{
  assert.equal(wrong.status.isAuthenticated,false,"Other deployment signing key cannot authenticate");
  const res=await trySubscribe(wrong.client,'user.user-uuid-1',3000);
  assert.equal(res.ok,false);
 }finally{wrong.client.disconnect();}
 const anon=await connect(null);
 try{
  assert.equal(anon.status.isAuthenticated,false);
  assert.equal((await trySubscribe(anon.client,'user.user-uuid-1',3000)).ok,false);
 }finally{anon.client.disconnect();}
 console.log(JSON.stringify({result:"PINNED_FLEETBASE_SOCKET_AUTH_A_B",tests:[
   "local_signed_jwt_allowed","own_channel_allowed","foreign_user_channel_denied",
   "other_tenant_signed_jwt_denied","anonymous_user_channel_denied"
 ]}));
})().catch(e=>{console.error("NATIVE_SOCKET_PROOF_FAILED",e.message);process.exitCode=1});
