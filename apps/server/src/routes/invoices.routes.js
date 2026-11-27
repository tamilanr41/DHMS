import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate } from '../utils/validate.js';
import { formatDecimal, fromPaise, toPaise } from '../utils/money.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { logAudit } from '../services/audit.service.js';
import { computeInvoiceTotals, invoiceLineTotal, recalcInvoice } from '../services/invoice.service.js';
import { getClinic } from '../services/clinic.service.js';
import { streamInvoice, streamReceipt } from '../services/pdf.service.js';

const router = Router();
router.use(authenticate);

const itemSchema = z.object({
  treatmentId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, 'Description is required').max(300),
  toothNumber: z.string().trim().max(3).nullable().optional(),
  quantity: z.coerce.number().positive('Quantity must be positive').max(1000),
  unitPrice: z.coerce.number().min(0, 'Price cannot be negative'),
  discount: z.coerce.number().min(0).default(0)
});

const invoiceSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  consultationId: z.string().uuid().nullable().optional(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  items: z.array(itemSchema).min(1, 'Add at least one line item'),
  finalize: z.boolean().optional()
});

router.get('/', requirePermission('invoices.view'), asyncHandler(async (req, res) => {
  const where = ['1=1'];
  const params = [];

  if (req.user?.clinicId) {
    params.push(req.user.clinicId);
    where.push(`i.clinic_id = $${params.length}`);
  }

  if (req.query.patientId) {
    params.push(req.query.patientId);
    where.push(`i.patient_id = $${params.length}`);
  }
  if (req.query.status) {
    params.push(req.query.status);
    where.push(`i.status = $${params.length}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.startDate || '')) {
    params.push(req.query.startDate);
    where.push(`i.invoice_date >= $${params.length}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate || '')) {
    params.push(req.query.endDate);
    where.push(`i.invoice_date <= $${params.length}`);
  }
  if (req.query.outstanding === 'true') where.push(`i.outstanding_balance > 0 AND i.status NOT IN ('void','draft')`);
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(i.invoice_no ILIKE $${params.length} OR p.full_name ILIKE $${params.length} OR p.mobile ILIKE $${params.length})`);
  }
  const limit = Math.min(300, Number.parseInt(req.query.pageSize, 10) || 100);
  params.push(limit);
  const { rows } = await query(
    `SELECT i.*, p.full_name AS patient_name, p.patient_no, p.mobile,
            (SELECT count(*) FROM invoice_items ii WHERE ii.invoice_id = i.id)::int AS item_count
     FROM invoices i JOIN patients p ON p.id = i.patient_id
     WHERE ${where.join(' AND ')}
     ORDER BY i.invoice_date DESC, i.created_at DESC LIMIT $${params.length}`,
    params
  );
  res.json({ data: rows.map(mapInvoice) });
}));

router.post('/', requirePermission('invoices.manage'), asyncHandler(async (req, res) => {
  const body = validate(invoiceSchema, req.body);
  const clinicId = req.user?.clinicId || null;
  const clinic = await getClinic(clinicId);
  const taxPercent = body.taxPercent !== undefined ? body.taxPercent : clinic.taxEnabled ? Number(clinic.taxPercent) : 0;

  if (body.items.some((i) => toPaise(i.discount) > 0n) && !['dentist', 'admin'].includes(req.user.role)) {
    throw ApiError.forbidden('Discounts require dentist or administrator authorization');
  }

  const patient = await query('SELECT 1 FROM patients WHERE id = $1', [body.patientId]);
  if (!patient.rowCount) throw ApiError.notFound('Patient not found');

  let totals;
  try {
    totals = computeInvoiceTotals(body.items, taxPercent);
  } catch (err) {
    throw ApiError.unprocessable(err.message);
  }

  const invoice = await withTransaction(async (client) => {
    const { rows: seq } = await client.query(`SELECT nextval('seq_invoice') AS n`);
    const no = `${clinic.invoicePrefix}-${new Date().getFullYear()}-${String(seq[0].n).padStart(5, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO invoices (invoice_no, patient_id, consultation_id, invoice_date, subtotal, discount_total,
         tax_percent, tax_total, total, outstanding_balance, status, notes, created_by,
         finalized_at, clinic_id)
       VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        no, body.patientId, body.consultationId || null, body.invoiceDate || null,
        totals.subtotal, totals.discountTotal, formatDecimal(taxPercent), totals.taxTotal,
        totals.total, totals.total,
        body.finalize ? 'issued' : 'draft', body.notes || null, req.user.id,
        body.finalize ? new Date() : null, clinicId
      ]
    );
    for (let idx = 0; idx < body.items.length; idx++) {
      const item = body.items[idx];
      const lineTotal = invoiceLineTotal(item.unitPrice, item.quantity, item.discount);
      await client.query(
        `INSERT INTO invoice_items (invoice_id, treatment_id, description, tooth_number, quantity, unit_price, discount, line_total, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [rows[0].id, item.treatmentId || null, item.description, item.toothNumber || null, item.quantity, item.unitPrice, item.discount || 0, lineTotal, idx]
      );
    }
    return rows[0];
  });

  await logAudit(null, req, {
    action: invoice.status === 'issued' ? 'invoice.finalized' : 'invoice.created',
    entityType: 'invoice',
    entityId: invoice.id,
    details: { invoiceNo: invoice.invoice_no, patientId: body.patientId, total: invoice.total }
  });
  res.status(201).json({ data: await getInvoiceDetail(invoice.id) });
}));

router.get('/:id', requirePermission('invoices.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Invoice');
  const invoice = await getInvoiceDetail(id, req.user?.clinicId);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  res.json({ data: invoice });
}));

const updateSchema = z.object({
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(itemSchema).min(1).optional(),
  taxPercent: z.coerce.number().min(0).max(100).optional()
});

router.patch('/:id', requirePermission('invoices.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Invoice');
  const body = validate(updateSchema, req.body);
  const { rows: cur } = await query('SELECT * FROM invoices WHERE id = $1', [id]);
  if (!cur[0]) throw ApiError.notFound('Invoice not found');
  if (cur[0].status !== 'draft') throw ApiError.conflict('Only draft invoices can be edited');

  await withTransaction(async (client) => {
    await client.query('SELECT id FROM invoices WHERE id = $1 FOR UPDATE', [id]);
    if (body.items) {
      if (body.items.some((i) => toPaise(i.discount) > 0n) && !['dentist', 'admin'].includes(req.user.role)) {
        throw ApiError.forbidden('Discounts require dentist or administrator authorization');
      }
      const taxPercent = body.taxPercent !== undefined ? body.taxPercent : cur[0].tax_percent;
      const totals = computeInvoiceTotals(body.items, taxPercent);
      await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);
      for (let idx = 0; idx < body.items.length; idx++) {
        const item = body.items[idx];
        const lineTotal = invoiceLineTotal(item.unitPrice, item.quantity, item.discount);
        await client.query(
          `INSERT INTO invoice_items (invoice_id, treatment_id, description, tooth_number, quantity, unit_price, discount, line_total, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [id, item.treatmentId || null, item.description, item.toothNumber || null, item.quantity, item.unitPrice, item.discount || 0, lineTotal, idx]
        );
      }
      await client.query(
        `UPDATE invoices SET subtotal = $2, discount_total = $3, tax_percent = $4, tax_total = $5, total = $6,
           outstanding_balance = $6, notes = COALESCE($7, notes) WHERE id = $1`,
        [id, totals.subtotal, totals.discountTotal, formatDecimal(taxPercent), totals.taxTotal, totals.total, body.notes ?? null]
      );
    } else if (body.taxPercent !== undefined) {
      const { rows: existingItems } = await client.query(
        'SELECT unit_price, quantity, discount FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order, id',
        [id]
      );
      const totals = computeInvoiceTotals(
        existingItems.map((i) => ({ unitPrice: i.unit_price, quantity: i.quantity, discount: i.discount })),
        body.taxPercent
      );
      await client.query(
        `UPDATE invoices SET subtotal = $2, discount_total = $3, tax_percent = $4, tax_total = $5,
           total = $6, outstanding_balance = $6, notes = COALESCE($7, notes) WHERE id = $1`,
        [id, totals.subtotal, totals.discountTotal, formatDecimal(body.taxPercent), totals.taxTotal, totals.total, body.notes ?? null]
      );
    } else if (body.notes !== undefined) {
      await client.query('UPDATE invoices SET notes = $2 WHERE id = $1', [id, body.notes]);
    }
  });
  await logAudit(null, req, { action: 'invoice.updated', entityType: 'invoice', entityId: id, details: { lines: body.items?.length } });
  res.json({ data: await getInvoiceDetail(id) });
}));

router.post('/:id/finalize', requirePermission('invoices.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Invoice');
  const invoice = await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) throw ApiError.notFound('Invoice not found');
    if (rows[0].status !== 'draft') throw ApiError.conflict('Invoice is already finalized');
    const { rows: items } = await client.query('SELECT 1 FROM invoice_items WHERE invoice_id = $1 LIMIT 1', [id]);
    if (!items.length) throw ApiError.badRequest('Add at least one line item before finalizing');
    const { rows: upd } = await client.query(
      `UPDATE invoices SET status = 'issued', finalized_at = now(), outstanding_balance = total WHERE id = $1 RETURNING *`,
      [id]
    );
    return upd[0];
  });
  await logAudit(null, req, { action: 'invoice.finalized', entityType: 'invoice', entityId: id, details: { invoiceNo: invoice.invoice_no, total: invoice.total } });
  res.json({ data: await getInvoiceDetail(id) });
}));

router.post('/:id/void', requirePermission('invoices.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Invoice');
  const { reason } = validate(z.object({ reason: z.string().trim().min(3, 'Reason is required').max(500) }), req.body);
  const invoice = await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [id]);
    const inv = rows[0];
    if (!inv) throw ApiError.notFound('Invoice not found');
    if (inv.status === 'void') throw ApiError.conflict('Invoice is already void');
    if (toPaise(inv.amount_paid) > 0n) {
      throw ApiError.conflict('This invoice has collected payments. Refund the payments before voiding.');
    }
    const { rows: upd } = await client.query(
      `UPDATE invoices SET status = 'void', voided_at = now(), voided_by = $2, void_reason = $3,
         outstanding_balance = 0 WHERE id = $1 RETURNING *`,
      [id, req.user.id, reason]
    );
    return upd[0];
  });
  await logAudit(null, req, { action: 'invoice.voided', entityType: 'invoice', entityId: id, details: { reason, invoiceNo: invoice.invoice_no } });
  res.json({ data: await getInvoiceDetail(id) });
}));

const adjustmentSchema = z.object({
  type: z.enum(['write_off', 'credit_note', 'debit_note']),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  reason: z.string().trim().min(3, 'Reason is required').max(500)
});

router.get('/:id/adjustments', requirePermission('invoices.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Invoice');
  const { rows } = await query(
    `SELECT a.*, u.full_name AS created_by_name
     FROM invoice_adjustments a LEFT JOIN users u ON u.id = a.created_by
     WHERE a.invoice_id = $1 ORDER BY a.created_at`,
    [id]
  );
  res.json({ data: rows.map((r) => ({
    id: r.id,
    adjustmentNo: r.adjustment_no,
    type: r.type,
    amount: r.amount,
    reason: r.reason,
    createdByName: r.created_by_name,
    createdAt: r.created_at
  })) });
}));

router.post('/:id/adjustments', requirePermission('invoices.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Invoice');
  const body = validate(adjustmentSchema, req.body);

  const result = await withTransaction(async (client) => {
    const { rows: invRows } = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [id]);
    const invoice = invRows[0];
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === 'draft') throw ApiError.conflict('Finalize the invoice before adjusting it');
    if (invoice.status === 'void') throw ApiError.conflict('Cannot adjust a void invoice');

    const amountPaise = toPaise(body.amount);
    const outstandingPaise = toPaise(invoice.outstanding_balance);
    const totalPaise = toPaise(invoice.total);

    if (body.type === 'write_off') {
      if (outstandingPaise <= 0n) throw ApiError.conflict('This invoice has no outstanding balance to write off');
      if (amountPaise > outstandingPaise) {
        throw ApiError.unprocessable(`Write-off cannot exceed the outstanding balance of ₹${formatIndian(invoice.outstanding_balance)}`);
      }
    }
    if (body.type === 'credit_note' && amountPaise > totalPaise) {
      throw ApiError.unprocessable(`Credit note cannot exceed the invoice total of ₹${formatIndian(invoice.total)}`);
    }

    const { rows: seq } = await client.query(`SELECT nextval('seq_adjustment') AS n`);
    const adjustmentNo = `ADJ-${String(seq[0].n).padStart(6, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO invoice_adjustments (adjustment_no, invoice_id, patient_id, type, amount, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [adjustmentNo, id, invoice.patient_id, body.type, fromPaise(amountPaise), body.reason, req.user.id]
    );
    const updated = await recalcInvoice(client, id);
    return { adjustment: rows[0], invoice: updated };
  });

  await logAudit(null, req, {
    action: `invoice.${body.type}`,
    entityType: 'invoice_adjustment',
    entityId: result.adjustment.id,
    details: { invoiceId: id, type: body.type, amount: result.adjustment.amount, reason: body.reason }
  });
  res.status(201).json({ data: { ...result.adjustment, invoice: await getInvoiceDetail(id) } });
}));

router.delete('/:id', requirePermission('invoices.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Invoice');
  const { rows } = await query('SELECT status, invoice_no FROM invoices WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Invoice not found');
  if (rows[0].status !== 'draft') throw ApiError.conflict('Only draft invoices can be deleted');
  await query('DELETE FROM invoices WHERE id = $1', [id]);
  await logAudit(null, req, { action: 'invoice.draft_deleted', entityType: 'invoice', entityId: id, details: { invoiceNo: rows[0].invoice_no } });
  res.json({ data: { ok: true } });
}));

router.get('/:id/pdf', requirePermission('invoices.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Invoice');
  const invoice = await getInvoiceDetail(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  await streamInvoice(invoice, res);
  await logAudit(null, req, { action: 'invoice.printed', entityType: 'invoice', entityId: id });
}));

router.get('/:id/receipt.pdf', requirePermission('payments.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Invoice');
  const invoice = await getInvoiceDetail(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  await streamReceipt({ invoice, clinic: await getClinic() }, res);
  await logAudit(null, req, { action: 'receipt.printed', entityType: 'invoice', entityId: id });
}));

export async function getInvoiceDetail(id, clinicId = null) {
  const clinicWhere = clinicId ? ' AND i.clinic_id = $2' : '';
  const params = clinicId ? [id, clinicId] : [id];
  const { rows } = await query(
    `SELECT i.*, p.full_name AS patient_name, p.patient_no, p.mobile, p.address, p.email, p.photo_file, p.photo_data,
            p.insurance_provider, p.insurance_policy_no,
            c.consultation_no, u.full_name AS created_by_name
     FROM invoices i
     JOIN patients p ON p.id = i.patient_id
     LEFT JOIN consultations c ON c.id = i.consultation_id
     LEFT JOIN users u ON u.id = i.created_by
     WHERE i.id = $1${clinicWhere}`,
    params
  );
  if (!rows[0]) return null;
  const r = rows[0];
  const [items, payments, refunds, adjustments, claim, credit] = await Promise.all([
    query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order, id', [id]),
    query(
      `SELECT p.*, u.full_name AS recorded_by_name FROM payments p LEFT JOIN users u ON u.id = p.recorded_by
       WHERE p.invoice_id = $1 ORDER BY p.payment_date`,
      [id]
    ),
    query('SELECT r.*, u.full_name AS refunded_by_name FROM refunds r LEFT JOIN users u ON u.id = r.refunded_by WHERE r.invoice_id = $1 ORDER BY r.refunded_at', [id]),
    query('SELECT a.*, u.full_name AS created_by_name FROM invoice_adjustments a LEFT JOIN users u ON u.id = a.created_by WHERE a.invoice_id = $1 ORDER BY a.created_at', [id]),
    query('SELECT * FROM insurance_claims WHERE invoice_id = $1 LIMIT 1', [id]),
    query(`SELECT COALESCE(sum(amount - used_amount) FILTER (WHERE status IN ('available','partially_used')), 0) AS available FROM patient_credits WHERE patient_id = $1`, [r.patient_id])
  ]);

  return {
    ...mapInvoice(r),
    patient: {
      id: r.patient_id,
      fullName: r.patient_name,
      patientNo: r.patient_no,
      mobile: r.mobile,
      address: r.address,
      email: r.email,
      insuranceProvider: r.insurance_provider,
      insurancePolicyNo: r.insurance_policy_no,
      hasPhoto: Boolean(r.photo_file || r.photo_data)
    },
    consultationNo: r.consultation_no,
    createdByName: r.created_by_name,
    items: items.rows.map((i) => ({
      id: i.id,
      treatmentId: i.treatment_id,
      description: i.description,
      toothNumber: i.tooth_number,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      discount: i.discount,
      lineTotal: i.line_total
    })),
    payments: payments.rows.map((p) => ({
      id: p.id,
      paymentNo: p.payment_no,
      amount: p.amount,
      method: p.method,
      transactionRef: p.transaction_ref,
      paymentDate: p.payment_date,
      status: p.status,
      notes: p.notes,
      recordedByName: p.recorded_by_name
    })),
    refunds: refunds.rows.map((rf) => ({
      id: rf.id,
      refundNo: rf.refund_no,
      amount: rf.amount,
      method: rf.method,
      reason: rf.reason,
      refundedAt: rf.refunded_at,
      refundedByName: rf.refunded_by_name
    })),
    adjustments: adjustments.rows.map((a) => ({
      id: a.id,
      adjustmentNo: a.adjustment_no,
      type: a.type,
      amount: a.amount,
      reason: a.reason,
      createdByName: a.created_by_name,
      createdAt: a.created_at
    })),
    claim: claim.rows[0] ? {
      id: claim.rows[0].id,
      claimNo: claim.rows[0].claim_no,
      status: claim.rows[0].status,
      provider: claim.rows[0].provider,
      claimAmount: claim.rows[0].claim_amount,
      approvedAmount: claim.rows[0].approved_amount,
      patientCopay: claim.rows[0].patient_copay
    } : null,
    creditAvailable: credit.rows[0]?.available || '0'
  };
}

function mapInvoice(r) {
  return {
    id: r.id,
    clinicId: r.clinic_id || null,
    invoiceNo: r.invoice_no,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientNo: r.patient_no,
    mobile: r.mobile,
    consultationId: r.consultation_id,
    invoiceDate: r.invoice_date,
    subtotal: r.subtotal,
    discountTotal: r.discount_total,
    taxPercent: r.tax_percent,
    taxTotal: r.tax_total,
    total: r.total,
    amountPaid: r.amount_paid,
    outstanding: r.outstanding_balance,
    status: r.status,
    notes: r.notes,
    itemCount: r.item_count,
    createdAt: r.created_at,
    finalizedAt: r.finalized_at,
    voidedAt: r.voided_at,
    voidReason: r.void_reason
  };
}

export default router;
