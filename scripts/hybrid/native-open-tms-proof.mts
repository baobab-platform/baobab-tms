/**
 * HYB-02 exact-source native Open TMS qualifier. Copied into a disposable,
 * pinned upstream checkout by GitHub Actions. This is a *test*, not a patched
 * upstream distribution, external carrier action or Baobab auth provider.
 *
 * Uses the real upstream Prisma client, AuthService and PgBossQueueAdapter.
 * Never log synthetic credentials or bearer tokens.
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './backend/src/services/AuthService.js';
import { PgBossQueueAdapter } from './backend/src/queue/PgBossQueueAdapter.js';
import { QUEUES } from './backend/src/queue/events.js';

const db = new PrismaClient();
const orgA = '11111111-1111-4111-8111-111111111111';
const orgB = '22222222-2222-4222-8222-222222222222';
const customerA = '11111111-1111-4111-8111-111111111113';
const customerB = '22222222-2222-4222-8222-222222222223';
const webhookA = '11111111-1111-4111-8111-111111111114';
const webhookB = '22222222-2222-4222-8222-222222222224';
const emailA = 'native-a@hyb.example.invalid';
const emailB = 'native-b@hyb.example.invalid';
const password = process.env.HYB_NATIVE_PASSWORD;
const base = process.env.HYB_NATIVE_ORIGIN ?? 'http://hyb-native-api:3001';
const command = process.argv[2];

async function setup() {
  if (!password || password.length < 16) throw new Error('No synthetic fixture password');
  const auth = new AuthService(db);
  await db.organization.createMany({
    data: [{id: orgA, name: 'Native synthetic A'}, {id: orgB, name: 'Native synthetic B'}]
  });
  await db.customer.createMany({data: [
    {id: customerA, orgId: orgA, name: 'A-private-customer'},
    {id: customerB, orgId: orgB, name: 'B-private-customer'}
  ]});
  const role = await db.role.create({
    data: { name: 'hyb-native-isolation-probe', permissions: ['*'], description: 'Disposable native test only' }
  });
  for (const [id, email, org] of [
    ['11111111-1111-4111-8111-111111111112', emailA, orgA],
    ['22222222-2222-4222-8222-222222222222', emailB, orgB]
  ]) {
    const user = await db.user.create({
      data: {id, firstName: 'Native', lastName: 'Probe', email,
             organizationId: org, passwordHash: auth.hashPassword(password)}
    });
    await db.userRole.create({data: {userId: user.id, roleId: role.id}});
  }
  await db.webhookLog.createMany({data: [
    {id: webhookA, orgId: orgA, method: 'POST', status: 'queued', rawPayload: {}},
    {id: webhookB, orgId: orgB, method: 'POST', status: 'queued', rawPayload: {}}
  ]});
  console.log(JSON.stringify({result: 'NATIVE_ORG_FIXTURES_CREATED', tenantKinds: 2}));
}

async function call(token, method, path, body) {
  const headers = {authorization: token ? 'Bearer ' + token : '', accept: 'application/json'};
  if (body) headers['content-type'] = 'application/json';
  const response = await fetch(base + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000)
  });
  return {status: response.status, payload: await response.json()};
}

function encode(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function nativeSignedToken(claims) {
  const h = encode({alg: 'HS256', typ: 'JWT'});
  const p = encode(claims);
  const sig = createHmac('sha256', process.env.JWT_SECRET).update(h + '.' + p).digest('base64url');
  return h + '.' + p + '.' + sig;
}
function assertCustomerList(reply, mine, other) {
  assert.equal(reply.status, 200, 'Native scoped customer list must be available');
  const names = (reply.payload.data ?? []).map(x => x.name);
  assert(names.includes(mine), 'Own tenant customer absent from native list');
  assert(!names.includes(other), 'Native cross-org customer disclosure');
}
async function httpAcceptance() {
  if (!password || !process.env.JWT_SECRET) throw new Error('No local native test credentials');
  const auth = new AuthService(db);
  const a = (await auth.login(emailA, password)).token;
  const b = (await auth.login(emailB, password)).token;
  const list = '/api/v1/customers';
  assertCustomerList(await call(a, 'GET', list), 'A-private-customer', 'B-private-customer');
  assertCustomerList(await call(b, 'GET', list), 'B-private-customer', 'A-private-customer');
  assert.equal((await call(a, 'GET', list + '/' + customerB)).status, 404);
  assert.equal((await call(b, 'GET', list + '/' + customerA)).status, 404);
  assert.equal((await call(a, 'PUT', list + '/' + customerB, {name: 'A-tampered-B'})).status, 404);
  assert.equal((await call(b, 'PUT', list + '/' + customerA, {name: 'B-tampered-A'})).status, 404);
  assert.equal((await call(null, 'GET', list)).status, 401);
  assert.equal((await call(a.slice(0, -4) + 'AAAA', 'GET', list)).status, 401);

  // Native middleware must fail closed when both orgs exist and the bearer
  // contains no organisation claim (signed here only with disposable native
  // test key, not IAM). A one-org fallback must never select the first tenant.
  const payload = JSON.parse(Buffer.from(a.split('.')[1], 'base64url').toString());
  delete payload.organizationId;
  assert.equal((await call(nativeSignedToken(payload), 'GET', list)).status, 401);

  const created = await call(a, 'POST', list, {name: 'A-positive-native-write'});
  assert.equal(created.status, 201, 'Real native command write must be accepted');
  assert.equal(created.payload?.data?.orgId, orgA);
  assertCustomerList(await call(a, 'GET', list), 'A-positive-native-write', 'B-private-customer');
  assertCustomerList(await call(b, 'GET', list), 'B-private-customer', 'A-positive-native-write');
  assert.equal((await db.customer.findUnique({where: {id: customerB}})).name, 'B-private-customer');
  assert.equal((await db.customer.findUnique({where: {id: customerA}})).name, 'A-private-customer');
  console.log(JSON.stringify({result:'NATIVE_FASTIFY_TWO_ORG_POSITIVE_AND_NEGATIVE', tests: [
    'real_native_login_issuance', 'own_org_list', 'foreign_org_get_404',
    'foreign_org_update_404', 'unsigned_deny', 'bad_signature_deny',
    'missing_org_deny', 'native_positive_command'
  ]}));
}
async function sendWorkerProbe() {
  const native = new PgBossQueueAdapter(process.env.DATABASE_URL);
  await native.start();
  let wrongOrg: string | undefined;
  let own: string | undefined;
  try {
    wrongOrg = await native.publish(QUEUES.INBOUND_WEBHOOK, {
      type: 'inbound.webhook', payload: {
        webhookLogId: webhookB, orgId: orgA, rawPayload: {},
        apiKeyId: null, ipAddress: '127.0.0.1'
      }
    });
    own = await native.publish(QUEUES.INBOUND_WEBHOOK, {
      type: 'inbound.webhook', payload: {
        webhookLogId: webhookA, orgId: orgA, rawPayload: {},
        apiKeyId: null, ipAddress: '127.0.0.1'
      }
    });
    // UUID job identifiers are non-secret; no customer data or JWT is logged.
  } finally { await native.stop(); }
  // Publish the machine-readable witness after pg-boss shutdown diagnostics.
  console.log(JSON.stringify({result:'NATIVE_PGBOSS_PROBES_PUBLISHED', wrongOrg, own}));
}
async function pollJob(jobId) {
  for (let i = 0; i < 45; i++) {
    const rows = await db.$queryRawUnsafe('SELECT state::text AS state FROM pgboss.job WHERE id = $1::uuid', jobId);
    if (rows?.[0]?.state === 'completed') return;
    if (rows?.[0]?.state === 'failed' || rows?.[0]?.state === 'cancelled') {
      throw new Error('Native worker did not complete expected job');
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Native worker completion not observed within bounded window');
}
async function verifyWorker(jobIds) {
  await pollJob(jobIds.wrongOrg);
  await pollJob(jobIds.own);
  assert.equal((await db.webhookLog.findUnique({where:{id:webhookB}}))?.status, 'queued',
    'A-org native queued work must not mutate B-org webhook log');
  const own = await db.webhookLog.findUnique({where:{id:webhookA}});
  assert.equal(own?.status, 'skipped',
    'The native worker must positively process the owned harmless webhook');
  assert(own.processedAt, 'Native worker did not mark own log processed');
  // Background data provenance is native source, not a fake job handler.
  console.log(JSON.stringify({result:'NATIVE_WORKER_TWO_ORG_REFUSAL_AND_OWN_PROCESS',
    tests:['pgboss_actual_publish', 'actual_upstream_worker_consumption',
      'wrong_org_job_no_mutation', 'own_org_job_updates_owned_record']}));
}
try {
  await db.$connect();
  if (command === 'seed') await setup();
  else if (command === 'http') await httpAcceptance();
  else if (command === 'publish') await sendWorkerProbe();
  else if (command === 'worker-verify') await verifyWorker(JSON.parse(process.argv[3]));
  else throw new Error('Unknown HYB-02 proof mode');
} finally {
  await db.$disconnect();
}
