import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { logAudit } from '../services/audit.service.js';
import { getClinic } from '../services/clinic.service.js';

const router = Router();
router.use(authenticate);

async function assertLabEnabled(clinicId = null) {
  const clinic = await getClinic(clinicId);
  if (!clinic.labModuleEnabled) throw ApiError.forbidden('The laboratory module is disabled in clinic settings');
}

const labSchema = z.object({
  name: z.string().trim().min(2).max(150),
  contactPerson: z.string().trim().max(150).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(150).nullable().optional().or(z.literal('')),
  address: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional()
});

router.get('/', requirePermission('labs.view'), asyncHandler(async (req, res) => {
  const clinicId = req.user?.clinicId || null;
  const { rows } = await query(
    'SELECT * FROM dental_laboratories WHERE ($1::uuid IS NULL OR clinic_id = $1) ORDER BY is_active DESC, name',
    [clinicId]
  );
  res.json({ data: rows });
}));

router.post('/', requirePermission('labs.manage'), asyncHandler(async (req, res) => {
  const body = validate(labSchema, req.body);
  const clinicId = req.user?.clinicId || null;
  const { rows } = await query(
    `INSERT INTO dental_laboratories (name, contact_person, phone, email, address, clinic_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [body.name, body.contactPerson || null, body.phone || null, body.email || null, body.address || null, clinicId]
  );
  await logAudit(null, req, { action: 'lab.created', entityType: 'dental_laboratory', entityId: rows[0].id, details: body });
  res.status(201).json({ data: rows[0] });
}));

router.patch('/:id', requirePermission('labs.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Laboratory');
  const body = validate(labSchema.partial(), req.body);
  const clinicWhere = req.user?.clinicId ? ' AND clinic_id = $8' : '';
  const params = [id, body.name ?? null, body.contactPerson ?? null, body.phone ?? null, body.email ?? null, body.address ?? null, body.isActive ?? null];
  if (req.user?.clinicId) params.push(req.user.clinicId);
  const { rows } = await query(
    `UPDATE dental_laboratories SET name = COALESCE($2,name), contact_person = COALESCE($3,contact_person),
       phone = COALESCE($4,phone), email = COALESCE($5,email), address = COALESCE($6,address),
       is_active = COALESCE($7,is_active) WHERE id = $1${clinicWhere} RETURNING *`,
    params
  );
  if (!rows[0]) throw ApiError.notFound('Laboratory not found');
  res.json({ data: rows[0] });
}));

router.get('/orders', requirePermission('labs.view'), asyncHandler(async (req, res) => {
  await assertLabEnabled(req.user?.clinicId);
  const where = ['1=1'];
  const params = [];
  if (req.user?.clinicId) {
    params.push(req.user.clinicId);
    where.push(`o.clinic_id = $${params.length}`);
  }
  if (req.query.status) {
    params.push(req.query.status);
    where.push(`o.status = $${params.length}`);
  }
  if (req.query.patientId) {
    params.push(req.query.patientId);
    where.push(`o.patient_id = $${params.length}`);
  }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(o.order_no ILIKE $${params.length} OR pt.full_name ILIKE $${params.length})`);
  }
  const limit = Math.min(200, Number.parseInt(req.query.pageSize, 10) || 100);
  params.push(limit);
  const { rows } = await query(
    `SELECT o.*, pt.full_name AS patient_name, pt.patient_no, l.name AS laboratory_name, u.full_name AS created_by_name
     FROM dental_lab_orders o
     JOIN patients pt ON pt.id = o.patient_id
     JOIN dental_laboratories l ON l.id = o.laboratory_id
     LEFT JOIN users u ON u.id = o.created_by
     WHERE ${where.join(' AND ')}
     ORDER BY o.created_at DESC LIMIT $${params.length}`,
    params
  );
  res.json({ data: rows.map(mapOrder) });
}));

const orderSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  laboratoryId: z.string().uuid('Select a laboratory'),
  treatmentPlanItemId: z.string().uuid().nullable().optional(),
  toothNumber: z.string().trim().max(3).nullable().optional(),
  workType: z.string().trim().min(2, 'Work type is required').max(100),
  sentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
  charge: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['created', 'sent_to_lab', 'in_progress', 'received', 'fitted', 'cancelled']).optional()
});

router.post('/orders', requirePermission('labs.manage'), asyncHandler(async (req, res) => {
  await assertLabEnabled(req.user?.clinicId);
  const body = validate(orderSchema, req.body);
  const patient = await query('SELECT 1 FROM patients WHERE id = $1', [body.patientId]);
  if (!patient.rowCount) throw ApiError.notFound('Patient not found');
  const clinicId = req.user?.clinicId || null;

  const order = await withTransaction(async (client) => {
    const { rows: seq } = await client.query(`SELECT nextval('seq_lab_order') AS n`);
    const orderNo = `LAB-${String(seq[0].n).padStart(6, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO dental_lab_orders (order_no, patient_id, treatment_plan_item_id, tooth_number, laboratory_id,
         work_type, sent_date, expected_date, charge, status, notes, created_by, clinic_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [orderNo, body.patientId, body.treatmentPlanItemId || null, body.toothNumber || null, body.laboratoryId,
        body.workType, body.sentDate || null, body.expectedDate || null, body.charge, body.status || 'created', body.notes || null, req.user.id, clinicId]
    );
    return rows[0];
  });
  await logAudit(null, req, { action: 'lab.order_created', entityType: 'dental_lab_order', entityId: order.id, details: { orderNo: order.order_no, patientId: body.patientId } });
  res.status(201).json({ data: mapOrder(order) });
}));

const orderUpdateSchema = z.object({
  status: z.enum(['created', 'sent_to_lab', 'in_progress', 'received', 'fitted', 'cancelled']).optional(),
  deliveredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
  charge: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(1000).nullable().optional()
});

router.patch('/orders/:id', requirePermission('labs.manage'), asyncHandler(async (req, res) => {
  await assertLabEnabled();
  const id = requireId(req.params.id, 'Lab order');
  const body = validate(orderUpdateSchema, req.body);
  let delivered = body.deliveredDate || null;
  if (body.status === 'received' && !delivered) delivered = new Date().toISOString().slice(0, 10);
  const { rows } = await query(
    `UPDATE dental_lab_orders SET status = COALESCE($2,status), delivered_date = COALESCE($3::date,delivered_date),
       expected_date = COALESCE($4::date,expected_date), charge = COALESCE($5,charge), notes = COALESCE($6,notes)
     WHERE id = $1 RETURNING *`,
    [id, body.status ?? null, delivered, body.expectedDate || null, body.charge ?? null, body.notes ?? null]
  );
  if (!rows[0]) throw ApiError.notFound('Lab order not found');
  await logAudit(null, req, { action: 'lab.order_updated', entityType: 'dental_lab_order', entityId: id, details: body });
  res.json({ data: mapOrder(rows[0]) });
}));

function mapOrder(r) {
  return {
    id: r.id,
    orderNo: r.order_no,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientNo: r.patient_no,
    laboratoryId: r.laboratory_id,
    laboratoryName: r.laboratory_name,
    treatmentPlanItemId: r.treatment_plan_item_id,
    toothNumber: r.tooth_number,
    workType: r.work_type,
    sentDate: r.sent_date,
    expectedDate: r.expected_date,
    deliveredDate: r.delivered_date,
    charge: r.charge,
    status: r.status,
    notes: r.notes,
    createdByName: r.created_by_name,
    createdAt: r.created_at
  };
}

export default router;
