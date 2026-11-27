import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate } from '../utils/validate.js';
import { formatDecimal, fromPaise, multiplyMoney, toPaise } from '../utils/money.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { logAudit } from '../services/audit.service.js';
import { streamTreatmentEstimate, streamConsent } from '../services/pdf.service.js';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIRS } from '../middleware/upload.js';

const router = Router();
router.use(authenticate);

const itemSchema = z.object({
  toothNumber: z.string().trim().max(3).nullable().optional(),
  treatmentId: z.string().uuid().nullable().optional(),
  treatmentName: z.string().trim().max(150).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  phase: z.coerce.number().int().min(1).max(20).default(1).optional(),
  quantity: z.coerce.number().positive('Quantity must be positive').max(1000).default(1),
  unitPrice: z.coerce.number().min(0, 'Price cannot be negative').optional(),
  discount: z.coerce.number().min(0, 'Discount cannot be negative').default(0)
});

const planSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  consultationId: z.string().uuid().nullable().optional(),
  dentistId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(itemSchema).default([]).optional()
});

async function resolveItem(client, item) {
  let name = item.treatmentName;
  let price = item.unitPrice;
  if (item.treatmentId) {
    const { rows } = await client.query('SELECT name, default_price FROM treatment_catalog WHERE id = $1', [item.treatmentId]);
    if (!rows[0]) throw ApiError.badRequest('Treatment is not in the catalog');
    name = name || rows[0].name;
    if (price === undefined) price = rows[0].default_price;
  }
  if (!name) throw ApiError.unprocessable('Treatment name is required');
  if (price === undefined) throw ApiError.unprocessable(`Price is required for "${name}"`);
  const unitPaise = toPaise(price, 'Unit price');
  const discountPaise = toPaise(item.discount || 0, 'Discount');
  const gross = multiplyMoney(unitPaise, item.quantity);
  if (discountPaise > gross) throw ApiError.unprocessable(`Discount cannot exceed the amount for "${name}"`);
  return {
    treatmentName: name,
    unitPrice: fromPaise(unitPaise),
    quantity: formatDecimal(item.quantity, 2, 'Quantity'),
    discount: fromPaise(discountPaise),
    total: fromPaise(gross - discountPaise)
  };
}

async function recalcPlan(client, planId) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'completed')::int AS completed,
            count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress
     FROM treatment_plan_items WHERE plan_id = $1 AND status <> 'cancelled'`,
    [planId]
  );
  const s = rows[0];
  const { rows: planRows } = await client.query('SELECT status FROM treatment_plans WHERE id = $1', [planId]);
  const current = planRows[0]?.status;
  if (!current || ['cancelled'].includes(current)) return;
  let status = current;
  if (s.total > 0 && s.completed === s.total) status = 'completed';
  else if (s.completed > 0 || s.in_progress > 0) status = 'partially_completed';
  else if (['completed', 'partially_completed'].includes(current)) status = 'accepted';
  if (status !== current) await client.query('UPDATE treatment_plans SET status = $2 WHERE id = $1', [planId, status]);
}

router.get('/', requirePermission('plans.view'), asyncHandler(async (req, res) => {
  const where = ['1=1'];
  const params = [];

  if (req.user?.clinicId) {
    params.push(req.user.clinicId);
    where.push(`tp.clinic_id = $${params.length}`);
  }

  if (req.query.patientId) {
    params.push(req.query.patientId);
    where.push(`tp.patient_id = $${params.length}`);
  }
  if (req.query.status) {
    params.push(req.query.status);
    where.push(`tp.status = $${params.length}`);
  }
  if (req.query.consultationId) {
    params.push(req.query.consultationId);
    where.push(`tp.consultation_id = $${params.length}`);
  }
  const limit = Math.min(200, Number.parseInt(req.query.pageSize, 10) || 100);
  params.push(limit);
  const { rows } = await query(
    `SELECT tp.*, p.full_name AS patient_name, p.patient_no, u.full_name AS dentist_name,
            COALESCE(sum(i.total) FILTER (WHERE i.status <> 'cancelled'),0) AS estimate,
            count(i.id)::int AS item_count,
            count(i.id) FILTER (WHERE i.status = 'completed')::int AS completed_count
     FROM treatment_plans tp
     JOIN patients p ON p.id = tp.patient_id
     JOIN users u ON u.id = tp.dentist_id
     LEFT JOIN treatment_plan_items i ON i.plan_id = tp.id
     WHERE ${where.join(' AND ')}
     GROUP BY tp.id, p.full_name, p.patient_no, u.full_name
     ORDER BY tp.created_at DESC LIMIT $${params.length}`,
    params
  );
  res.json({ data: rows.map(mapPlan) });
}));

router.post('/', requirePermission('plans.manage'), asyncHandler(async (req, res) => {
  const body = validate(planSchema, req.body);
  const clinicId = req.user?.clinicId || null;
  let dentistId = req.user.role === 'dentist' ? req.user.id : body.dentistId;
  if (!dentistId) {
    const defaultDentist = await query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'dentist' AND u.is_active LIMIT 1`
    );
    dentistId = defaultDentist.rows[0]?.id || req.user.id;
  }
  const patient = await query('SELECT 1 FROM patients WHERE id = $1', [body.patientId]);
  if (!patient.rowCount) throw ApiError.notFound('Patient not found');

  const items = body.items || [];
  const plan = await withTransaction(async (client) => {
    const resolved = [];
    for (const item of items) resolved.push(await resolveItem(client, item));
    const { rows: seq } = await client.query(`SELECT nextval('seq_plan') AS n`);
    const planNo = `TP-${String(seq[0].n).padStart(6, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO treatment_plans (plan_no, patient_id, consultation_id, dentist_id, notes, created_by, clinic_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [planNo, body.patientId, body.consultationId || null, dentistId, body.notes || null, req.user.id, clinicId]
    );
    const planId = rows[0].id;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const r = resolved[i];
      await client.query(
        `INSERT INTO treatment_plan_items (plan_id, tooth_number, treatment_id, treatment_name, description, quantity, unit_price, discount, total, sort_order, phase)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [planId, item.toothNumber || null, item.treatmentId || null, r.treatmentName, item.description || null, r.quantity, r.unitPrice, r.discount, r.total, i, item.phase || 1]
      );
    }
    return rows[0];
  });

  await logAudit(null, req, { action: 'plan.created', entityType: 'treatment_plan', entityId: plan.id, details: { planNo: plan.plan_no, patientId: body.patientId, items: items.length } });
  res.status(201).json({ data: await fetchPlan(plan.id) });
}));

router.get('/:id', requirePermission('plans.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Treatment plan');
  const plan = await fetchPlan(id, req.user?.clinicId);
  if (!plan) throw ApiError.notFound('Treatment plan not found');
  res.json({ data: plan });
}));

router.patch('/:id', requirePermission('plans.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Treatment plan');
  const body = validate(
    z.object({
      status: z.enum(['proposed', 'accepted', 'partially_completed', 'completed', 'cancelled']).optional(),
      notes: z.string().trim().max(2000).nullable().optional()
    }),
    req.body
  );
  const { rows } = await query(
    `UPDATE treatment_plans SET status = COALESCE($2, status), notes = COALESCE($3, notes) WHERE id = $1 RETURNING *`,
    [id, body.status ?? null, body.notes ?? null]
  );
  if (!rows[0]) throw ApiError.notFound('Treatment plan not found');
  await logAudit(null, req, { action: 'plan.updated', entityType: 'treatment_plan', entityId: id, details: body });
  res.json({ data: await fetchPlan(id) });
}));

router.post('/:id/items', requirePermission('plans.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Treatment plan');
  const body = validate(itemSchema, req.body);
  const { rows: plans } = await query('SELECT status FROM treatment_plans WHERE id = $1', [id]);
  if (!plans[0]) throw ApiError.notFound('Treatment plan not found');
  if (plans[0].status === 'cancelled') throw ApiError.badRequest('Cannot modify a cancelled plan');

  const item = await withTransaction(async (client) => {
    const r = await resolveItem(client, body);
    const { rows } = await client.query(
      `INSERT INTO treatment_plan_items (plan_id, tooth_number, treatment_id, treatment_name, description, quantity, unit_price, discount, total, sort_order, phase)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9, COALESCE(max(sort_order) + 1, 0), $10
       FROM treatment_plan_items WHERE plan_id = $1
       RETURNING *`,
      [id, body.toothNumber || null, body.treatmentId || null, r.treatmentName, body.description || null, r.quantity, r.unitPrice, r.discount, r.total, body.phase || 1]
    );
    await recalcPlan(client, id);
    return rows[0];
  });
  await logAudit(null, req, { action: 'plan.item_added', entityType: 'treatment_plan_item', entityId: item.id, details: { planId: id } });
  res.status(201).json({ data: await fetchPlan(id) });
}));

const itemUpdateSchema = z.object({
  toothNumber: z.string().trim().max(3).nullable().optional(),
  treatmentName: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  phase: z.coerce.number().int().min(1).max(20).optional(),
  quantity: z.coerce.number().positive().max(1000).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  status: z.enum(['proposed', 'accepted', 'in_progress', 'completed', 'cancelled']).optional(),
  notes: z.string().trim().max(1000).nullable().optional()
});

router.patch('/items/:itemId', requirePermission('plans.manage'), asyncHandler(async (req, res) => {
  const itemId = requireId(req.params.itemId, 'Treatment item');
  const body = validate(itemUpdateSchema, req.body);
  const { rows: cur } = await query('SELECT * FROM treatment_plan_items WHERE id = $1', [itemId]);
  const existing = cur[0];
  if (!existing) throw ApiError.notFound('Treatment item not found');

  const qty = body.quantity ?? existing.quantity;
  const price = body.unitPrice ?? existing.unit_price;
  const discount = body.discount ?? existing.discount;
  const unitPaise = toPaise(price, 'Unit price');
  const discountPaise = toPaise(discount, 'Discount');
  const gross = multiplyMoney(unitPaise, qty);
  if (discountPaise > gross) throw ApiError.unprocessable('Discount cannot exceed the item amount');
  const total = fromPaise(gross - discountPaise);
  const completedAt = body.status === 'completed' ? new Date() : body.status ? null : existing.completed_at;

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE treatment_plan_items SET
         tooth_number = COALESCE($2, tooth_number),
         treatment_name = COALESCE($3, treatment_name),
         description = COALESCE($4, description),
         phase = COALESCE($12, phase),
         quantity = $5, unit_price = $6, discount = $7, total = $8,
         status = COALESCE($9, status), completed_at = $10, notes = COALESCE($11, notes)
       WHERE id = $1`,
      [itemId, body.toothNumber ?? null, body.treatmentName ?? null, body.description ?? null, formatDecimal(qty, 2, 'Quantity'), fromPaise(unitPaise), fromPaise(discountPaise), total, body.status ?? null, completedAt, body.notes ?? null, body.phase ?? null]
    );
    await recalcPlan(client, existing.plan_id);
  });
  await logAudit(null, req, { action: 'plan.item_updated', entityType: 'treatment_plan_item', entityId: itemId, details: body });
  res.json({ data: await fetchPlan(existing.plan_id) });
}));

router.delete('/items/:itemId', requirePermission('plans.manage'), asyncHandler(async (req, res) => {
  const itemId = requireId(req.params.itemId, 'Treatment item');
  const { rows } = await query(
    `SELECT i.plan_id, tp.status FROM treatment_plan_items i JOIN treatment_plans tp ON tp.id = i.plan_id WHERE i.id = $1`,
    [itemId]
  );
  if (!rows[0]) throw ApiError.notFound('Treatment item not found');
  if (!['proposed', 'accepted'].includes(rows[0].status)) throw ApiError.badRequest('Items can only be removed from proposed or accepted plans');
  await withTransaction(async (client) => {
    await client.query('DELETE FROM treatment_plan_items WHERE id = $1', [itemId]);
    await recalcPlan(client, rows[0].plan_id);
  });
  await logAudit(null, req, { action: 'plan.item_removed', entityType: 'treatment_plan_item', entityId: itemId });
  res.json({ data: await fetchPlan(rows[0].plan_id) });
}));

router.get('/:id/pdf', requirePermission('plans.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Treatment plan');
  const plan = await fetchPlan(id);
  if (!plan) throw ApiError.notFound('Treatment plan not found');
  await streamTreatmentEstimate(plan, res, { userName: req.user.fullName });
  await logAudit(null, req, { action: 'plan.pdf_generated', entityType: 'treatment_plan', entityId: id });
}));

async function fetchPlan(id, clinicId = null) {
  const clinicWhere = clinicId ? ' AND tp.clinic_id = $2' : '';
  const params = clinicId ? [id, clinicId] : [id];
  const { rows } = await query(
    `SELECT tp.*, p.full_name AS patient_name, p.patient_no, p.mobile, p.dob, p.gender, p.photo_file, p.photo_data,
            date_part('year', age(p.dob))::int AS age, u.full_name AS dentist_name,
            c.consultation_no
     FROM treatment_plans tp
     JOIN patients p ON p.id = tp.patient_id
     JOIN users u ON u.id = tp.dentist_id
     LEFT JOIN consultations c ON c.id = tp.consultation_id
     WHERE tp.id = $1${clinicWhere}`,
    params
  );
  if (!rows[0]) return null;
  const items = await query('SELECT * FROM treatment_plan_items WHERE plan_id = $1 ORDER BY sort_order, created_at, id', [id]);
  const plan = mapPlan(rows[0]);
  plan.patient = {
    id: rows[0].patient_id,
    fullName: rows[0].patient_name,
    patientNo: rows[0].patient_no,
    mobile: rows[0].mobile,
    age: rows[0].age,
    gender: rows[0].gender,
    hasPhoto: Boolean(rows[0].photo_file || rows[0].photo_data)
  };
  plan.consultationNo = rows[0].consultation_no;
  plan.items = items.rows.map((i) => ({
    id: i.id,
    toothNumber: i.tooth_number,
    treatmentId: i.treatment_id,
    treatmentName: i.treatment_name,
    description: i.description,
    phase: i.phase,
    quantity: i.quantity,
    unitPrice: i.unit_price,
    discount: i.discount,
    total: i.total,
    status: i.status,
    completedAt: i.completed_at,
    notes: i.notes
  }));
  plan.estimate = fromPaise(
    items.rows.reduce((sum, i) => (i.status === 'cancelled' ? sum : sum + toPaise(i.total)), 0n)
  );
  return plan;
}

function mapPlan(r) {
  return {
    id: r.id,
    clinicId: r.clinic_id || null,
    planNo: r.plan_no,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientNo: r.patient_no,
    consultationId: r.consultation_id,
    dentistId: r.dentist_id,
    dentistName: r.dentist_name,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
    estimate: r.estimate,
    itemCount: r.item_count,
    completedCount: r.completed_count
  };
}

/* ---------- consents ---------- */
router.get('/:id/consents', requirePermission('plans.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Treatment plan');
  const { rows } = await query(
    `SELECT c.*, u.full_name AS created_by_name
     FROM treatment_plan_consents c LEFT JOIN users u ON u.id = c.created_by
     WHERE c.plan_id = $1 ORDER BY c.signed_at DESC`,
    [id]
  );
  res.json({ data: rows.map((r) => ({
    id: r.id,
    planId: r.plan_id,
    patientId: r.patient_id,
    consentType: r.consent_type,
    title: r.title,
    body: r.body,
    signatureFile: r.signature_file,
    signerName: r.signer_name,
    witnessName: r.witness_name,
    signedAt: r.signed_at,
    createdByName: r.created_by_name,
    createdAt: r.created_at
  })) });
}));

const consentSchema = z.object({
  consentType: z.enum(['treatment', 'photo', 'sedation', 'general']).default('treatment'),
  title: z.string().trim().min(2, 'Title is required').max(200),
  body: z.string().trim().min(5, 'Consent text is required').max(20000),
  signerName: z.string().trim().min(2, 'Signer name is required').max(150),
  witnessName: z.string().trim().max(150).nullable().optional(),
  signatureDataUrl: z.string().trim().min(20, 'Signature is required').max(5000000)
});

router.post('/:id/consents', requirePermission('plans.manage'), asyncHandler(async (req, res) => {
  const planId = requireId(req.params.id, 'Treatment plan');
  const body = validate(consentSchema, req.body);

  const { rows: planRows } = await query(
    `SELECT tp.*, p.full_name AS patient_name FROM treatment_plans tp JOIN patients p ON p.id = tp.patient_id WHERE tp.id = $1`,
    [planId]
  );
  if (!planRows[0]) throw ApiError.notFound('Treatment plan not found');

  const match = body.signatureDataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) throw ApiError.badRequest('Signature must be a base64 image');
  const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
  const buffer = Buffer.from(match[3], 'base64');
  if (buffer.length < 100 || buffer.length > 2 * 1024 * 1024) {
    throw ApiError.badRequest('Signature image is invalid or too large');
  }

  const consent = await withTransaction(async (client) => {
    const fileName = `${Date.now()}-${cryptoRandom()}.${ext}`;
    fs.mkdirSync(DATA_DIRS.consents, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIRS.consents, fileName), buffer);

    const { rows } = await client.query(
      `INSERT INTO treatment_plan_consents (plan_id, patient_id, consent_type, title, body,
         signature_file, signer_name, witness_name, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [planId, planRows[0].patient_id, body.consentType, body.title, body.body,
        fileName, body.signerName, body.witnessName || null, req.user.id]
    );
    return rows[0];
  });

  await logAudit(null, req, { action: 'plan.consent_signed', entityType: 'treatment_plan_consent', entityId: consent.id, details: { planId, consentType: body.consentType, signerName: body.signerName } });
  res.status(201).json({ data: consent });
}));

router.get('/consents/:consentId/pdf', requirePermission('plans.view'), asyncHandler(async (req, res) => {
  const consentId = requireId(req.params.consentId, 'Consent');
  const { rows } = await query(
    `SELECT c.*, tp.plan_no, p.full_name AS patient_name, p.patient_no, p.mobile, p.dob, p.gender,
            date_part('year', age(p.dob))::int AS age, u.full_name AS dentist_name
     FROM treatment_plan_consents c
     JOIN treatment_plans tp ON tp.id = c.plan_id
     JOIN patients p ON p.id = c.patient_id
     LEFT JOIN users u ON u.id = tp.dentist_id
     WHERE c.id = $1`,
    [consentId]
  );
  if (!rows[0]) throw ApiError.notFound('Consent not found');
  const r = rows[0];
  await streamConsent({
    consent: {
      id: r.id,
      consentType: r.consent_type,
      title: r.title,
      body: r.body,
      signerName: r.signer_name,
      witnessName: r.witness_name,
      signedAt: r.signed_at,
      signatureFile: r.signature_file
    },
    planNo: r.plan_no,
    patient: {
      fullName: r.patient_name,
      patientNo: r.patient_no,
      mobile: r.mobile,
      age: r.age,
      gender: r.gender
    },
    dentistName: r.dentist_name
  }, res);
  await logAudit(null, req, { action: 'plan.consent_printed', entityType: 'treatment_plan_consent', entityId: consentId });
}));

function cryptoRandom() {
  return require('node:crypto').randomBytes(6).toString('hex');
}

export default router;
