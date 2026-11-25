import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate } from '../utils/validate.js';
import { formatIndian, fromPaise, toPaise } from '../utils/money.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { logAudit } from '../services/audit.service.js';
import { recalcInvoice } from '../services/invoice.service.js';

const router = Router();
router.use(authenticate);

const refundSchema = z.object({
  invoiceId: z.string().uuid('Select an invoice'),
  paymentId: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  method: z.string().trim().min(1).max(50),
  reason: z.string().trim().min(3, 'Reason is required').max(500),
  idempotencyKey: z.string().trim().min(8).max(100)
});

router.get('/', requirePermission('reports.financial'), asyncHandler(async (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.startDate || '')) {
    params.push(req.query.startDate);
    where.push(`r.refunded_at >= $${params.length}::date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate || '')) {
    params.push(req.query.endDate);
    where.push(`r.refunded_at < ($${params.length}::date + interval '1 day')`);
  }
  if (req.query.patientId) {
    params.push(req.query.patientId);
    where.push(`r.patient_id = $${params.length}`);
  }
  const limit = Math.min(300, Number.parseInt(req.query.pageSize, 10) || 100);
  params.push(limit);
  const { rows } = await query(
    `SELECT r.*, i.invoice_no, p.payment_no, pt.full_name AS patient_name, pt.patient_no,
            u.full_name AS refunded_by_name
     FROM refunds r
     JOIN invoices i ON i.id = r.invoice_id
     JOIN patients pt ON pt.id = r.patient_id
     LEFT JOIN payments p ON p.id = r.payment_id
     LEFT JOIN users u ON u.id = r.refunded_by
     WHERE ${where.join(' AND ')}
     ORDER BY r.refunded_at DESC LIMIT $${params.length}`,
    params
  );
  res.json({ data: rows.map(mapRefund) });
}));

router.post('/', requirePermission('refunds.manage'), asyncHandler(async (req, res) => {
  const body = validate(refundSchema, req.body);

  const existing = await query('SELECT id FROM refunds WHERE idempotency_key = $1', [body.idempotencyKey]);
  if (existing.rows[0]) {
    const { rows } = await query('SELECT * FROM refunds WHERE id = $1', [existing.rows[0].id]);
    return res.status(200).json({ data: mapRefund(rows[0]), meta: { idempotentReplay: true } });
  }

  const refund = await withTransaction(async (client) => {
    const { rows: invRows } = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [body.invoiceId]);
    const invoice = invRows[0];
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === 'draft') throw ApiError.conflict('Cannot refund a draft invoice');

    if (body.paymentId) {
      const { rows: pay } = await client.query('SELECT * FROM payments WHERE id = $1 AND invoice_id = $2', [body.paymentId, invoice.id]);
      if (!pay[0]) throw ApiError.badRequest('Payment does not belong to this invoice');
      if (pay[0].status !== 'completed') throw ApiError.conflict('Only completed payments can be refunded');
    }

    const amount = toPaise(body.amount);
    if (amount > toPaise(invoice.amount_paid)) {
      throw ApiError.unprocessable(`Refund exceeds the collected amount of ₹${formatIndian(invoice.amount_paid)}`);
    }

    const { rows: seq } = await client.query(`SELECT nextval('seq_refund') AS n`);
    const refundNo = `REF-${String(seq[0].n).padStart(6, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO refunds (refund_no, invoice_id, payment_id, patient_id, amount, method, reason, refunded_by, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [refundNo, invoice.id, body.paymentId || null, invoice.patient_id, fromPaise(amount), body.method, body.reason, req.user.id, body.idempotencyKey]
    );
    await recalcInvoice(client, invoice.id);
    return rows[0];
  });

  await logAudit(null, req, {
    action: 'refund.issued',
    entityType: 'refund',
    entityId: refund.id,
    details: { refundNo: refund.refund_no, invoiceId: body.invoiceId, amount: refund.amount, reason: body.reason }
  });
  res.status(201).json({ data: mapRefund(refund) });
}));

function mapRefund(r) {
  return {
    id: r.id,
    refundNo: r.refund_no,
    invoiceId: r.invoice_id,
    invoiceNo: r.invoice_no,
    paymentId: r.payment_id,
    paymentNo: r.payment_no,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientNo: r.patient_no,
    amount: r.amount,
    method: r.method,
    reason: r.reason,
    refundedAt: r.refunded_at,
    refundedByName: r.refunded_by_name
  };
}

export default router;
