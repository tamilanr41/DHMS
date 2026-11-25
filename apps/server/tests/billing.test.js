import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { closeDatabase, createPatient, getApp, loginAs } from './helpers/testDb.js';

const app = await getApp();

test.after(async () => {
  await closeDatabase();
});

const auth = (session) => ({ Authorization: `Bearer ${session.accessToken}` });

let admin;
let dentist;
let receptionist;
let patient;
let invoice;

test.before(async () => {
  admin = await loginAs('admin', 'Admin@Test123');
  dentist = await loginAs('dr.test');
  receptionist = await loginAs('reception.test');
  patient = await createPatient(app, admin.accessToken, { fullName: 'Billing Patient', mobile: '9845111001' });
});

test('warns about duplicate patients until explicitly confirmed', async () => {
  const dup = await request(app)
    .post('/api/patients')
    .set(auth(admin))
    .send({ fullName: 'Billing Patient', mobile: '9845111001' });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'POSSIBLE_DUPLICATE');
  assert.ok(dup.body.error.details.duplicates.length >= 1);

  const confirmed = await request(app)
    .post('/api/patients')
    .set(auth(admin))
    .send({ fullName: 'Billing Patient', mobile: '9845111001', confirmDuplicate: true });
  assert.equal(confirmed.status, 201);
  assert.notEqual(confirmed.body.data.id, patient.id);
});

test('rejects discounts from users without clinical authorization', async () => {
  const res = await request(app)
    .post('/api/invoices')
    .set(auth(receptionist))
    .send({
      patientId: patient.id,
      taxPercent: 0,
      items: [{ description: 'Scaling', quantity: 1, unitPrice: 1200, discount: 100 }]
    });
  assert.equal(res.status, 403);
});

test('creates a draft invoice with exact server-side totals', async () => {
  const res = await request(app)
    .post('/api/invoices')
    .set(auth(dentist))
    .send({
      patientId: patient.id,
      taxPercent: 18,
      items: [
        { description: 'Consultation', quantity: 1, unitPrice: 300 },
        { description: 'Scaling & Polishing', quantity: 1, unitPrice: 1200, discount: 100 }
      ]
    });
  assert.equal(res.status, 201);
  invoice = res.body.data;
  assert.equal(invoice.status, 'draft');
  assert.equal(invoice.subtotal, '1500.00');
  assert.equal(invoice.discountTotal, '100.00');
  assert.equal(invoice.taxTotal, '252.00');
  assert.equal(invoice.total, '1652.00');
  assert.equal(invoice.outstanding, '1652.00');
  assert.equal(invoice.items.length, 2);
  assert.equal(invoice.items[1].lineTotal, '1100.00');
});

test('blocks payments on drafts and edits after finalization', async () => {
  const early = await request(app)
    .post('/api/payments')
    .set(auth(receptionist))
    .send({ invoiceId: invoice.id, amount: 100, method: 'cash', idempotencyKey: 'draft-payment-key' });
  assert.equal(early.status, 409);

  const patch = await request(app)
    .patch(`/api/invoices/${invoice.id}`)
    .set(auth(dentist))
    .send({ taxPercent: 0 });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.data.total, '1400.00');
  assert.equal(patch.body.data.taxTotal, '0.00');

  const finalize = await request(app).post(`/api/invoices/${invoice.id}/finalize`).set(auth(dentist));
  assert.equal(finalize.status, 200);
  assert.equal(finalize.body.data.status, 'issued');

  const again = await request(app).post(`/api/invoices/${invoice.id}/finalize`).set(auth(dentist));
  assert.equal(again.status, 409);

  const edit = await request(app)
    .patch(`/api/invoices/${invoice.id}`)
    .set(auth(dentist))
    .send({ notes: 'late edit' });
  assert.equal(edit.status, 409);

  const remove = await request(app).delete(`/api/invoices/${invoice.id}`).set(auth(dentist));
  assert.equal(remove.status, 409);
});

test('applies partial payments, reuses idempotency keys and prevents overpayment', async () => {
  const first = await request(app)
    .post('/api/payments')
    .set(auth(receptionist))
    .send({ invoiceId: invoice.id, amount: 1000, method: 'upi', transactionRef: 'UPI-1', idempotencyKey: 'billing-key-0001' });
  assert.equal(first.status, 201);

  const replay = await request(app)
    .post('/api/payments')
    .set(auth(receptionist))
    .send({ invoiceId: invoice.id, amount: 900, method: 'cash', transactionRef: 'DIFFERENT', idempotencyKey: 'billing-key-0001' });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.meta.idempotentReplay, true);
  assert.equal(replay.body.data.id, first.body.data.id);

  let current = await request(app).get(`/api/invoices/${invoice.id}`).set(auth(receptionist));
  assert.equal(current.body.data.amountPaid, '1000.00');
  assert.equal(current.body.data.outstanding, '400.00');
  assert.equal(current.body.data.status, 'partially_paid');
  assert.equal(current.body.data.payments.length, 1);

  const over = await request(app)
    .post('/api/payments')
    .set(auth(receptionist))
    .send({ invoiceId: invoice.id, amount: 400.01, method: 'cash', idempotencyKey: 'billing-key-0002' });
  assert.equal(over.status, 422);
  assert.match(over.body.error.message, /exceeds the outstanding balance/);

  const close = await request(app)
    .post('/api/payments')
    .set(auth(receptionist))
    .send({ invoiceId: invoice.id, amount: 400, method: 'cash', idempotencyKey: 'billing-key-0003' });
  assert.equal(close.status, 201);

  current = await request(app).get(`/api/invoices/${invoice.id}`).set(auth(receptionist));
  assert.equal(current.body.data.status, 'paid');
  assert.equal(current.body.data.outstanding, '0.00');
});

test('issues refunds, reopens the balance and refuses to void paid invoices', async () => {
  const refund = await request(app)
    .post('/api/refunds')
    .set(auth(admin))
    .send({ invoiceId: invoice.id, amount: 50, method: 'cash', reason: 'Treatment adjusted', idempotencyKey: 'refund-key-0001' });
  assert.equal(refund.status, 201);

  const replay = await request(app)
    .post('/api/refunds')
    .set(auth(admin))
    .send({ invoiceId: invoice.id, amount: 50, method: 'cash', reason: 'Treatment adjusted', idempotencyKey: 'refund-key-0001' });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.meta.idempotentReplay, true);

  let current = await request(app).get(`/api/invoices/${invoice.id}`).set(auth(admin));
  assert.equal(current.body.data.amountPaid, '1350.00');
  assert.equal(current.body.data.outstanding, '50.00');
  assert.equal(current.body.data.status, 'partially_paid');

  const tooMuch = await request(app)
    .post('/api/refunds')
    .set(auth(admin))
    .send({ invoiceId: invoice.id, amount: 1400, method: 'cash', reason: 'Too much', idempotencyKey: 'refund-key-0002' });
  assert.equal(tooMuch.status, 422);
  assert.match(tooMuch.body.error.message, /exceeds the collected amount/);

  const voidPaid = await request(app)
    .post(`/api/invoices/${invoice.id}/void`)
    .set(auth(admin))
    .send({ reason: 'Duplicate entry' });
  assert.equal(voidPaid.status, 409);
  assert.match(voidPaid.body.error.message, /Refund the payments before voiding/);

  const settle = await request(app)
    .post('/api/payments')
    .set(auth(receptionist))
    .send({ invoiceId: invoice.id, amount: 50, method: 'cash', idempotencyKey: 'billing-key-0004' });
  assert.equal(settle.status, 201);

  current = await request(app).get(`/api/invoices/${invoice.id}`).set(auth(admin));
  assert.equal(current.body.data.status, 'paid');
});

test('voids an unpaid invoice and refuses further payments', async () => {
  const created = await request(app)
    .post('/api/invoices')
    .set(auth(receptionist))
    .send({
      patientId: patient.id,
      taxPercent: 0,
      items: [{ description: 'Wrong entry', quantity: 1, unitPrice: 250 }]
    });
  assert.equal(created.status, 201);
  const id = created.body.data.id;

  const finalized = await request(app).post(`/api/invoices/${id}/finalize`).set(auth(receptionist));
  assert.equal(finalized.status, 200);

  const voided = await request(app)
    .post(`/api/invoices/${id}/void`)
    .set(auth(receptionist))
    .send({ reason: 'Raised in error' });
  assert.equal(voided.status, 200);
  assert.equal(voided.body.data.status, 'void');
  assert.equal(voided.body.data.outstanding, '0.00');

  const pay = await request(app)
    .post('/api/payments')
    .set(auth(receptionist))
    .send({ invoiceId: id, amount: 10, method: 'cash', idempotencyKey: 'void-payment-key' });
  assert.equal(pay.status, 409);

  const draft = await request(app)
    .post('/api/invoices')
    .set(auth(receptionist))
    .send({
      patientId: patient.id,
      taxPercent: 0,
      items: [{ description: 'Temporary', quantity: 1, unitPrice: 99 }]
    });
  const deleted = await request(app).delete(`/api/invoices/${draft.body.data.id}`).set(auth(receptionist));
  assert.equal(deleted.status, 200);

  const gone = await request(app).get(`/api/invoices/${draft.body.data.id}`).set(auth(receptionist));
  assert.equal(gone.status, 404);
});

test('rounds money with the database NUMERIC type, never floating point', async () => {
  const res = await request(app)
    .post('/api/invoices')
    .set(auth(dentist))
    .send({
      patientId: patient.id,
      taxPercent: 18,
      items: [
        { description: 'Line A', quantity: 3, unitPrice: 0.1 },
        { description: 'Line B', quantity: 1, unitPrice: 0.2 }
      ]
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.subtotal, '0.50');
  assert.equal(res.body.data.taxTotal, '0.09');
  assert.equal(res.body.data.total, '0.59');
});
