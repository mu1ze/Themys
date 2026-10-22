import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { healthSql, metricsSql, reportingWindow, ratio } from '../../src/features/admin/metrics/queries.ts';
const window = reportingWindow('7', new Date('2026-09-09T15:00:00Z'));
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE users(id TEXT, created_at TEXT, subscription_status TEXT);
    CREATE TABLE scans(user_id TEXT, created_at TEXT, is_deleted INTEGER DEFAULT 0, is_monitoring_scan INTEGER DEFAULT 0, decision TEXT DEFAULT 'open', document_type TEXT DEFAULT 'unknown');
    CREATE TABLE usage_events(actor_hash TEXT, created_at TEXT, operation TEXT, outcome TEXT DEFAULT 'success', client_type TEXT DEFAULT 'web', cached INTEGER DEFAULT 0, credits INTEGER DEFAULT 0, ai_slots INTEGER DEFAULT 0, metadata TEXT DEFAULT '{}');
    CREATE TABLE invoices(id TEXT, user_id TEXT, currency TEXT, amount REAL, status TEXT, paid_at TEXT);
    CREATE TABLE stripe_events(id TEXT, type TEXT, livemode INTEGER, received_at TEXT);`);
  return { db, run: key => db.prepare(metricsSql[key]).all(...(metricsSql[key].includes('?3') ? [window.start,window.end,window.previous] : [window.start,window.end])) };
}
test('UTC complete days and safe default, no fabricated percentage', () => {
  assert.equal(window.start, '2026-09-02T00:00:00.000Z'); assert.equal(window.end,'2026-09-09T00:00:00.000Z');
  assert.equal(reportingWindow('invalid').days,30); assert.equal(ratio(0,0),'—');
});
test('all SQL contracts execute on empty database', () => {
  const {db,run} = fixture();
  for (const key of Object.keys(metricsSql)) assert.ok(Array.isArray(run(key)));
  for (const sql of Object.values(healthSql)) assert.ok(Array.isArray(db.prepare(sql).all()));
  db.close();
});
test('source health reads the latest usage and Stripe ledger events', () => {
  const {db} = fixture();
  db.exec(`INSERT INTO usage_events(actor_hash,created_at,operation) VALUES ('a','2026-09-03T12:00:00Z','analyze'),('b','2026-09-05T12:00:00Z','analyze');
    INSERT INTO stripe_events VALUES ('evt_1','invoice.paid',1,'2026-09-04T12:00:00Z'),('evt_2','customer.updated',1,'2026-09-06T12:00:00Z');`);
  assert.equal(db.prepare(healthSql.lastEvent).get().last, '2026-09-05T12:00:00Z');
  assert.equal(db.prepare(healthSql.lastStripeEvent).get().last, '2026-09-06T12:00:00Z');
  db.close();
});
test('reviewers exclude deleted, monitoring and today; retention uses prior denominator', () => {
  const {db,run} = fixture();
  db.exec(`INSERT INTO scans(user_id,created_at) VALUES ('a','2026-08-30T12:00:00Z'),('a','2026-09-02T12:00:00Z'),('b','2026-09-08T12:00:00Z'),('c','2026-09-09T12:00:00Z');
    INSERT INTO scans(user_id,created_at,is_deleted,is_monitoring_scan) VALUES ('d','2026-09-03T12:00:00Z',1,0),('e','2026-09-03T12:00:00Z',0,1);`);
  assert.deepEqual({...run('reviewers')[0]}, {active:2,previous_active:1,retained:1}); assert.equal(run('scans')[0].completed,2); db.close();
});
test('activation gives every eligible account seven days and excludes late scans', () => {
  const {db,run} = fixture(); db.exec(`INSERT INTO users VALUES ('a','2026-08-27T12:00:00Z','active'),('b','2026-08-28T12:00:00Z',NULL),('young','2026-09-05T12:00:00Z',NULL);
    INSERT INTO scans(user_id,created_at) VALUES ('a','2026-08-29T12:00:00Z'),('b','2026-09-05T12:00:00Z'),('young','2026-09-06T12:00:00Z');`);
  assert.deepEqual({...run('activation')[0]}, {eligible:2,activated:1}); db.close();
});
test('checkout must follow same actor paywall, replays excluded from reliability', () => {
  const {db,run} = fixture(); db.exec(`INSERT INTO usage_events(actor_hash,created_at,operation) VALUES ('a','2026-09-03T12:00:00Z','paywall_view'),('a','2026-09-04T12:00:00Z','checkout_start'),('b','2026-09-02T12:00:00Z','checkout_start'),('b','2026-09-03T12:00:00Z','paywall_view'),('c','2026-09-04T12:00:00Z','checkout_start');
    INSERT INTO usage_events(actor_hash,created_at,operation,outcome) VALUES ('a','2026-09-04T12:00:00Z','analyze','idempotent_replay');`);
  assert.equal(run('handoff')[0].converted,1); assert.equal(run('channels').length,0); db.close();
});
test('collections aggregate beyond 50 records and separate currencies and refunds', () => {
  const {db,run} = fixture(); const insert=db.prepare('INSERT INTO invoices VALUES (?, ?, ?, ?, ?, ?)');
  for(let i=0;i<75;i++) insert.run(String(i),'a','usd',10,'paid','2026-09-03T12:00:00Z');
  insert.run('cad','b','cad',25,'paid','2026-09-03T12:00:00Z'); insert.run('refund','b','usd',90,'refunded','2026-09-03T12:00:00Z');
  assert.equal(run('revenue').find(r=>r.currency==='usd').amount,750); assert.equal(run('revenue').length,2); assert.equal(run('invoices').length,12); db.close();
});
test('p95 nearest rank ignores historical events without timings and string timings', () => {
  const {db,run} = fixture(); const insert=db.prepare("INSERT INTO usage_events(actor_hash,created_at,operation,metadata) VALUES ('a','2026-09-03T12:00:00Z','analyze',?)");
  for(let i=1;i<=20;i++) insert.run(JSON.stringify({duration_ms:i*100})); insert.run('{}'); insert.run('{"duration_ms":"999999"}');
  assert.deepEqual({...run('latency')[0]},{samples:20,p95_ms:1900}); db.close();
});
