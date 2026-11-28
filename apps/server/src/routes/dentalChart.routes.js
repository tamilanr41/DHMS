import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();
router.use(authenticate);

export const PERMANENT_TEETH = [
  '18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28',
  '48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'
];
export const PRIMARY_TEETH = [
  '55', '54', '53', '52', '51', '61', '62', '63', '64', '65',
  '85', '84', '83', '82', '81', '71', '72', '73', '74', '75'
];

router.get('/conditions', requireAnyPermission('chart.view', 'chart.edit'), asyncHandler(async (req, res) => {
  let { rows } = await query(
    `SELECT id, code, label, color, applies_to, is_system, is_active
     FROM tooth_conditions WHERE is_active ORDER BY is_system DESC, label`
  );

  if (!rows || rows.length === 0) {
    // Auto-seed default clinical tooth conditions if table was cleared
    await query(`
      INSERT INTO tooth_conditions (code, label, color, applies_to, is_system, is_active)
      VALUES
        ('healthy', 'Healthy', '#16a34a', 'both', true, true),
        ('caries', 'Caries / Decay', '#dc2626', 'both', true, true),
        ('missing', 'Missing', '#475569', 'both', true, true),
        ('fractured', 'Fractured / Broken', '#f97316', 'both', true, true),
        ('restored', 'Restored / Filling', '#2563eb', 'both', true, true),
        ('crown', 'Crown (Cap)', '#7c3aed', 'both', true, true),
        ('rct', 'Root Canal Treated', '#0891b2', 'permanent', true, true),
        ('extraction_required', 'Extraction Required', '#b91c1c', 'both', true, true),
        ('impacted', 'Impacted', '#a16207', 'both', true, true),
        ('sensitive', 'Sensitive', '#ca8a04', 'both', true, true),
        ('under_treatment', 'Under Treatment', '#0d9488', 'both', true, true),
        ('implant', 'Dental Implant', '#0f766e', 'both', true, true),
        ('bridge', 'Bridge / Pontic', '#6d28d9', 'both', true, true),
        ('veneer', 'Aesthetic Veneer', '#c026d3', 'both', true, true),
        ('sealant', 'Pit & Fissure Sealant', '#0ea5e9', 'both', true, true),
        ('inlay', 'Inlay / Onlay', '#1d4ed8', 'both', true, true),
        ('post_core', 'Post & Core', '#7e22ce', 'both', true, true),
        ('gingivitis', 'Gingivitis', '#f43f5e', 'both', true, true),
        ('periodontitis', 'Periodontitis', '#be123c', 'both', true, true),
        ('abscess', 'Periapical Abscess', '#dc2626', 'both', true, true),
        ('attrition', 'Attrition / Wear', '#a8a29e', 'both', true, true),
        ('erosion', 'Erosion', '#d97706', 'both', true, true),
        ('abrasion', 'Abrasion', '#b45309', 'both', true, true),
        ('discoloured', 'Discoloured', '#a855f7', 'both', true, true),
        ('supernumerary', 'Supernumerary', '#0284c7', 'both', true, true),
        ('retained_root', 'Retained Root', '#78716c', 'both', true, true),
        ('trauma', 'Dental Trauma', '#ea580c', 'both', true, true),
        ('space_maintainer', 'Space Maintainer', '#0891b2', 'primary', true, true),
        ('other', 'Other Finding', '#64748b', 'both', true, true)
      ON CONFLICT (code) DO NOTHING
    `);
    const seeded = await query(
      `SELECT id, code, label, color, applies_to, is_system, is_active
       FROM tooth_conditions WHERE is_active ORDER BY is_system DESC, label`
    );
    rows = seeded.rows;
  }

  res.json({ data: rows });
}));

const conditionSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscore'),
  label: z.string().trim().min(2).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour'),
  appliesTo: z.enum(['both', 'permanent', 'primary']).optional()
});

router.post('/conditions', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const body = validate(conditionSchema, req.body);
  const { rows } = await query(
    `INSERT INTO tooth_conditions (code, label, color, applies_to, is_system)
     VALUES ($1,$2,$3,$4,false) RETURNING *`,
    [body.code, body.label, body.color, body.appliesTo || 'both']
  );
  await logAudit(null, req, { action: 'chart.condition_created', entityType: 'tooth_condition', entityId: rows[0].id, details: body });
  res.status(201).json({ data: rows[0] });
}));

router.get('/patients/:patientId', requirePermission('chart.view'), asyncHandler(async (req, res) => {
  const patientId = requireId(req.params.patientId, 'Patient');
  const { rows } = await query(
    `SELECT r.*, tc.label AS condition_label, tc.color AS condition_color, u.full_name AS recorded_by_name,
            (SELECT count(*) FROM dental_chart_records h WHERE h.patient_id = r.patient_id AND h.tooth_number = r.tooth_number)::int AS history_count
     FROM dental_chart_records r
     JOIN tooth_conditions tc ON tc.code = r.condition_code
     LEFT JOIN users u ON u.id = r.recorded_by
     WHERE r.patient_id = $1 AND r.is_current
     ORDER BY r.tooth_number`,
    [patientId]
  );

  // Tooth-linked treatment items are surfaced alongside chart findings so the
  // odontogram can distinguish a diagnosis from proposed and completed care.
  const { rows: treatmentRows } = await query(
    `SELECT i.id, i.tooth_number, i.treatment_name, i.status, i.quantity, i.total,
            i.completed_at, i.notes, tp.id AS plan_id, tp.plan_no, tp.status AS plan_status
     FROM treatment_plan_items i
     JOIN treatment_plans tp ON tp.id = i.plan_id
     WHERE tp.patient_id = $1
       AND tp.status <> 'cancelled'
       AND i.status <> 'cancelled'
       AND i.tooth_number IS NOT NULL
     ORDER BY i.tooth_number, i.sort_order, i.created_at`,
    [patientId]
  );

  const { rows: perioRows } = await query(
    `SELECT pr.*, u.full_name AS recorded_by_name
     FROM periodontal_records pr
     LEFT JOIN users u ON u.id = pr.recorded_by
     WHERE pr.patient_id = $1 AND pr.is_current
     ORDER BY pr.tooth_number`,
    [patientId]
  );

  res.json({
    data: {
      permanent: rows.filter((r) => r.dentition === 'permanent').map(mapRecord),
      primary: rows.filter((r) => r.dentition === 'primary').map(mapRecord),
      treatments: treatmentRows.map(mapToothTreatment),
      periodontal: perioRows.map(mapPerio)
    }
  });
}));

const perioSchema = z.object({
  toothNumber: z.string().trim().min(2).max(2),
  dentition: z.enum(['permanent', 'primary']).default('permanent'),
  probingDepths: z.record(z.coerce.number().int().min(0).max(15)).optional(),
  recession: z.record(z.coerce.number().int().min(-5).max(15)).optional(),
  mobility: z.coerce.number().int().min(0).max(3).default(0),
  furcation: z.enum(['none', 'class_i', 'class_ii', 'class_iii']).default('none'),
  bleedingOnProbing: z.boolean().optional(),
  suppuration: z.boolean().optional(),
  plaque: z.boolean().optional(),
  calculus: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  consultationId: z.string().uuid().nullable().optional()
});

router.get('/patients/:patientId/periodontal', requirePermission('chart.view'), asyncHandler(async (req, res) => {
  const patientId = requireId(req.params.patientId, 'Patient');
  const { rows } = await query(
    `SELECT pr.*, u.full_name AS recorded_by_name FROM periodontal_records pr
     LEFT JOIN users u ON u.id = pr.recorded_by
     WHERE pr.patient_id = $1 AND pr.is_current ORDER BY pr.tooth_number`,
    [patientId]
  );
  res.json({ data: rows.map(mapPerio) });
}));

router.post('/patients/:patientId/periodontal', requirePermission('chart.edit'), asyncHandler(async (req, res) => {
  const patientId = requireId(req.params.patientId, 'Patient');
  const body = validate(perioSchema, req.body);
  const allowed = body.dentition === 'permanent' ? PERMANENT_TEETH : PRIMARY_TEETH;
  if (!allowed.includes(body.toothNumber)) {
    throw ApiError.unprocessable(`Tooth ${body.toothNumber} is not valid for ${body.dentition} dentition`);
  }
  const patient = await query('SELECT 1 FROM patients WHERE id = $1', [patientId]);
  if (!patient.rowCount) throw ApiError.notFound('Patient not found');

  const record = await withTransaction(async (client) => {
    await client.query(
      `UPDATE periodontal_records SET is_current = false, superseded_at = now(), superseded_by = $4
       WHERE patient_id = $1 AND tooth_number = $2 AND dentition = $3 AND is_current`,
      [patientId, body.toothNumber, body.dentition, req.user.id]
    );
    const { rows } = await client.query(
      `INSERT INTO periodontal_records
         (patient_id, tooth_number, dentition, probing_depths, recession, mobility, furcation,
          bleeding_on_probing, suppuration, plaque, calculus, notes, consultation_id, recorded_by)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        patientId, body.toothNumber, body.dentition,
        JSON.stringify(body.probingDepths || {}), JSON.stringify(body.recession || {}),
        body.mobility, body.furcation, Boolean(body.bleedingOnProbing), Boolean(body.suppuration),
        Boolean(body.plaque), Boolean(body.calculus), body.notes || null, body.consultationId || null, req.user.id
      ]
    );
    return rows[0];
  });

  await logAudit(null, req, {
    action: 'chart.periodontal_recorded',
    entityType: 'periodontal_record',
    entityId: record.id,
    details: { patientId, tooth: body.toothNumber, mobility: body.mobility, furcation: body.furcation }
  });
  const { rows } = await query(
    `SELECT pr.*, u.full_name AS recorded_by_name FROM periodontal_records pr
     LEFT JOIN users u ON u.id = pr.recorded_by WHERE pr.id = $1`,
    [record.id]
  );
  res.status(201).json({ data: mapPerio(rows[0]) });
}));

const recordSchema = z.object({
  toothNumber: z.string().trim().min(2).max(2),
  dentition: z.enum(['permanent', 'primary']).default('permanent'),
  conditionCode: z.string().trim().min(2).max(50),
  surface: z.string().trim().max(30).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  consultationId: z.string().uuid().nullable().optional(),
  treatmentPlanItemId: z.string().uuid().nullable().optional()
});

router.post('/patients/:patientId', requirePermission('chart.edit'), asyncHandler(async (req, res) => {
  const patientId = requireId(req.params.patientId, 'Patient');
  const body = validate(recordSchema, req.body);
  const allowed = body.dentition === 'permanent' ? PERMANENT_TEETH : PRIMARY_TEETH;
  if (!allowed.includes(body.toothNumber)) {
    throw ApiError.unprocessable(`Tooth ${body.toothNumber} is not valid for ${body.dentition} dentition`);
  }
  const patient = await query('SELECT 1 FROM patients WHERE id = $1', [patientId]);
  if (!patient.rowCount) throw ApiError.notFound('Patient not found');
  const condition = await query('SELECT code, applies_to FROM tooth_conditions WHERE code = $1 AND is_active', [body.conditionCode]);
  if (!condition.rowCount) throw ApiError.badRequest('Unknown tooth condition');
  if (condition.rows[0].applies_to !== 'both' && condition.rows[0].applies_to !== body.dentition) {
    throw ApiError.badRequest(`Condition not applicable to ${body.dentition} dentition`);
  }

  const record = await withTransaction(async (client) => {
    await client.query(
      `UPDATE dental_chart_records
       SET is_current = false, superseded_at = now(), superseded_by = $4
       WHERE patient_id = $1 AND tooth_number = $2 AND dentition = $3 AND is_current`,
      [patientId, body.toothNumber, body.dentition, req.user.id]
    );
    const { rows } = await client.query(
      `INSERT INTO dental_chart_records
         (patient_id, tooth_number, dentition, condition_code, surface, notes, consultation_id, treatment_plan_item_id, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [patientId, body.toothNumber, body.dentition, body.conditionCode, body.surface || null, body.notes || null, body.consultationId || null, body.treatmentPlanItemId || null, req.user.id]
    );
    return rows[0];
  });

  await logAudit(null, req, {
    action: 'chart.finding_recorded',
    entityType: 'dental_chart_record',
    entityId: record.id,
    details: { patientId, tooth: body.toothNumber, condition: body.conditionCode }
  });
  const { rows: enriched } = await query(
    `SELECT r.*, tc.label AS condition_label, tc.color AS condition_color, u.full_name AS recorded_by_name
     FROM dental_chart_records r JOIN tooth_conditions tc ON tc.code = r.condition_code
     LEFT JOIN users u ON u.id = r.recorded_by WHERE r.id = $1`,
    [record.id]
  );
  res.status(201).json({ data: mapRecord(enriched[0]) });
}));

router.get('/patients/:patientId/teeth/:toothNumber/history', requirePermission('chart.view'), asyncHandler(async (req, res) => {
  const patientId = requireId(req.params.patientId, 'Patient');
  const tooth = String(req.params.toothNumber);
  const { rows } = await query(
    `SELECT r.*, tc.label AS condition_label, tc.color AS condition_color, u.full_name AS recorded_by_name,
            s.full_name AS superseded_by_name
     FROM dental_chart_records r
     JOIN tooth_conditions tc ON tc.code = r.condition_code
     LEFT JOIN users u ON u.id = r.recorded_by
     LEFT JOIN users s ON s.id = r.superseded_by
     WHERE r.patient_id = $1 AND r.tooth_number = $2
     ORDER BY r.recorded_at DESC`,
    [patientId, tooth]
  );
  res.json({ data: rows.map(mapRecord) });
}));

function mapToothTreatment(r) {
  const toothNumber = String(r.tooth_number);
  return {
    id: r.id,
    toothNumber,
    dentition: /^[5-8]/.test(toothNumber) ? 'primary' : 'permanent',
    treatmentName: r.treatment_name,
    status: r.status,
    quantity: Number(r.quantity),
    total: Number(r.total),
    completedAt: r.completed_at,
    notes: r.notes,
    planId: r.plan_id,
    planNo: r.plan_no,
    planStatus: r.plan_status
  };
}

function mapPerio(r) {
  return {
    id: r.id,
    patientId: r.patient_id,
    toothNumber: r.tooth_number,
    dentition: r.dentition,
    probingDepths: r.probing_depths || {},
    recession: r.recession || {},
    mobility: Number(r.mobility || 0),
    furcation: r.furcation || 'none',
    bleedingOnProbing: Boolean(r.bleeding_on_probing),
    suppuration: Boolean(r.suppuration),
    plaque: Boolean(r.plaque),
    calculus: Boolean(r.calculus),
    notes: r.notes,
    consultationId: r.consultation_id,
    recordedByName: r.recorded_by_name,
    recordedAt: r.recorded_at
  };
}

function mapRecord(r) {
  return {
    id: r.id,
    patientId: r.patient_id,
    toothNumber: r.tooth_number,
    dentition: r.dentition,
    conditionCode: r.condition_code,
    conditionLabel: r.condition_label,
    conditionColor: r.condition_color,
    surface: r.surface,
    notes: r.notes,
    isCurrent: r.is_current,
    consultationId: r.consultation_id,
    treatmentPlanItemId: r.treatment_plan_item_id,
    recordedByName: r.recorded_by_name,
    recordedAt: r.recorded_at,
    supersededAt: r.superseded_at,
    historyCount: r.history_count
  };
}

export default router;
