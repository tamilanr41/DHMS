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

const CLAIM_STATUSES = ['draft', 'submitted', 'approved', 'partially_approved', 'rejected', 'settled'];
const TRANSITIONS = {
  draft: ['submitted', 'rejected'],
  submitted: ['approved', 'partially_approved', 'rejected'],
  approved: ['settled'],
  partially_approved: ['settled'],
  rejected: [],
  settled: []
};

function mapClaim(r) {
  return {
    id: r.id,
    claimNo: r.claim_no,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientNo: r.patient_no,
    mobile: r.mobile,
    invoiceId: r.invoice_id,
    invoiceNo: r.invoice_no,
    invoiceTotal: r.invoice_total,
    invoiceStatus: r.invoice_status,
    provider: r.provider,
    policyNo: r.policy_no,
    memberId: r.member_id,
    preAuthNo: r.pre_auth_no,
    claimAmount: r.claim_amount,
    approvedAmount: r.approved_amount,
    patientCopay: r.patient_copay,
    status: r.status,
    submittedAt: r.submitted_at,
    decidedAt: r.decided_at,
    settledAt: r.settled_at,
    notes: r.notes,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

const SELECT = `SELECT c.*, p.full_name AS patient_name, p.patient_no, p.mobile,
                       i.invoice_no, i.total AS invoice_total, i.status AS invoice_status,
                       u.full_name AS created_by_name
                FROM insurance_claims c
                JOIN patients p ON p.id = c.patient_id
                JOIN invoices i ON i.id = c.invoice_id
                LEFT JOIN users u ON u.id = c.created_by`;

router.get('/', requirePermission('claims.view'), asyncHandler(async (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (req.query.status && CLAIM_STATUSES.includes(req.query.status)) {
    params.push(req.query.status);
    where.push(`c.status = $${params.length}`);
  }
  if (req.query.patientId) {
    params.push(req.query.patientId);
    where.push(`c.patient_id = $${params.length}`);
  }
  if (req.query.invoiceId) {
    params.push(req.query.invoiceId);
    where.push(`c.invoice_id = $${params.length}`);
  }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(c.claim_no ILIKE $${params.length} OR c.provider ILIKE $${params.length} OR p.full_name ILIKE $${params.length} OR i.invoice_no ILIKE $${params.length})`);
  }
  params.push(Math.min(300, Number.parseInt(req.query.pageSize, 10) || 100));
  const { rows } = await query(
    `${SELECT} WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC LIMIT $${params.length}`,
    params
  );
  res.json({ data: rows.map(mapClaim) });
}));

router.get('/:id', requirePermission('claims.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Claim');
  const { rows } = await query(`${SELECT} WHERE c.id = $1`, [id]);
  if (!rows[0]) throw ApiError.notFound('Claim not found');
  res.json({ data: mapClaim(rows[0]) });
}));

const claimSchema = z.object({
  invoiceId: z.string().uuid('Select an invoice'),
  provider: z.string().trim().min(2, 'Insurance / TPA name is required').max(150),
  policyNo: z.string().trim().max(80).nullable().optional(),
  memberId: z.string().trim().max(80).nullable().optional(),
  preAuthNo: z.string().trim().max(80).nullable().optional(),
  claimAmount: z.coerce.number().positive('Claim amount must be greater than zero').optional(),
  notes: z.string().trim().max(1000).nullable().optional()
});

router.post('/', requirePermission('claims.manage'), asyncHandler(async (req, res) => {
  const body = validate(claimSchema, req.body);

  const { rows: invRows } = await query(
    `SELECT i.*, p.insurance_provider, p.insurance_policy_no
     FROM invoices i JOIN patients p ON p.id = i.patient_id WHERE i.id = $1`,
    [body.invoiceId]
  );
  const invoice = invRows[0];
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.status === 'draft') throw ApiError.conflict('Finalize the invoice before creating a claim');
  if (invoice.status === 'void') throw ApiError.conflict('Cannot claim against a void invoice');

  const existing = await query('SELECT id, claim_no FROM insurance_claims WHERE invoice_id = $1', [body.invoiceId]);
  if (existing.rows[0]) throw ApiError.conflict(`Invoice already has claim ${existing.rows[0].claim_no}`);

  const claimAmount = body.claimAmount !== undefined ? toPaise(body.claimAmount) : toPaise(invoice.total);
  if (claimAmount > toPaise(invoice.total)) {
    throw ApiError.unprocessable(`Claim amount cannot exceed the invoice total of ₹${formatIndian(invoice.total)}`);
  }

  const claim = await withTransaction(async (client) => {
    const { rows: seq } = await client.query(`SELECT nextval('seq_claim') AS n`);
    const claimNo = `CLM-${new Date().getFullYear()}-${String(seq[0].n).padStart(5, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO insurance_claims (claim_no, patient_id, invoice_id, provider, policy_no, member_id,
         pre_auth_no, claim_amount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [claimNo, invoice.patient_id, invoice.id, body.provider,
        body.policyNo || invoice.insurance_policy_no || null,
        body.memberId || null, body.preAuthNo || null, fromPaise(claimAmount),
        body.notes || null, req.user.id]
    );
    return rows[0];
  });

  await logAudit(null, req, {
    action: 'claim.created',
    entityType: 'insurance_claim',
    entityId: claim.id,
    details: { claimNo: claim.claim_no, invoiceId: claim.invoice_id, provider: claim.provider, claimAmount: claim.claim_amount }
  });
  const { rows } = await query(`${SELECT} WHERE c.id = $1`, [claim.id]);
  res.status(201).json({ data: mapClaim(rows[0]) });
}));

const updateSchema = z.object({
  provider: z.string().trim().min(2).max(150).optional(),
  policyNo: z.string().trim().max(80).nullable().optional(),
  memberId: z.string().trim().max(80).nullable().optional(),
  preAuthNo: z.string().trim().max(80).nullable().optional(),
  claimAmount: z.coerce.number().positive().optional(),
  notes: z.string().trim().max(1000).nullable().optional()
});

router.patch('/:id', requirePermission('claims.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Claim');
  const body = validate(updateSchema, req.body);
  const { rows: cur } = await query('SELECT * FROM insurance_claims WHERE id = $1', [id]);
  const claim = cur[0];
  if (!claim) throw ApiError.notFound('Claim not found');
  if (!['draft', 'submitted'].includes(claim.status)) throw ApiError.conflict('Only draft or submitted claims can be edited');

  const claimAmount = body.claimAmount !== undefined ? toPaise(body.claimAmount) : toPaise(claim.claim_amount);
  if (claimAmount < toPaise(claim.approved_amount)) throw ApiError.unprocessable('Claim amount cannot be less than the approved amount');

  const { rows } = await query(
    `UPDATE insurance_claims SET
       provider = COALESCE($2, provider), policy_no = COALESCE($3, policy_no),
       member_id = COALESCE($4, member_id), pre_auth_no = COALESCE($5, pre_auth_no),
       claim_amount = $6, notes = COALESCE($7, notes)
     WHERE id = $1 RETURNING *`,
    [id, body.provider ?? null, body.policyNo ?? null, body.memberId ?? null, body.preAuthNo ?? null, fromPaise(claimAmount), body.notes ?? null]
  );
  await logAudit(null, req, { action: 'claim.updated', entityType: 'insurance_claim', entityId: id, details: body });
  const detail = await query(`${SELECT} WHERE c.id = $1`, [rows[0].id]);
  res.json({ data: mapClaim(detail.rows[0]) });
}));

const statusSchema = z.object({
  status: z.enum(CLAIM_STATUSES),
  approvedAmount: z.coerce.number().min(0).optional(),
  patientCopay: z.coerce.number().min(0).optional(),
  note: z.string().trim().max(500).nullable().optional()
});

router.post('/:id/status', requirePermission('claims.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Claim');
  const body = validate(statusSchema, req.body);

  const claim = await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM insurance_claims WHERE id = $1 FOR UPDATE', [id]);
    const current = rows[0];
    if (!current) throw ApiError.notFound('Claim not found');
    if (current.status === body.status) return current;
    if (!TRANSITIONS[current.status].includes(body.status)) {
      throw ApiError.badRequest(`Cannot change a ${current.status.replace('_', ' ')} claim to ${body.status.replace('_', ' ')}`);
    }

    const claimAmount = toPaise(current.claim_amount);
    let approved = toPaise(current.approved_amount);
    if (['approved', 'partially_approved'].includes(body.status)) {
      if (body.approvedAmount === undefined) throw ApiError.unprocessable('Approved amount is required');
      approved = toPaise(body.approvedAmount);
      if (approved > claimAmount) throw ApiError.unprocessable('Approved amount cannot exceed the claim amount');
      if (body.status === 'approved' && approved !== claimAmount) {
        throw ApiError.unprocessable('A fully approved claim must match the claim amount. Use partially approved otherwise.');
      }
      if (body.status === 'partially_approved' && approved >= claimAmount) {
        throw ApiError.unprocessable('Partially approved amount must be less than the claim amount');
      }
    }
    if (body.status === 'rejected') approved = 0n;
    const copay = body.patientCopay !== undefined
      ? toPaise(body.patientCopay)
      : toPaise(claimAmount - approved);

    const decidedAt = ['approved', 'partially_approved', 'rejected'].includes(body.status) ? new Date() : current.decided_at;
    const submittedAt = body.status === 'submitted' ? new Date() : current.submitted_at;
    const settledAt = body.status === 'settled' ? new Date() : current.settled_at;

    const { rows: upd } = await client.query(
      `UPDATE insurance_claims SET status = $2, approved_amount = $3, patient_copay = $4,
         submitted_at = $5, decided_at = $6, settled_at = $7, notes = COALESCE($8, notes)
       WHERE id = $1 RETURNING *`,
      [id, body.status, fromPaise(approved), fromPaise(copay), submittedAt, decidedAt, settledAt, body.note || null]
    );

    if (body.status === 'settled') {
      if (approved <= 0n) throw ApiError.unprocessable('Cannot settle a claim with no approved amount');
      const { rows: invRows } = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [current.invoice_id]);
      const invoice = invRows[0];
      if (!invoice) throw ApiError.notFound('Invoice not found');
      if (invoice.status === 'void') throw ApiError.conflict('The linked invoice is void');
      const outstanding = toPaise(invoice.outstanding_balance);
      if (outstanding <= 0n) throw ApiError.conflict('The linked invoice has no outstanding balance');
      const amount = approved < outstanding ? approved : outstanding;
      const { rows: seq } = await client.query(`SELECT nextval('seq_payment') AS n`);
      const paymentNo = `PAY-${String(seq[0].n).padStart(6, '0')}`;
      await client.query(
        `INSERT INTO payments (payment_no, invoice_id, patient_id, amount, method, transaction_ref,
           payment_date, recorded_by, notes)
         VALUES ($1,$2,$3,$4,'insurance',$5, now(), $6, $7)`,
        [paymentNo, invoice.id, invoice.patient_id, fromPaise(amount), current.claim_no, req.user.id,
          `Insurance settlement ${current.claim_no}`]
      );
      await recalcInvoice(client, invoice.id);
    }
    return upd[0];
  });

  await logAudit(null, req, {
    action: `claim.${body.status}`,
    entityType: 'insurance_claim',
    entityId: id,
    details: { claimNo: claim.claim_no, approvedAmount: claim.approved_amount, note: body.note }
  });
  const detail = await query(`${SELECT} WHERE c.id = $1`, [id]);
  res.json({ data: mapClaim(detail.rows[0]) });
}));

export default router;
