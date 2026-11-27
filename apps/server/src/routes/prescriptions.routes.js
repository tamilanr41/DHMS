import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { logAudit } from '../services/audit.service.js';
import { checkMedicationSafety } from '../services/medicationSafety.service.js';

const router = Router();
router.use(authenticate);

const itemSchema = z.object({
  medicineName: z.string().trim().min(1, 'Medicine name is required').max(150),
  dosage: z.string().trim().max(100).nullable().optional(),
  route: z.string().trim().max(50).nullable().optional(),
  frequency: z.string().trim().max(100).nullable().optional(),
  duration: z.string().trim().max(100).nullable().optional(),
  instructions: z.string().trim().max(500).nullable().optional()
});

const prescriptionSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  consultationId: z.string().uuid().nullable().optional(),
  dentistId: z.string().uuid().optional(),
  prescriptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  allergiesNoted: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().max(500000).nullable().optional(),
  handwritingData: z.string().nullable().optional(),
  safetyOverrideReason: z.string().trim().max(500).nullable().optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
  items: z.array(itemSchema).min(1, 'Add at least one medicine')
});

router.get('/', requirePermission('prescriptions.view'), asyncHandler(async (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (req.user?.clinicId) {
    params.push(req.user.clinicId);
    where.push(`(p.clinic_id = $${params.length} OR pt.clinic_id = $${params.length})`);
  }
  if (req.query.patientId) {
    params.push(req.query.patientId);
    where.push(`p.patient_id = $${params.length}`);
  }
  if (req.query.consultationId) {
    params.push(req.query.consultationId);
    where.push(`p.consultation_id = $${params.length}`);
  }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(pt.full_name ILIKE $${params.length} OR p.prescription_no ILIKE $${params.length})`);
  }
  const limit = Math.min(200, Number.parseInt(req.query.pageSize, 10) || 100);
  params.push(limit);
  const { rows } = await query(
    `SELECT p.*, pt.full_name AS patient_name, pt.patient_no, u.full_name AS dentist_name,
            (SELECT count(*) FROM prescription_items pi WHERE pi.prescription_id = p.id)::int AS item_count
     FROM prescriptions p
     JOIN patients pt ON pt.id = p.patient_id
     JOIN users u ON u.id = p.dentist_id
     WHERE ${where.join(' AND ')}
     ORDER BY p.prescription_date DESC, p.created_at DESC LIMIT $${params.length}`,
    params
  );
  res.json({ data: rows.map(mapPrescription) });
}));

router.post('/', requirePermission('prescriptions.manage'), asyncHandler(async (req, res) => {
  const body = validate(prescriptionSchema, req.body);
  const dentistId = req.user.role === 'dentist' ? req.user.id : body.dentistId;
  if (!dentistId) throw ApiError.badRequest('A prescribing dentist is required');
  const dentist = await query(
    `SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND r.code = 'dentist'`,
    [dentistId]
  );
  if (!dentist.rowCount) throw ApiError.badRequest('Selected dentist is not valid');
  const patient = await query(
    `SELECT 1 FROM patients WHERE id = $1 ${req.user?.clinicId ? 'AND clinic_id = $2' : ''}`,
    req.user?.clinicId ? [body.patientId, req.user.clinicId] : [body.patientId]
  );
  if (!patient.rowCount) throw ApiError.notFound('Patient not found');

  const safety = await checkMedicationSafety({ patientId: body.patientId, items: body.items });
  if (safety.hasMajor && !body.safetyOverrideReason) {
    throw ApiError.conflict('Major medication safety warnings require an override reason', {
      code: 'SAFETY_OVERRIDE_REQUIRED',
      details: { flags: safety.flags }
    });
  }

  const prescription = await withTransaction(async (client) => {
    const { rows: setting } = await client.query('SELECT prescription_prefix FROM clinic_settings WHERE id = 1');
    const prefix = setting[0]?.prescription_prefix || 'RX';
    const { rows: seq } = await client.query(`SELECT nextval('seq_prescription') AS n`);
    const no = `${prefix}-${String(seq[0].n).padStart(6, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO prescriptions (prescription_no, patient_id, dentist_id, consultation_id, prescription_date,
         allergies_noted, notes, follow_up_date, safety_flags, safety_override_reason, created_by, clinic_id)
       VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [no, body.patientId, dentistId, body.consultationId || null, body.prescriptionDate || null, body.allergiesNoted || null, body.notes || null, body.followUpDate || null, JSON.stringify(safety.flags), body.safetyOverrideReason || null, req.user.id, req.user?.clinicId || null]
    );
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      await client.query(
        `INSERT INTO prescription_items (prescription_id, medicine_name, dosage, route, frequency, duration, instructions, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [rows[0].id, item.medicineName, item.dosage || null, item.route || null, item.frequency || null, item.duration || null, item.instructions || null, i]
      );
    }
    return rows[0];
  });

  await logAudit(null, req, { action: 'prescription.created', entityType: 'prescription', entityId: prescription.id, details: { prescriptionNo: prescription.prescription_no, patientId: body.patientId, medicines: body.items.length, clinicId: req.user?.clinicId } });
  res.status(201).json({ data: await fetchPrescription(prescription.id, req.user?.clinicId) });
}));

const medicineSchema = z.object({
  name: z.string().trim().min(2, 'Medicine name is required').max(150),
  form: z.string().trim().max(40).nullable().optional(),
  strength: z.string().trim().max(60).nullable().optional(),
  defaultDosage: z.string().trim().max(60).nullable().optional(),
  defaultRoute: z.string().trim().max(30).default('oral'),
  defaultFrequency: z.string().trim().max(60).nullable().optional(),
  defaultDuration: z.string().trim().max(60).nullable().optional(),
  defaultInstructions: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  allergenGroup: z.string().trim().max(60).nullable().optional(),
  isActive: z.boolean().optional()
});

function mapMedicine(m) {
  return {
    id: m.id,
    name: m.name,
    form: m.form,
    strength: m.strength,
    defaultDosage: m.default_dosage,
    defaultRoute: m.default_route,
    defaultFrequency: m.default_frequency,
    defaultDuration: m.default_duration,
    defaultInstructions: m.default_instructions,
    category: m.category,
    allergenGroup: m.allergen_group,
    isActive: m.is_active
  };
}

router.get('/medicines', requirePermission('prescriptions.view'), asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.includeInactive !== 'true') where = 'WHERE is_active';
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where += `${where ? ' AND' : 'WHERE'} (name ILIKE $1 OR category ILIKE $1 OR strength ILIKE $1)`;
  }
  const { rows } = await query(
    `SELECT * FROM medicines ${where} ORDER BY is_active DESC, category NULLS LAST, name, strength`,
    params
  );
  res.json({ data: rows.map(mapMedicine) });
}));

router.post('/medicines', requirePermission('prescriptions.manage'), asyncHandler(async (req, res) => {
  const body = validate(medicineSchema, req.body);
  const { rows } = await query(
    `INSERT INTO medicines (name, form, strength, default_dosage, default_route, default_frequency, default_duration, default_instructions, category, allergen_group, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [body.name, body.form || null, body.strength || null, body.defaultDosage || null, body.defaultRoute || 'oral',
     body.defaultFrequency || null, body.defaultDuration || null, body.defaultInstructions || null, body.category || null,
     body.allergenGroup || null, body.isActive ?? true]
  );
  await logAudit(null, req, { action: 'medicine.created', entityType: 'medicines', entityId: rows[0].id, details: body });
  res.status(201).json({ data: mapMedicine(rows[0]) });
}));

router.patch('/medicines/:id', requirePermission('prescriptions.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Medicine');
  const body = validate(medicineSchema.partial(), req.body);
  const { rows } = await query(
    `UPDATE medicines SET
       name = COALESCE($2, name), form = COALESCE($3, form), strength = COALESCE($4, strength),
       default_dosage = COALESCE($5, default_dosage), default_route = COALESCE($6, default_route),
       default_frequency = COALESCE($7, default_frequency), default_duration = COALESCE($8, default_duration),
       default_instructions = COALESCE($9, default_instructions), category = COALESCE($10, category),
       allergen_group = COALESCE($11, allergen_group), is_active = COALESCE($12, is_active)
     WHERE id = $1 RETURNING *`,
    [id, body.name ?? null, body.form ?? null, body.strength ?? null, body.defaultDosage ?? null,
     body.defaultRoute ?? null, body.defaultFrequency ?? null, body.defaultDuration ?? null,
     body.defaultInstructions ?? null, body.category ?? null, body.allergenGroup ?? null, body.isActive ?? null]
  );
  if (!rows[0]) throw ApiError.notFound('Medicine not found');
  await logAudit(null, req, { action: 'medicine.updated', entityType: 'medicines', entityId: id, details: body });
  res.json({ data: mapMedicine(rows[0]) });
}));

const templateSchema = z.object({
  name: z.string().trim().min(2, 'Template name is required').max(120),
  category: z.string().trim().max(60).nullable().optional(),
  instructions: z.string().trim().max(2000).nullable().optional(),
  items: z.array(itemSchema).min(1, 'Add at least one medicine'),
  isActive: z.boolean().optional()
});

router.get('/templates', requirePermission('prescriptions.view'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM prescription_templates WHERE is_active ORDER BY category NULLS LAST, name`
  );
  res.json({
    data: rows.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      instructions: t.instructions,
      items: t.items || [],
      isActive: t.is_active,
      createdAt: t.created_at
    }))
  });
}));

router.post('/templates', requirePermission('prescriptions.manage'), asyncHandler(async (req, res) => {
  const body = validate(templateSchema, req.body);
  const { rows } = await query(
    `INSERT INTO prescription_templates (name, category, instructions, items, created_by)
     VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING *`,
    [body.name, body.category || null, body.instructions || null, JSON.stringify(body.items), req.user.id]
  );
  await logAudit(null, req, { action: 'prescription.template_created', entityType: 'prescription_template', entityId: rows[0].id, details: { name: body.name, items: body.items.length } });
  res.status(201).json({ data: { ...rows[0], items: rows[0].items || [] } });
}));

router.patch('/templates/:id', requirePermission('prescriptions.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Prescription template');
  const body = validate(templateSchema.partial(), req.body);
  const { rows } = await query(
    `UPDATE prescription_templates SET
       name = COALESCE($2,name), category = COALESCE($3,category), instructions = COALESCE($4,instructions),
       items = COALESCE($5::jsonb,items), is_active = COALESCE($6,is_active)
     WHERE id = $1 RETURNING *`,
    [id, body.name ?? null, body.category ?? null, body.instructions ?? null, body.items ? JSON.stringify(body.items) : null, body.isActive ?? null]
  );
  if (!rows[0]) throw ApiError.notFound('Prescription template not found');
  await logAudit(null, req, { action: 'prescription.template_updated', entityType: 'prescription_template', entityId: id });
  res.json({ data: { ...rows[0], items: rows[0].items || [] } });
}));

router.delete('/templates/:id', requirePermission('prescriptions.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Prescription template');
  const { rowCount } = await query('DELETE FROM prescription_templates WHERE id = $1', [id]);
  if (!rowCount) throw ApiError.notFound('Prescription template not found');
  await logAudit(null, req, { action: 'prescription.template_deleted', entityType: 'prescription_template', entityId: id });
  res.status(204).end();
}));

router.post('/safety-check', requirePermission('prescriptions.view'), asyncHandler(async (req, res) => {
  const body = validate(z.object({
    patientId: z.string().uuid('Select a patient'),
    items: z.array(itemSchema).min(1, 'Add at least one medicine')
  }), req.body);
  const result = await checkMedicationSafety({ patientId: body.patientId, items: body.items });
  res.json({ data: result });
}));

router.get('/:id', requirePermission('prescriptions.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Prescription');
  const prescription = await fetchPrescription(id, req.user?.clinicId);
  if (!prescription) throw ApiError.notFound('Prescription not found');
  res.json({ data: prescription });
}));

router.get('/:id/pdf', requirePermission('prescriptions.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Prescription');
  const prescription = await fetchPrescription(id, req.user?.clinicId);
  if (!prescription) throw ApiError.notFound('Prescription not found');
  await streamPrescription(prescription, res);
  await logAudit(null, req, { action: 'prescription.printed', entityType: 'prescription', entityId: id, details: { clinicId: req.user?.clinicId } });
}));

async function fetchPrescription(id, clinicId) {
  const { rows } = await query(
    `SELECT p.*, pt.full_name AS patient_name, pt.patient_no, pt.mobile, pt.dob, pt.gender, pt.address, pt.photo_file, pt.photo_data,
            date_part('year', age(pt.dob))::int AS age, u.full_name AS dentist_name,
            c.consultation_no
     FROM prescriptions p
     JOIN patients pt ON pt.id = p.patient_id
     JOIN users u ON u.id = p.dentist_id
     LEFT JOIN consultations c ON c.id = p.consultation_id
     WHERE p.id = $1 ${clinicId ? 'AND (p.clinic_id = $2 OR pt.clinic_id = $2)' : ''}`,
    clinicId ? [id, clinicId] : [id]
  );
  if (!rows[0]) return null;
  const items = await query('SELECT * FROM prescription_items WHERE prescription_id = $1 ORDER BY sort_order, id', [id]);
  const p = mapPrescription(rows[0]);
  p.patient = {
    id: rows[0].patient_id,
    fullName: rows[0].patient_name,
    patientNo: rows[0].patient_no,
    mobile: rows[0].mobile,
    age: rows[0].age,
    gender: rows[0].gender,
    address: rows[0].address,
    hasPhoto: Boolean(rows[0].photo_file || rows[0].photo_data)
  };
  p.consultationNo = rows[0].consultation_no;
  p.items = items.rows.map((i) => ({
    id: i.id,
    medicineName: i.medicine_name,
    dosage: i.dosage,
    route: i.route,
    frequency: i.frequency,
    duration: i.duration,
    instructions: i.instructions
  }));
  return p;
}

function mapPrescription(r) {
  return {
    id: r.id,
    prescriptionNo: r.prescription_no,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientNo: r.patient_no,
    dentistId: r.dentist_id,
    dentistName: r.dentist_name,
    consultationId: r.consultation_id,
    prescriptionDate: r.prescription_date,
    allergiesNoted: r.allergies_noted,
    notes: r.notes,
    followUpDate: r.follow_up_date,
    safetyFlags: r.safety_flags || [],
    safetyOverrideReason: r.safety_override_reason,
    itemCount: r.item_count,
    createdAt: r.created_at
  };
}

export default router;
