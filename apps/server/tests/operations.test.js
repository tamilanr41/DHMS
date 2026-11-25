import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { closeDatabase, createPatient, getApp, getPool, loginAs } from './helpers/testDb.js';

const app = await getApp();

test.after(async () => {
  await closeDatabase();
});

const auth = (session) => ({ Authorization: `Bearer ${session.accessToken}` });
const binaryParser = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};
const today = new Date().toISOString().slice(0, 10);
const soonExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

let admin;
let dentist;
let assistant;
let patient;
let item;

test.before(async () => {
  admin = await loginAs('admin', 'Admin@Test123');
  dentist = await loginAs('dr.test');
  assistant = await loginAs('assistant.test');
  patient = await createPatient(app, admin.accessToken, { fullName: 'Operations Patient', mobile: '9845333003' });
});

test('tracks inventory movements and raises low-stock alerts', async () => {
  const created = await request(app)
    .post('/api/inventory/items')
    .set(auth(assistant))
    .send({
      name: 'Composite Resin A2',
      category: 'Restorative',
      unit: 'syringe',
      purchasePrice: 950.5,
      minStock: 5,
      batchNumber: 'CR-2026-01',
      expiryDate: soonExpiry
    });
  assert.equal(created.status, 201);
  item = created.body.data;
  assert.equal(item.quantity, '0.000');

  const purchase = await request(app)
    .post(`/api/inventory/items/${item.id}/movements`)
    .set(auth(assistant))
    .send({ type: 'purchase', quantity: 10, unitCost: 950.5, reference: 'PO-1001' });
  assert.equal(purchase.status, 201);
  assert.equal(purchase.body.data.balance_after, '10.000');

  const consumption = await request(app)
    .post(`/api/inventory/items/${item.id}/movements`)
    .set(auth(assistant))
    .send({ type: 'consumption', quantity: 7, notes: 'Used in OPD' });
  assert.equal(consumption.status, 201);
  assert.equal(consumption.body.data.balance_after, '3.000');

  const alerts = await request(app).get('/api/inventory/alerts').set(auth(assistant));
  assert.equal(alerts.status, 200);
  assert.ok(alerts.body.data.lowStock.some((i) => i.id === item.id));
  assert.ok(alerts.body.data.expiring.some((i) => i.id === item.id));

  const belowZero = await request(app)
    .post(`/api/inventory/items/${item.id}/movements`)
    .set(auth(assistant))
    .send({ type: 'consumption', quantity: 5 });
  assert.equal(belowZero.status, 422);

  const silentAdjustment = await request(app)
    .post(`/api/inventory/items/${item.id}/movements`)
    .set(auth(assistant))
    .send({ type: 'adjustment', quantity: 1 });
  assert.equal(silentAdjustment.status, 422);

  const adjustment = await request(app)
    .post(`/api/inventory/items/${item.id}/movements`)
    .set(auth(assistant))
    .send({ type: 'adjustment', quantity: -1, notes: 'Damaged syringe' });
  assert.equal(adjustment.status, 201);
  assert.equal(adjustment.body.data.balance_after, '2.000');

  const movements = await request(app).get(`/api/inventory/items/${item.id}/movements`).set(auth(assistant));
  assert.equal(movements.status, 200);
  assert.equal(movements.body.data.length, 3);

  const receptionistWrite = await request(app)
    .post('/api/inventory/items')
    .set(auth((await loginAs('reception.test'))))
    .send({ name: 'Blocked item', category: 'Other', unit: 'box', purchasePrice: 10 });
  assert.equal(receptionistWrite.status, 403);
});

test('builds treatment plans with server-calculated estimates', async () => {
  const created = await request(app)
    .post('/api/treatment-plans')
    .set(auth(dentist))
    .send({
      patientId: patient.id,
      notes: 'Restore quadrant 3',
      items: [
        { toothNumber: '36', treatmentName: 'Root Canal Treatment', unitPrice: 6000, quantity: 1, discount: 500 },
        { toothNumber: '36', treatmentName: 'Crown (Zirconia)', unitPrice: 8000, quantity: 1 }
      ]
    });
  assert.equal(created.status, 201);
  assert.match(created.body.data.planNo, /^TP-\d{6}$/);
  assert.equal(created.body.data.estimate, '13500.00');
  assert.equal(created.body.data.items.length, 2);

  const plan = created.body.data;
  const firstItem = plan.items[0];
  const completed = await request(app)
    .patch(`/api/treatment-plans/items/${firstItem.id}`)
    .set(auth(dentist))
    .send({ status: 'completed' });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.data.status, 'partially_completed');

  const secondItem = completed.body.data.items[1];
  const done = await request(app)
    .patch(`/api/treatment-plans/items/${secondItem.id}`)
    .set(auth(dentist))
    .send({ status: 'completed' });
  assert.equal(done.status, 200);
  assert.equal(done.body.data.status, 'completed');

  const cancel = await request(app)
    .patch(`/api/treatment-plans/items/${secondItem.id}`)
    .set(auth(dentist))
    .send({ status: 'cancelled' });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.data.estimate, '5500.00');
});

test('exports reports as JSON, CSV, Excel and PDF with the financial guard', async () => {
  const list = await request(app).get('/api/reports').set(auth(assistant));
  assert.equal(list.status, 200);
  const names = list.body.data.map((r) => r.name);
  assert.ok(names.includes('patients'));
  assert.ok(!names.includes('collections-daily'), 'assistant must not see financial reports');

  const json = await request(app)
    .get(`/api/reports/patients?startDate=${today}&endDate=${today}`)
    .set(auth(assistant));
  assert.equal(json.status, 200);
  assert.equal(json.body.data.rows[0].full_name, 'Operations Patient');
  assert.ok(json.body.meta.total >= 1);

  const csv = await request(app)
    .get(`/api/reports/patients?format=csv&startDate=${today}&endDate=${today}`)
    .set(auth(assistant));
  assert.equal(csv.status, 200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.ok(csv.text.startsWith('\ufeff'), 'CSV must carry a UTF-8 BOM for Excel');
  assert.match(csv.text, /Operations Patient/);

  const xlsx = await request(app)
    .get(`/api/reports/patients?format=xlsx&startDate=${today}&endDate=${today}`)
    .set(auth(assistant))
    .buffer(true)
    .parse(binaryParser);
  assert.equal(xlsx.status, 200);
  assert.match(xlsx.headers['content-type'], /spreadsheetml/);
  assert.ok(xlsx.body.length > 1000);

  const pdf = await request(app)
    .get(`/api/reports/patients?format=pdf&startDate=${today}&endDate=${today}`)
    .set(auth(assistant))
    .buffer(true)
    .parse(binaryParser);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers['content-type'], /application\/pdf/);
  assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');

  const financial = await request(app)
    .get(`/api/reports/collections-daily?startDate=${today}&endDate=${today}`)
    .set(auth(dentist));
  assert.equal(financial.status, 200);

  const unknown = await request(app).get('/api/reports/not-a-report').set(auth(admin));
  assert.equal(unknown.status, 404);
});

test('keeps the audit log append-only and reachable only by administrators', async () => {
  const list = await request(app).get('/api/audit-logs?pageSize=5').set(auth(admin));
  assert.equal(list.status, 200);
  assert.ok(list.body.data.length > 0);
  assert.ok(list.body.meta.total > 0);

  const actions = await request(app).get('/api/audit-logs/actions').set(auth(admin));
  assert.equal(actions.status, 200);
  assert.ok(actions.body.data.length > 0);

  const pool = await getPool();
  for (const sql of ['UPDATE audit_logs SET action = $1 WHERE id = (SELECT min(id) FROM audit_logs)', 'DELETE FROM audit_logs']) {
    await assert.rejects(
      () => pool.query(sql, sql.startsWith('UPDATE') ? ['tampered'] : []),
      /append-only/,
      'audit rows must not be mutable'
    );
  }
});

test('serves the dashboard and backup history to the right roles', async () => {
  const dashboard = await request(app).get('/api/dashboard').set(auth(dentist));
  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.body.data.stats);
  assert.equal(typeof dashboard.body.data.stats.collected, 'string');

  const receptionistDashboard = await request(app).get('/api/dashboard').set(auth(await loginAs('reception.test')));
  assert.equal(typeof receptionistDashboard.body.data.stats.collected, 'string', 'billing staff can read collections');

  const assistantDashboard = await request(app).get('/api/dashboard').set(auth(assistant));
  assert.equal(assistantDashboard.status, 200);
  assert.equal(assistantDashboard.body.data.stats.collected, null, 'assistants must not read collections');
  assert.equal(assistantDashboard.body.data.stats.outstanding, null);
  assert.equal(assistantDashboard.body.data.recentPayments.length, 0);
  assert.equal(assistantDashboard.body.data.monthlyCollection.length, 0);

  const assistantBackups = await request(app).get('/api/backups').set(auth(assistant));
  assert.equal(assistantBackups.status, 403);

  const backups = await request(app).get('/api/backups').set(auth(admin));
  assert.equal(backups.status, 200);
  assert.ok(Array.isArray(backups.body.data));
});
