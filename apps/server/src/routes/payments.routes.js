import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate } from '../utils/validate.js';
import { formatIndian, fromPaise, toPaise } from '../utils/money.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { logAudit } from '../services/audit.service.js';
import { recalcInvoice } from '../services/invoice.service.js';
import { getClinic } from '../services/clinic.service.js';
import { streamPaymentReceipt } from '../services/pdf.service.js';

const router = Router();
router.use(authenticate);

const paymentSchema = z.object({
  invoiceId: z.string().uuid('Select an invoice'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  method: z.string().trim().min(1, 'Select a payment method').max(50),
  transactionRef: z.string().trim().max(100).nullable().optional(),
  paymentDate: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(100)
});

router.get('/', requirePermission('payments.view'), asyncHandler(async (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (req.user?.clinicId) {
    params.push(req.user.clinicId);
    where.push(`(p.clinic_id = $${params.length} OR i.clinic_id = $${params.length} OR pt.clinic_id = $${params.length})`);
  }
  if (req.query.patientId) {
    params.push(req.query.patientId);
    where.push(`p.patient_id = $${params.length}`);
  }
  if (req.query.invoiceId) {
    params.push(req.query.invoiceId);
    where.push(`p.invoice_id = $${params.length}`);
  }
  if (req.query.method) {
    params.push(req.query.method);
    where.push(`p.method = $${params.length}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.startDate || '')) {
    params.push(req.query.startDate);
    where.push(`p.payment_date >= $${params.length}::date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate || '')) {
    params.push(req.query.endDate);
    where.push(`p.payment_date < ($${params.length}::date + interval '1 day')`);
  }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(p.payment_no ILIKE $${params.length} OR i.invoice_no ILIKE $${params.length} OR pt.full_name ILIKE $${params.length})`);
  }
  const limit = Math.min(300, Number.parseInt(req.query.pageSize, 10) || 100);
  params.push(limit);
  const { rows } = await query(
    `SELECT p.*, i.invoice_no, pt.full_name AS patient_name, pt.patient_no, u.full_name AS recorded_by_name
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     JOIN patients pt ON pt.id = p.patient_id
     LEFT JOIN users u ON u.id = p.recorded_by
     WHERE ${where.join(' AND ')}
     ORDER BY p.payment_date DESC LIMIT $${params.length}`,
    params
  );
  res.json({ data: rows.map(mapPayment) });
}));

router.post('/', requirePermission('payments.manage'), asyncHandler(async (req, res) => {
  const body = validate(paymentSchema, req.body);

  const existing = await query('SELECT id FROM payments WHERE idempotency_key = $1', [body.idempotencyKey]);
  if (existing.rows[0]) {
    const { rows } = await query('SELECT * FROM payments WHERE id = $1', [existing.rows[0].id]);
    return res.status(200).json({ data: mapPayment(rows[0]), meta: { idempotentReplay: true } });
  }

  const payment = await withTransaction(async (client) => {
    const { rows: invRows } = await client.query(
      `SELECT * FROM invoices WHERE id = $1 ${req.user?.clinicId ? 'AND clinic_id = $2' : ''} FOR UPDATE`,
      req.user?.clinicId ? [body.invoiceId, req.user.clinicId] : [body.invoiceId]
    );
    const invoice = invRows[0];
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === 'draft') throw ApiError.conflict('Finalize the invoice before collecting payment');
    if (invoice.status === 'void') throw ApiError.conflict('Cannot collect payment against a void invoice');
    if (invoice.status === 'paid') throw ApiError.conflict('This invoice is already fully paid');

    const amount = toPaise(body.amount);
    const outstanding = toPaise(invoice.outstanding_balance);
    if (amount > outstanding) {
      throw ApiError.unprocessable(`Amount exceeds the outstanding balance of ₹${formatIndian(invoice.outstanding_balance)}`);
    }

    const { rows: seq } = await client.query(`SELECT nextval('seq_payment') AS n`);
    const paymentNo = `PAY-${String(seq[0].n).padStart(6, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO payments (payment_no, invoice_id, patient_id, amount, method, transaction_ref,
         payment_date, recorded_by, notes, idempotency_key, clinic_id)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz, now()),$8,$9,$10,$11) RETURNING *`,
      [paymentNo, invoice.id, invoice.patient_id, fromPaise(amount), body.method, body.transactionRef || null, body.paymentDate || null, req.user.id, body.notes || null, body.idempotencyKey, req.user?.clinicId || null]
    );
    await recalcInvoice(client, invoice.id);
    return rows[0];
  });

  await logAudit(null, req, {
    action: 'payment.collected',
    entityType: 'payment',
    entityId: payment.id,
    details: { paymentNo: payment.payment_no, invoiceId: body.invoiceId, amount: payment.amount, method: payment.method, clinicId: req.user?.clinicId }
  });
  res.status(201).json({ data: mapPayment(payment) });
}));

router.get('/status/:key', requirePermission('payments.view'), asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM payments WHERE idempotency_key = $1', [String(req.params.key)]);
  res.json({ data: rows[0] ? mapPayment(rows[0]) : null });
}));

router.get('/:id/receipt.pdf', requirePermission('payments.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Payment');
  const { rows } = await query(
    `SELECT p.*, i.invoice_no, pt.full_name AS patient_name, pt.patient_no, pt.mobile,
            u.full_name AS recorded_by_name
     FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN patients pt ON pt.id = p.patient_id
     LEFT JOIN users u ON u.id = p.recorded_by WHERE p.id = $1 ${req.user?.clinicId ? 'AND (p.clinic_id = $2 OR i.clinic_id = $2)' : ''}`,
    req.user?.clinicId ? [id, req.user.clinicId] : [id]
  );
  if (!rows[0]) throw ApiError.notFound('Payment not found');
  await streamPaymentReceipt({ payment: mapPayment(rows[0]), clinic: await getClinic() }, res);
  await logAudit(null, req, { action: 'payment.receipt_printed', entityType: 'payment', entityId: id, details: { clinicId: req.user?.clinicId } });
}));

router.post('/:id/void', requirePermission('refunds.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Payment');
  const { reason } = validate(z.object({ reason: z.string().trim().min(3, 'Reason is required').max(500) }), req.body);

  const payment = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM payments WHERE id = $1 ${req.user?.clinicId ? 'AND clinic_id = $2' : ''} FOR UPDATE`,
      req.user?.clinicId ? [id, req.user.clinicId] : [id]
    );
    const p = rows[0];
    if (!p) throw ApiError.notFound('Payment not found');
    if (p.status === 'void') throw ApiError.conflict('Payment is already void');
    const { rows: rf } = await client.query('SELECT 1 FROM refunds WHERE payment_id = $1 LIMIT 1', [id]);
    if (rf.length) throw ApiError.conflict('This payment has refunds recorded against it');
    const { rows: upd } = await client.query(
      `UPDATE payments SET status = 'void', voided_at = now(), voided_by = $2, void_reason = $3 WHERE id = $1 RETURNING *`,
      [id, req.user.id, reason]
    );
    await recalcInvoice(client, p.invoice_id);
    return upd[0];
  });

  await logAudit(null, req, { action: 'payment.voided', entityType: 'payment', entityId: id, details: { reason, amount: payment.amount } });
  res.json({ data: mapPayment(payment) });
}));

function mapPayment(r) {
  return {
    id: r.id,
    paymentNo: r.payment_no,
    invoiceId: r.invoice_id,
    invoiceNo: r.invoice_no,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientNo: r.patient_no,
    mobile: r.mobile,
    amount: r.amount,
    method: r.method,
    transactionRef: r.transaction_ref,
    paymentDate: r.payment_date,
    status: r.status,
    notes: r.notes,
    recordedByName: r.recorded_by_name
  };
}

export default router;
