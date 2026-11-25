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

const router = Router();
router.use(authenticate);

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function mapCredit(r) {
  const amount = toPaise(r.amount);
  const used = toPaise(r.used_amount);
  return {
    id: r.id,
    creditNo: r.credit_no,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientNo: r.patient_no,
    amount: r.amount,
    usedAmount: r.used_amount,
    available: fromPaise(amount - used),
    method: r.method,
    transactionRef: r.transaction_ref,
    receivedAt: r.received_at,
    notes: r.notes,
    status: r.status,
    recordedByName: r.recorded_by_name,
    voidReason: r.void_reason,
    createdAt: r.created_at
  };
}

router.get('/', requirePermission('payments.view'), asyncHandler(async (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (req.query.patientId) {
    params.push(req.query.patientId);
    where.push(`c.patient_id = $${params.length}`);
  }
  if (req.query.status) {
    params.push(req.query.status);
    where.push(`c.status = $${params.length}`);
  }
  if (!req.query.includeVoid) where.push(`c.status <> 'void'`);
  params.push(Math.min(300, Number.parseInt(req.query.pageSize, 10) || 100));
  const { rows } = await query(
    `SELECT c.*, p.full_name AS patient_name, p.patient_no, u.full_name AS recorded_by_name
     FROM patient_credits c
     JOIN patients p ON p.id = c.patient_id
     LEFT JOIN users u ON u.id = c.recorded_by
     WHERE ${where.join(' AND ')}
     ORDER BY c.received_at DESC LIMIT $${params.length}`,
    params
  );

  const summary = req.query.patientId
    ? await query(
        `SELECT COALESCE(sum(amount - used_amount) FILTER (WHERE status IN ('available','partially_used')), 0) AS available,
                COALESCE(sum(amount) FILTER (WHERE status <> 'void'), 0) AS received,
                COALESCE(sum(used_amount), 0) AS used
         FROM patient_credits WHERE patient_id = $1`,
        [req.query.patientId]
      )
    : { rows: [{ available: '0', received: '0', used: '0' }] };

  res.json({
    data: rows.map(mapCredit),
    meta: {
      available: summary.rows[0].available,
      received: summary.rows[0].received,
      used: summary.rows[0].used
    }
  });
}));

const creditSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  amount: z.coerce.number().positive('Amount must be greater than zero').max(100000000),
  method: z.string().trim().min(1, 'Select a payment method').max(50),
  transactionRef: z.string().trim().max(100).nullable().optional(),
  receivedAt: z.string().regex(DATE).nullable().optional().or(z.literal('')),
  notes: z.string().trim().max(500).nullable().optional(),
  idempotencyKey: z.string().trim().max(100).nullable().optional()
});

router.post('/', requirePermission('payments.manage'), asyncHandler(async (req, res) => {
  const body = validate(creditSchema, req.body);
  const patient = await query('SELECT 1 FROM patients WHERE id = $1', [body.patientId]);
  if (!patient.rowCount) throw ApiError.notFound('Patient not found');

  if (body.idempotencyKey) {
    const existing = await query('SELECT id FROM patient_credits WHERE idempotency_key = $1', [body.idempotencyKey]);
    if (existing.rows[0]) {
      const { rows } = await query('SELECT * FROM patient_credits WHERE id = $1', [existing.rows[0].id]);
      return res.status(200).json({ data: mapCredit(rows[0]), meta: { idempotentReplay: true } });
    }
  }

  const credit = await withTransaction(async (client) => {
    const { rows: seq } = await client.query(`SELECT nextval('seq_credit') AS n`);
    const creditNo = `ADV-${String(seq[0].n).padStart(6, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO patient_credits (credit_no, patient_id, amount, method, transaction_ref, received_at,
         notes, idempotency_key, recorded_by)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,$8,$9) RETURNING *`,
      [creditNo, body.patientId, fromPaise(toPaise(body.amount)), body.method, body.transactionRef || null,
        body.receivedAt || null, body.notes || null, body.idempotencyKey || null, req.user.id]
    );
    return rows[0];
  });

  await logAudit(null, req, {
    action: 'patient.advance_received',
    entityType: 'patient_credit',
    entityId: credit.id,
    details: { creditNo: credit.credit_no, patientId: body.patientId, amount: credit.amount, method: credit.method }
  });
  const { rows } = await query(
    `SELECT c.*, p.full_name AS patient_name, p.patient_no, u.full_name AS recorded_by_name
     FROM patient_credits c JOIN patients p ON p.id = c.patient_id
     LEFT JOIN users u ON u.id = c.recorded_by WHERE c.id = $1`,
    [credit.id]
  );
  res.status(201).json({ data: mapCredit(rows[0]) });
}));

router.post('/:id/void', requirePermission('refunds.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient advance');
  const { reason } = validate(z.object({ reason: z.string().trim().min(3, 'Reason is required').max(500) }), req.body);

  const credit = await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM patient_credits WHERE id = $1 FOR UPDATE', [id]);
    const c = rows[0];
    if (!c) throw ApiError.notFound('Advance payment not found');
    if (c.status === 'void') throw ApiError.conflict('This advance is already void');
    if (toPaise(c.used_amount) > 0n) {
      throw ApiError.conflict('This advance has already been applied to invoices and cannot be voided');
    }
    const { rows: upd } = await client.query(
      `UPDATE patient_credits SET status = 'void', voided_at = now(), voided_by = $2, void_reason = $3
       WHERE id = $1 RETURNING *`,
      [id, req.user.id, reason]
    );
    return upd[0];
  });
  await logAudit(null, req, { action: 'patient.advance_voided', entityType: 'patient_credit', entityId: id, details: { reason, creditNo: credit.credit_no } });
  res.json({ data: mapCredit(credit) });
}));

const applySchema = z.object({
  invoiceId: z.string().uuid('Select an invoice'),
  creditId: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().positive().nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(100).optional()
});

router.post('/apply', requirePermission('payments.manage'), asyncHandler(async (req, res) => {
  const body = validate(applySchema, req.body);

  if (body.idempotencyKey) {
    const existing = await query(
      `SELECT p.* FROM payments p WHERE p.idempotency_key = $1`,
      [body.idempotencyKey]
    );
    if (existing.rows[0]) {
      return res.status(200).json({ data: { payments: [mapAppliedPayment(existing.rows[0])], applied: existing.rows[0].amount }, meta: { idempotentReplay: true } });
    }
  }

  const result = await withTransaction(async (client) => {
    const { rows: invRows } = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [body.invoiceId]);
    const invoice = invRows[0];
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === 'draft') throw ApiError.conflict('Finalize the invoice before applying an advance');
    if (invoice.status === 'void') throw ApiError.conflict('Cannot apply an advance to a void invoice');
    if (['paid', 'written_off'].includes(invoice.status) || toPaise(invoice.outstanding_balance) <= 0n) {
      throw ApiError.conflict('This invoice has no outstanding balance');
    }

    const { rows: creditRows } = await client.query(
      `SELECT * FROM patient_credits
       WHERE patient_id = $1 AND status IN ('available','partially_used')
         AND ($2::uuid IS NULL OR id = $2)
       ORDER BY received_at, created_at FOR UPDATE`,
      [invoice.patient_id, body.creditId || null]
    );
    if (!creditRows.length) throw ApiError.conflict('No advance balance is available for this patient');

    let remaining = toPaise(invoice.outstanding_balance);
    if (body.amount) {
      const requested = toPaise(body.amount);
      if (requested > remaining) {
        throw ApiError.unprocessable(`Amount exceeds the outstanding balance of ₹${formatIndian(invoice.outstanding_balance)}`);
      }
      remaining = requested;
    }

    const payments = [];
    const allocations = [];
    for (const credit of creditRows) {
      if (remaining <= 0n) break;
      const available = toPaise(credit.amount) - toPaise(credit.used_amount);
      if (available <= 0n) continue;
      const take = available < remaining ? available : remaining;
      const { rows: seq } = await client.query(`SELECT nextval('seq_payment') AS n`);
      const paymentNo = `PAY-${String(seq[0].n).padStart(6, '0')}`;
      const ref = `${credit.credit_no}${body.idempotencyKey ? `:${body.idempotencyKey}` : ''}`.slice(0, 100);
      const { rows } = await client.query(
        `INSERT INTO payments (payment_no, invoice_id, patient_id, amount, method, transaction_ref,
           payment_date, recorded_by, notes, idempotency_key)
         VALUES ($1,$2,$3,$4,'advance',$5, now(), $6, $7, $8) RETURNING *`,
        [paymentNo, invoice.id, invoice.patient_id, fromPaise(take), ref, req.user.id,
          `Advance ${credit.credit_no} applied`, body.idempotencyKey || null]
      );
      const newUsed = toPaise(credit.used_amount) + take;
      await client.query(
        `UPDATE patient_credits SET used_amount = $2,
           status = CASE WHEN $2 >= amount THEN 'used' ELSE 'partially_used' END
         WHERE id = $1`,
        [credit.id, fromPaise(newUsed)]
      );
      await client.query(
        `INSERT INTO patient_credit_applications (credit_id, invoice_id, payment_id, amount, applied_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [credit.id, invoice.id, rows[0].id, fromPaise(take), req.user.id]
      );
      payments.push(rows[0]);
      allocations.push({ creditId: credit.id, creditNo: credit.credit_no, amount: fromPaise(take) });
      remaining -= take;
    }

    await recalcInvoice(client, invoice.id);
    return { payments, allocations, invoiceId: invoice.id, applied: fromPaise(payments.reduce((s, p) => s + toPaise(p.amount), 0n)) };
  });

  await logAudit(null, req, {
    action: 'patient.advance_applied',
    entityType: 'invoice',
    entityId: result.invoiceId,
    details: { applied: result.applied, credits: result.allocations, paymentIds: result.payments.map((p) => p.id) }
  });
  res.status(201).json({ data: { ...result, payments: result.payments.map(mapAppliedPayment) } });
}));

function mapAppliedPayment(r) {
  return {
    id: r.id,
    paymentNo: r.payment_no,
    invoiceId: r.invoice_id,
    patientId: r.patient_id,
    amount: r.amount,
    method: r.method,
    transactionRef: r.transaction_ref,
    paymentDate: r.payment_date,
    status: r.status,
    notes: r.notes
  };
}

export default router;
