import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate, todayISO } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();
router.use(authenticate);

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const vitalNumber = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.number().min(0).max(1000).optional()
);

const vitalsSchema = z.object({
  bloodPressureSystolic: vitalNumber,
  bloodPressureDiastolic: vitalNumber,
  pulse: vitalNumber,
  temperature: vitalNumber,
  spo2: vitalNumber,
  respiratoryRate: vitalNumber,
  weightKg: vitalNumber,
  heightCm: vitalNumber,
  bloodSugar: vitalNumber,
  notes: z.string().trim().max(1000).nullable().optional()
}).partial();

const createSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  appointmentId: z.string().uuid().nullable().optional(),
  dentistId: z.string().uuid().optional(),
  chiefComplaint: z.string().trim().max(2000).nullable().optional(),
  examinationFindings: z.string().trim().max(8000).nullable().optional(),
  diagnosis: z.string().trim().max(4000).nullable().optional(),
  clinicalNotes: z.string().trim().max(8000).nullable().optional(),
  recommendations: z.string().trim().max(4000).nullable().optional(),
  followUpDate: z.string().regex(DATE).nullable().optional().or(z.literal('')),
  vitals: vitalsSchema.optional()
});

router.get('/', requireAnyPermission('consultations.view', 'patients.view', 'queue.view'), asyncHandler(async (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (req.user?.clinicId) {
    params.push(req.user.clinicId);
    where.push(`(c.clinic_id = $${params.length} OR p.clinic_id = $${params.length})`);
  }
  if (req.query.patientId) {
    params.push(req.query.patientId);
    where.push(`c.patient_id = $${params.length}`);
  }
  if (req.query.dentistId) {
    params.push(req.query.dentistId);
    where.push(`c.dentist_id = $${params.length}`);
  }
  if (DATE.test(req.query.startDate || '')) {
    params.push(req.query.startDate);
    where.push(`c.visit_at >= $${params.length}::date`);
  }
  if (DATE.test(req.query.endDate || '')) {
    params.push(req.query.endDate);
    where.push(`c.visit_at < ($${params.length}::date + interval '1 day')`);
  }
  if (req.query.status && ['draft', 'completed', 'amended'].includes(req.query.status)) {
    params.push(req.query.status);
    where.push(`c.status = $${params.length}`);
  }
  const limit = Math.min(200, Number.parseInt(req.query.pageSize, 10) || 100);
  params.push(limit);
  const { rows } = await query(
    `SELECT c.*, p.full_name AS patient_name, p.patient_no, u.full_name AS dentist_name
     FROM consultations c JOIN patients p ON p.id = c.patient_id JOIN users u ON u.id = c.dentist_id
     WHERE ${where.join(' AND ')}
     ORDER BY c.visit_at DESC LIMIT $${params.length}`,
    params
  );
  res.json({ data: rows.map(mapConsultation) });
}));

router.post('/', requirePermission('consultations.manage'), asyncHandler(async (req, res) => {
  const body = validate(createSchema, req.body);
  const dentistId = req.user.role === 'dentist' ? req.user.id : body.dentistId;
  if (!dentistId) throw ApiError.badRequest('dentistId is required');

  const patient = await query(
    `SELECT 1 FROM patients WHERE id = $1 ${req.user?.clinicId ? 'AND clinic_id = $2' : ''}`,
    req.user?.clinicId ? [body.patientId, req.user.clinicId] : [body.patientId]
  );
  if (!patient.rowCount) throw ApiError.notFound('Patient not found');
  const dentist = await query(
    `SELECT 1 FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND r.code = 'dentist'`,
    [dentistId]
  );
  if (!dentist.rowCount) throw ApiError.badRequest('Selected dentist is not valid');

  const consultation = await withTransaction(async (client) => {
    const { rows: seq } = await client.query(`SELECT nextval('seq_consultation') AS n`);
    const no = `CONS-${String(seq[0].n).padStart(6, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO consultations (consultation_no, patient_id, appointment_id, dentist_id,
         chief_complaint, examination_findings, diagnosis, clinical_notes, recommendations, follow_up_date, vitals, clinic_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        no, body.patientId, body.appointmentId || null, dentistId,
        body.chiefComplaint || null, body.examinationFindings || null, body.diagnosis || null,
        body.clinicalNotes || null, body.recommendations || null, body.followUpDate || null,
        JSON.stringify(body.vitals || {}),
        req.user?.clinicId || null
      ]
    );
    if (body.appointmentId) {
      const { rows: appt } = await client.query('SELECT status FROM appointments WHERE id = $1', [body.appointmentId]);
      if (appt[0] && ['scheduled', 'confirmed', 'checked_in', 'waiting'].includes(appt[0].status)) {
        await client.query(`UPDATE appointments SET status = 'in_consultation', updated_by = $2 WHERE id = $1`, [body.appointmentId, req.user.id]);
        await client.query(
          `INSERT INTO appointment_status_history (appointment_id, from_status, to_status, note, changed_by)
           VALUES ($1,$2,'in_consultation','Consultation started',$3)`,
          [body.appointmentId, appt[0].status, req.user.id]
        );
      }
    }
    return rows[0];
  });

  await logAudit(null, req, { action: 'consultation.created', entityType: 'consultation', entityId: consultation.id, details: { patientId: body.patientId, clinicId: req.user?.clinicId } });
  res.status(201).json({ data: mapConsultation(consultation) });
}));

router.get('/:id', requirePermission('consultations.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Consultation');
  const { rows } = await query(
    `SELECT c.*, p.full_name AS patient_name, p.patient_no, p.dob, p.gender, p.mobile, p.photo_file, p.photo_data,
            date_part('year', age(p.dob))::int AS age, u.full_name AS dentist_name,
            a.appointment_no, a.appointment_date, a.status AS appointment_status,
            (SELECT allergies FROM patient_medical_history h WHERE h.patient_id = c.patient_id AND h.is_current LIMIT 1) AS allergies,
            (SELECT conditions FROM patient_medical_history h WHERE h.patient_id = c.patient_id AND h.is_current LIMIT 1) AS conditions
     FROM consultations c
     JOIN patients p ON p.id = c.patient_id
     JOIN users u ON u.id = c.dentist_id
     LEFT JOIN appointments a ON a.id = c.appointment_id
     WHERE c.id = $1 ${req.user?.clinicId ? 'AND (c.clinic_id = $2 OR p.clinic_id = $2)' : ''}`,
    req.user?.clinicId ? [id, req.user.clinicId] : [id]
  );
  if (!rows[0]) throw ApiError.notFound('Consultation not found');
  const c = rows[0];

  const [amendments, plans, prescriptions] = await Promise.all([
    query(
      `SELECT n.*, u.full_name AS author_name FROM consultation_notes n
       LEFT JOIN users u ON u.id = n.author_id WHERE n.consultation_id = $1 ORDER BY n.created_at`,
      [id]
    ),
    query(
      `SELECT tp.id, tp.plan_no, tp.status, tp.created_at,
              COALESCE(sum(i.total),0) AS estimate,
              count(i.id)::int AS item_count
       FROM treatment_plans tp LEFT JOIN treatment_plan_items i ON i.plan_id = tp.id
       WHERE tp.consultation_id = $1 GROUP BY tp.id ORDER BY tp.created_at DESC`,
      [id]
    ),
    query(
      `SELECT p.id, p.prescription_no, p.prescription_date,
              (SELECT count(*) FROM prescription_items pi WHERE pi.prescription_id = p.id)::int AS item_count
       FROM prescriptions p WHERE p.consultation_id = $1 ORDER BY p.created_at DESC`,
      [id]
    )
  ]);

  res.json({
    data: {
      ...mapConsultation(c),
      patient: {
        id: c.patient_id,
        fullName: c.patient_name,
        patientNo: c.patient_no,
        dob: c.dob,
        age: c.age,
        gender: c.gender,
        mobile: c.mobile,
        hasPhoto: Boolean(c.photo_file || c.photo_data),
        allergies: c.allergies,
        conditions: c.conditions
      },
      appointment: c.appointment_id
        ? { id: c.appointment_id, appointmentNo: c.appointment_no, appointmentDate: c.appointment_date, status: c.appointment_status }
        : null,
      notes: amendments.rows.map((n) => ({ id: n.id, noteType: n.note_type, content: n.content, authorName: n.author_name, createdAt: n.created_at })),
      treatmentPlans: plans.rows,
      prescriptions: prescriptions.rows
    }
  });
}));

const updateSchema = createSchema.partial().omit({ patientId: true, appointmentId: true, dentistId: true });

router.patch('/:id', requirePermission('consultations.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Consultation');
  const body = validate(updateSchema, req.body);
  const { rows: cur } = await query('SELECT * FROM consultations WHERE id = $1', [id]);
  if (!cur[0]) throw ApiError.notFound('Consultation not found');
  if (cur[0].status !== 'draft') {
    throw ApiError.conflict('This consultation is finalized. Use the amendment workflow to correct it.');
  }

  const sets = [];
  const params = [id];
  const map = {
    chiefComplaint: 'chief_complaint', examinationFindings: 'examination_findings',
    diagnosis: 'diagnosis', clinicalNotes: 'clinical_notes', recommendations: 'recommendations',
    followUpDate: 'follow_up_date', vitals: 'vitals'
  };
  for (const [key, col] of Object.entries(map)) {
    if (body[key] === undefined) continue;
    const value = key === 'vitals' ? JSON.stringify(body.vitals || {}) : (body[key] === '' ? null : body[key]);
    params.push(value);
    sets.push(`${col} = $${params.length}${key === 'vitals' ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw ApiError.badRequest('No changes supplied');
  const { rows } = await query(`UPDATE consultations SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
  res.json({ data: mapConsultation(rows[0]) });
}));

router.post('/:id/complete', requirePermission('consultations.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Consultation');
  const { rows: cur } = await query('SELECT * FROM consultations WHERE id = $1', [id]);
  const c = cur[0];
  if (!c) throw ApiError.notFound('Consultation not found');
  if (c.status !== 'draft') throw ApiError.conflict('Consultation is already finalized');
  if (!c.diagnosis || !c.diagnosis.trim()) {
    const defaultDiagnosis = 'General Dental Consultation / Checkup Completed';
    await query(`UPDATE consultations SET diagnosis = $2 WHERE id = $1`, [id, defaultDiagnosis]);
    c.diagnosis = defaultDiagnosis;
  }

  const updated = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE consultations SET status = 'completed', completed_at = now(), completed_by = $2 WHERE id = $1 RETURNING *`,
      [id, req.user.id]
    );
    if (c.appointment_id) {
      const { rows: appt } = await client.query('SELECT status FROM appointments WHERE id = $1', [c.appointment_id]);
      if (appt[0] && appt[0].status !== 'completed') {
        await client.query(`UPDATE appointments SET status = 'completed', updated_by = $2 WHERE id = $1`, [c.appointment_id, req.user.id]);
        await client.query(
          `INSERT INTO appointment_status_history (appointment_id, from_status, to_status, note, changed_by)
           VALUES ($1,$2,'completed','Consultation completed',$3)`,
          [c.appointment_id, appt[0].status, req.user.id]
        );
      }
    }
    return rows[0];
  });

  await logAudit(null, req, { action: 'consultation.completed', entityType: 'consultation', entityId: id });
  res.json({ data: mapConsultation(updated) });
}));

const amendSchema = z.object({
  content: z.string().trim().min(3, 'Describe the amendment').max(4000),
  diagnosis: z.string().trim().max(4000).optional(),
  examinationFindings: z.string().trim().max(8000).optional(),
  clinicalNotes: z.string().trim().max(8000).optional(),
  recommendations: z.string().trim().max(4000).optional()
});

router.post('/:id/amend', requirePermission('consultations.amend'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Consultation');
  const body = validate(amendSchema, req.body);
  const { rows: cur } = await query('SELECT status FROM consultations WHERE id = $1', [id]);
  if (!cur[0]) throw ApiError.notFound('Consultation not found');
  if (cur[0].status === 'draft') throw ApiError.badRequest('Draft consultations can be edited directly');

  const note = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO consultation_notes (consultation_id, note_type, content, author_id)
       VALUES ($1,'amendment',$2,$3) RETURNING *`,
      [id, body.content, req.user.id]
    );
    const sets = [];
    const params = [id];
    for (const [key, col] of Object.entries({ diagnosis: 'diagnosis', examinationFindings: 'examination_findings', clinicalNotes: 'clinical_notes', recommendations: 'recommendations' })) {
      if (body[key] === undefined) continue;
      params.push(body[key]);
      sets.push(`${col} = $${params.length}`);
    }
    if (sets.length) await client.query(`UPDATE consultations SET ${sets.join(', ')}, status = 'amended' WHERE id = $1`, params);
    else await client.query(`UPDATE consultations SET status = 'amended' WHERE id = $1`, [id]);
    return rows[0];
  });

  await logAudit(null, req, { action: 'consultation.amended', entityType: 'consultation', entityId: id, details: { content: body.content } });
  res.status(201).json({ data: note });
}));

function mapConsultation(r) {
  if (!r) return null;
  return {
    id: r.id,
    consultationNo: r.consultation_no,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientNo: r.patient_no,
    appointmentId: r.appointment_id,
    dentistId: r.dentist_id,
    dentistName: r.dentist_name,
    visitAt: r.visit_at,
    chiefComplaint: r.chief_complaint,
    examinationFindings: r.examination_findings,
    diagnosis: r.diagnosis,
    clinicalNotes: r.clinical_notes,
    recommendations: r.recommendations,
    followUpDate: r.follow_up_date,
    vitals: r.vitals || {},
    status: r.status,
    completedAt: r.completed_at,
    createdAt: r.created_at
  };
}

export default router;
