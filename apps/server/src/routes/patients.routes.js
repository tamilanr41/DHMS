import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate, parsePagination, paginatedMeta, todayISO } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { formatIndian, toPaise, fromPaise } from '../utils/money.js';
import { authenticate, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { uploadDocument, uploadPatientPhoto, uploadClinicalPhoto, DATA_DIRS } from '../middleware/upload.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();
router.use(authenticate);

const patientSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(150),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD').nullable().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  mobile: z.string().trim().min(7, 'Mobile number is required').max(20).regex(/^[0-9+\-\s()]+$/, 'Invalid mobile number'),
  alternateMobile: z.string().trim().max(20).regex(/^[0-9+\-\s()]*$/, 'Invalid alternate mobile number').nullable().optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email').max(150).nullable().optional().or(z.literal('')),
  address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  state: z.string().trim().max(80).nullable().optional(),
  pincode: z.string().trim().regex(/^[0-9]{4,10}$/, 'PIN code must be 4–10 digits').nullable().optional().or(z.literal('')),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).nullable().optional().or(z.literal('')),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed', 'other']).nullable().optional().or(z.literal('')),
  occupation: z.string().trim().max(120).nullable().optional(),
  idProofType: z.enum(['aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'ration_card', 'other']).nullable().optional().or(z.literal('')),
  idProofNumber: z.string().trim().max(40).nullable().optional(),
  emergencyContactName: z.string().trim().max(150).nullable().optional(),
  emergencyContactRelation: z.string().trim().max(60).nullable().optional(),
  emergencyContactPhone: z.string().trim().max(30).nullable().optional(),
  referredBy: z.string().trim().max(150).nullable().optional(),
  insuranceProvider: z.string().trim().max(120).nullable().optional(),
  insurancePolicyNo: z.string().trim().max(80).nullable().optional(),
  dataConsent: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  confirmDuplicate: z.boolean().optional()
});

router.get('/', requirePermission('patients.view'), asyncHandler(async (req, res) => {
  const { page, pageSize, offset, limit } = parsePagination(req.query);
  const q = String(req.query.q || '').trim();
  const where = [];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    where.push(`(p.full_name ILIKE $${params.length} OR p.mobile ILIKE $${params.length} OR p.patient_no ILIKE $${params.length})`);
  }
  if (req.query.isActive === 'true' || req.query.isActive === 'false') {
    params.push(req.query.isActive === 'true');
    where.push(`p.is_active = $${params.length}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.dateFrom || '')) {
    params.push(req.query.dateFrom);
    where.push(`p.created_at >= $${params.length}::date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.dateTo || '')) {
    params.push(req.query.dateTo);
    where.push(`p.created_at < ($${params.length}::date + interval '1 day')`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortMap = { name: 'p.full_name', patientNo: 'p.patient_no', createdAt: 'p.created_at', balance: 'outstanding' };
  const sort = sortMap[req.query.sort] || 'p.created_at';
  const order = String(req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const countQ = await query(`SELECT count(*) AS total FROM patients p ${whereSql}`, params);
  params.push(limit, offset);
  const { rows } = await query(
    `SELECT p.*, date_part('year', age(p.dob))::int AS age,
            COALESCE((SELECT sum(i.outstanding_balance) FROM invoices i
                      WHERE i.patient_id = p.id AND i.status NOT IN ('void','draft')), 0) AS outstanding,
            (SELECT max(c.visit_at) FROM consultations c WHERE c.patient_id = p.id) AS last_visit,
            (SELECT count(*) FROM consultations c WHERE c.patient_id = p.id)::int AS visit_count,
            (SELECT min(a.appointment_date)::text FROM appointments a
              WHERE a.patient_id = p.id AND a.appointment_date >= CURRENT_DATE
                AND a.status IN ('scheduled','confirmed','checked_in')) AS next_appointment_date,
            (SELECT a.start_time::text FROM appointments a
              WHERE a.patient_id = p.id AND a.appointment_date >= CURRENT_DATE
                AND a.status IN ('scheduled','confirmed','checked_in')
              ORDER BY a.appointment_date, a.start_time LIMIT 1) AS next_appointment_time
     FROM patients p
     ${whereSql}
     ORDER BY ${sort} ${order} NULLS LAST
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ data: rows.map(mapPatient), meta: paginatedMeta(countQ.rows[0].total, page, pageSize) });
}));

router.get('/search', requirePermission('patients.view'), asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ data: [] });
  const { rows } = await query(
    `SELECT id, patient_no, full_name, mobile, dob, gender, photo_file, photo_data
     FROM patients
     WHERE full_name ILIKE $1 OR mobile ILIKE $1 OR patient_no ILIKE $1
     ORDER BY is_active DESC, full_name LIMIT 10`,
    [`%${q}%`]
  );
  res.json({
    data: rows.map((r) => ({
      id: r.id,
      patientNo: r.patient_no,
      fullName: r.full_name,
      mobile: r.mobile,
      dob: r.dob,
      gender: r.gender,
      hasPhoto: Boolean(r.photo_file || r.photo_data)
    }))
  });
}));

router.post('/', requirePermission('patients.create'), asyncHandler(async (req, res) => {
  const body = validate(patientSchema, req.body);

  const dupes = await findDuplicates(body);
  if (dupes.length && !body.confirmDuplicate) {
    throw new ApiError(409, 'Possible duplicate patient found. Review before creating.', {
      code: 'POSSIBLE_DUPLICATE',
      details: { duplicates: dupes }
    });
  }

  const patient = await withTransaction(async (client) => {
    const { rows: setting } = await client.query('SELECT patient_prefix FROM clinic_settings WHERE id = 1');
    const prefix = setting[0]?.patient_prefix || 'P';
    const { rows: seq } = await client.query(`SELECT nextval('seq_patient') AS n`);
    const patientNo = `${prefix}${String(seq[0].n).padStart(6, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO patients (
         patient_no, full_name, dob, gender, mobile, email, address, city, state, pincode,
         blood_group, marital_status, occupation, alternate_mobile,
         id_proof_type, id_proof_number,
         emergency_contact_name, emergency_contact_relation, emergency_contact_phone,
         referred_by, insurance_provider, insurance_policy_no,
         notes, data_consent, data_consent_at, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$26)
       RETURNING *`,
      [
        patientNo, body.fullName, body.dob || null, body.gender || null, body.mobile,
        body.email || null, body.address || null, body.city || null, body.state || null, body.pincode || null,
        body.bloodGroup || null, body.maritalStatus || null, body.occupation || null, body.alternateMobile || null,
        body.idProofType || null, body.idProofNumber || null,
        body.emergencyContactName || null, body.emergencyContactRelation || null, body.emergencyContactPhone || null,
        body.referredBy || null, body.insuranceProvider || null, body.insurancePolicyNo || null,
        body.notes || null, Boolean(body.dataConsent), body.dataConsent ? new Date() : null,
        req.user.id
      ]
    );
    return rows[0];
  });

  await logAudit(null, req, {
    action: 'patient.created',
    entityType: 'patient',
    entityId: patient.id,
    details: { patientNo: patient.patient_no, name: patient.full_name, duplicateConfirmed: Boolean(dupes.length) }
  });
  res.status(201).json({ data: mapPatient(patient) });
}));

const kioskCheckinSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is required').max(150),
  mobile: z.string().trim().min(7, 'Mobile is required').max(20).regex(/^[0-9+\-\s()]+$/, 'Invalid mobile number'),
  age: z.coerce.number().int().min(1).max(120).optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  primaryComplaint: z.string().trim().max(500).optional().nullable(),
  medicalAlerts: z.array(z.string()).optional()
});

router.post('/kiosk-checkin', asyncHandler(async (req, res) => {
  const body = validate(kioskCheckinSchema, req.body);
  const cleanMobile = body.mobile.replace(/\D/g, '').slice(-10);

  // Check if patient exists by matching the last 10 digits
  const existing = await query(
    `SELECT p.*, (SELECT count(*) FROM consultations c WHERE c.patient_id = p.id)::int AS visit_count
     FROM patients p
     WHERE right(regexp_replace(p.mobile, '[^0-9]', '', 'g'), 10) = $1
     ORDER BY p.created_at LIMIT 1`,
    [cleanMobile]
  );

  let patient = existing.rows[0];
  let isNew = false;

  if (!patient) {
    isNew = true;
    let dob = null;
    if (body.age) {
      const year = new Date().getFullYear() - body.age;
      dob = `${year}-01-01`;
    }

    patient = await withTransaction(async (client) => {
      const { rows: setting } = await client.query('SELECT patient_prefix FROM clinic_settings WHERE id = 1');
      const prefix = setting[0]?.patient_prefix || 'P';
      const { rows: seq } = await client.query(`SELECT nextval('seq_patient') AS n`);
      const patientNo = `${prefix}${String(seq[0].n).padStart(6, '0')}`;
      const notes = [
        body.primaryComplaint ? `Kiosk Complaint: ${body.primaryComplaint}` : null,
        body.medicalAlerts?.length ? `Self-reported alerts: ${body.medicalAlerts.join(', ')}` : null
      ].filter(Boolean).join(' | ');

      const { rows } = await client.query(
        `INSERT INTO patients (patient_no, full_name, dob, gender, mobile, notes, data_consent, data_consent_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, true, now(), $7, $7)
         RETURNING *`,
        [patientNo, body.fullName, dob, body.gender || null, body.mobile, notes || null, req.user?.id || (await query('SELECT id FROM users LIMIT 1')).rows[0].id]
      );
      return rows[0];
    });
    patient.visit_count = 0;
  }

  // Find treating dentist for today
  const doctor = await query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'dentist' AND u.is_active ORDER BY u.full_name LIMIT 1`
  );
  const dentistId = doctor.rows[0]?.id || req.user?.id || (await query('SELECT id FROM users LIMIT 1')).rows[0].id;

  const today = todayISO();
  const now = new Date();
  const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
  const endTime = `${String(now.getHours() + (now.getMinutes() >= 30 ? 1 : 0)).padStart(2, '0')}:${String((now.getMinutes() + 30) % 60).padStart(2, '0')}:00`;
  const apptNo = `APT-${Date.now().toString().slice(-6)}`;

  // Find queue count for today to determine Token number
  const qCount = await query(
    `SELECT count(*)::int AS c FROM appointments WHERE appointment_date = $1`,
    [today]
  );
  const tokenNum = (qCount.rows[0]?.c || 0) + 1;
  const tokenStr = `TK-${String(tokenNum).padStart(2, '0')}`;

  const { rows: apptRows } = await query(
    `INSERT INTO appointments (appointment_no, patient_id, dentist_id, appointment_date, start_time, end_time, appointment_type, reason, booking_source, status, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'consultation', $7, 'kiosk', 'checked_in', $8, $9, $9)
     RETURNING *`,
    [apptNo, patient.id, dentistId, today, startTime, endTime, body.primaryComplaint || 'Walk-in Dental Checkup', `Queue Token: ${tokenStr}`, req.user?.id || dentistId]
  );

  await query(
    `INSERT INTO appointment_status_history (appointment_id, from_status, to_status, note, changed_by)
     VALUES ($1, NULL, 'checked_in', 'Kiosk Self Check-in', $2)`,
    [apptRows[0].id, req.user?.id || dentistId]
  );

  res.status(201).json({
    data: {
      patient: mapPatient(patient),
      appointment: apptRows[0],
      tokenNumber: tokenStr,
      isNewPatient: isNew || ((patient.visit_count ?? 0) <= 0),
      visitCount: patient.visit_count || (isNew ? 0 : 1),
      queuePosition: tokenNum
    }
  });
}));

router.get('/:id', requirePermission('patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query(
    `SELECT p.*, date_part('year', age(p.dob))::int AS age,
            COALESCE((SELECT sum(i.outstanding_balance) FROM invoices i
                      WHERE i.patient_id = p.id AND i.status NOT IN ('void','draft')), 0) AS outstanding,
            (SELECT max(visit_at) FROM consultations c WHERE c.patient_id = p.id) AS last_visit,
            (SELECT count(*) FROM consultations c WHERE c.patient_id = p.id)::int AS visit_count,
            (SELECT allergies FROM patient_medical_history h WHERE h.patient_id = p.id AND h.is_current LIMIT 1) AS allergies,
            (SELECT conditions FROM patient_medical_history h WHERE h.patient_id = p.id AND h.is_current LIMIT 1) AS conditions
     FROM patients p WHERE p.id = $1`,
    [id]
  );
  if (!rows[0]) throw ApiError.notFound('Patient not found');
  const patient = mapPatient(rows[0]);
  patient.lastVisit = rows[0].last_visit;
  patient.visitCount = rows[0].visit_count;
  res.json({ data: patient });
}));

router.patch('/:id', requirePermission('patients.edit'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const body = validate(patientSchema.partial(), req.body);
  const sets = [];
  const params = [id];
  const map = {
    fullName: 'full_name', dob: 'dob', gender: 'gender', mobile: 'mobile',
    alternateMobile: 'alternate_mobile', email: 'email',
    address: 'address', city: 'city', state: 'state', pincode: 'pincode',
    bloodGroup: 'blood_group', maritalStatus: 'marital_status', occupation: 'occupation',
    idProofType: 'id_proof_type', idProofNumber: 'id_proof_number',
    emergencyContactName: 'emergency_contact_name',
    emergencyContactRelation: 'emergency_contact_relation',
    emergencyContactPhone: 'emergency_contact_phone',
    referredBy: 'referred_by',
    insuranceProvider: 'insurance_provider', insurancePolicyNo: 'insurance_policy_no',
    notes: 'notes', isActive: 'is_active'
  };
  for (const [key, col] of Object.entries(map)) {
    if (body[key] === undefined) continue;
    params.push(body[key] === '' ? null : body[key]);
    sets.push(`${col} = $${params.length}`);
  }
  if (body.dataConsent !== undefined) {
    params.push(Boolean(body.dataConsent));
    sets.push(`data_consent = $${params.length}`);
    sets.push(`data_consent_at = CASE WHEN $${params.length} THEN COALESCE(data_consent_at, now()) ELSE NULL END`);
  }
  if (!sets.length) throw ApiError.badRequest('No changes supplied');
  params.push(req.user.id);
  const { rows } = await query(
    `UPDATE patients SET ${sets.join(', ')}, updated_by = $${params.length} WHERE id = $1 RETURNING *`,
    params
  );
  if (!rows[0]) throw ApiError.notFound('Patient not found');
  await logAudit(null, req, { action: 'patient.updated', entityType: 'patient', entityId: id, details: body });
  res.json({ data: mapPatient(rows[0]) });
}));

/* ---------- profile photo ---------- */
router.get('/:id/photo', requirePermission('patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query('SELECT photo_file, photo_data FROM patients WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Patient not found');
  if (!rows[0].photo_file && !rows[0].photo_data) {
    const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><circle cx="64" cy="64" r="64" fill="#E2E8F0"/><circle cx="64" cy="48" r="24" fill="#94A3B8"/><path d="M24 104 C24 84, 40 76, 64 76 C88 76, 104 84, 104 104 Z" fill="#94A3B8"/></svg>`;
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.type('image/svg+xml').send(defaultSvg);
  }

  res.setHeader('Cache-Control', 'private, max-age=300');

  // 1. Direct from PostgreSQL database
  if (rows[0].photo_data) {
    const parts = rows[0].photo_data.split(',');
    const mimeMatch = parts[0]?.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const buffer = Buffer.from(parts[1] || parts[0], 'base64');
    res.type(mime);
    return res.send(buffer);
  }

  // 2. Disk fallback with multiple directory resolution
  const filename = path.basename(rows[0].photo_file);
  const candidates = [
    path.join(DATA_DIRS.photos, filename),
    path.resolve('data/photos', filename),
    path.resolve('release/server/ZhanX-DentalCare-Server-1.0.0/data/photos', filename)
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><circle cx="64" cy="64" r="64" fill="#E2E8F0"/><circle cx="64" cy="48" r="24" fill="#94A3B8"/><path d="M24 104 C24 84, 40 76, 64 76 C88 76, 104 84, 104 104 Z" fill="#94A3B8"/></svg>`;
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.type('image/svg+xml').send(defaultSvg);
  }

  // Auto-sync into DB for permanent persistence
  try {
    const ext = path.extname(found).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const b64 = `data:${mime};base64,${fs.readFileSync(found).toString('base64')}`;
    query('UPDATE patients SET photo_data = $1 WHERE id = $2', [b64, id]).catch(() => {});
  } catch {}

  res.sendFile(found);
}));

router.post('/:id/photo', requirePermission('patients.edit'), uploadPatientPhoto.single('photo'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  if (!req.file) throw ApiError.badRequest('No photo uploaded');
  const { rows } = await query('SELECT photo_file FROM patients WHERE id = $1', [id]);
  if (!rows[0]) {
    fs.unlink(req.file.path, () => {});
    throw ApiError.notFound('Patient not found');
  }

  // Convert uploaded image to base64 for permanent DB storage
  let photoData = null;
  try {
    const ext = path.extname(req.file.originalname || req.file.path).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    photoData = `data:${mime};base64,${fs.readFileSync(req.file.path).toString('base64')}`;
  } catch {}

  await query('UPDATE patients SET photo_file = $2, photo_data = $3, updated_by = $4 WHERE id = $1', [
    id,
    req.file.filename,
    photoData,
    req.user.id
  ]);
  if (rows[0].photo_file) {
    const oldPath = path.join(DATA_DIRS.photos, path.basename(rows[0].photo_file));
    if (oldPath !== req.file.path && fs.existsSync(oldPath)) fs.unlink(oldPath, () => {});
  }
  await logAudit(null, req, {
    action: 'patient.photo_updated',
    entityType: 'patient',
    entityId: id,
    details: { fileName: req.file.originalname, replaced: Boolean(rows[0].photo_file) }
  });
  res.status(201).json({ data: { ok: true } });
}));

router.delete('/:id/photo', requirePermission('patients.edit'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query('SELECT photo_file FROM patients WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Patient not found');
  await query('UPDATE patients SET photo_file = NULL, photo_data = NULL, updated_by = $2 WHERE id = $1', [id, req.user.id]);
  if (rows[0].photo_file) {
    const filePath = path.join(DATA_DIRS.photos, path.basename(rows[0].photo_file));
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
  }
  await logAudit(null, req, { action: 'patient.photo_removed', entityType: 'patient', entityId: id });
  res.json({ data: { ok: true } });
}));

/* ---------- medical history ---------- */
router.get('/:id/medical-history', requireAnyPermission('patients.medical.view', 'patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const current = await query(
    `SELECT h.*, u.full_name AS recorded_by_name FROM patient_medical_history h
     LEFT JOIN users u ON u.id = h.recorded_by
     WHERE h.patient_id = $1 AND h.is_current LIMIT 1`,
    [id]
  );
  const history = await query(
    `SELECT h.id, h.created_at, h.is_current, u.full_name AS recorded_by_name
     FROM patient_medical_history h LEFT JOIN users u ON u.id = h.recorded_by
     WHERE h.patient_id = $1 ORDER BY h.created_at DESC`,
    [id]
  );
  res.json({ data: { current: mapMedicalHistory(current.rows[0]), history: history.rows } });
}));

const medicalSchema = z.object({
  conditions: z.string().max(4000).nullable().optional(),
  allergies: z.string().max(4000).nullable().optional(),
  medications: z.string().max(4000).nullable().optional(),
  surgicalHistory: z.string().max(4000).nullable().optional(),
  dentalHistory: z.string().max(4000).nullable().optional(),
  previousTreatments: z.string().max(4000).nullable().optional(),
  clinicianNotes: z.string().max(4000).nullable().optional(),
  consentConfirmed: z.boolean().optional()
});

router.post('/:id/medical-history', requirePermission('patients.medical.edit'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const body = validate(medicalSchema, req.body);
  const exists = await query('SELECT 1 FROM patients WHERE id = $1', [id]);
  if (!exists.rowCount) throw ApiError.notFound('Patient not found');

  const record = await withTransaction(async (client) => {
    await client.query('UPDATE patient_medical_history SET is_current = false WHERE patient_id = $1 AND is_current', [id]);
    const { rows } = await client.query(
      `INSERT INTO patient_medical_history
         (patient_id, conditions, allergies, medications, surgical_history, dental_history,
          previous_treatments, clinician_notes, consent_confirmed, consent_confirmed_by, consent_confirmed_at, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        id, body.conditions || null, body.allergies || null, body.medications || null,
        body.surgicalHistory || null, body.dentalHistory || null, body.previousTreatments || null,
        body.clinicianNotes || null, body.consentConfirmed ?? false,
        body.consentConfirmed ? req.user.id : null, body.consentConfirmed ? new Date() : null, req.user.id
      ]
    );
    return rows[0];
  });
  await logAudit(null, req, { action: 'patient.medical_history_recorded', entityType: 'patient', entityId: id });
  res.status(201).json({ data: mapMedicalHistory(record) });
}));

/* ---------- related records ---------- */
router.get('/:id/timeline', requirePermission('patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query(
    `SELECT 'appointment' AS kind, a.id, a.appointment_date::text AS occurred_on,
            concat('Appointment · ', initcap(replace(a.status,'_',' '))) AS title,
            coalesce(a.reason, a.appointment_type) AS subtitle, a.status
     FROM appointments a WHERE a.patient_id = $1
     UNION ALL
     SELECT 'consultation', c.id, to_char(c.visit_at, 'YYYY-MM-DD'),
            'Consultation ' || c.consultation_no, c.diagnosis, c.status
     FROM consultations c WHERE c.patient_id = $1
     UNION ALL
     SELECT 'invoice', i.id, i.invoice_date::text,
            'Invoice ' || i.invoice_no,
            'Total ₹' || to_char(i.total, 'FM999,999,990.00'), i.status
     FROM invoices i WHERE i.patient_id = $1
     UNION ALL
     SELECT 'payment', p.id, to_char(p.payment_date, 'YYYY-MM-DD'),
            'Payment ' || p.payment_no,
            '₹' || to_char(p.amount, 'FM999,999,990.00') || ' via ' ||
              CASE p.method WHEN 'upi' THEN 'UPI' WHEN 'bank_transfer' THEN 'bank transfer' ELSE initcap(p.method) END,
            p.status
     FROM payments p WHERE p.patient_id = $1
     ORDER BY occurred_on DESC
     LIMIT 50`,
    [id]
  );
  res.json({ data: rows });
}));

router.get('/:id/appointments', requireAnyPermission('appointments.view', 'patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query(
    `SELECT a.*, u.full_name AS dentist_name
     FROM appointments a JOIN users u ON u.id = a.dentist_id
     WHERE a.patient_id = $1 ORDER BY a.appointment_date DESC, a.start_time DESC LIMIT 100`,
    [id]
  );
  res.json({ data: rows });
}));

router.get('/:id/consultations', requireAnyPermission('consultations.view', 'patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query(
    `SELECT c.*, u.full_name AS dentist_name
     FROM consultations c JOIN users u ON u.id = c.dentist_id
     WHERE c.patient_id = $1 ORDER BY c.visit_at DESC`,
    [id]
  );
  res.json({ data: rows });
}));

router.get('/:id/prescriptions', requireAnyPermission('prescriptions.view', 'patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query(
    `SELECT p.*, u.full_name AS dentist_name,
            (SELECT count(*) FROM prescription_items pi WHERE pi.prescription_id = p.id)::int AS item_count
     FROM prescriptions p JOIN users u ON u.id = p.dentist_id
     WHERE p.patient_id = $1 ORDER BY p.prescription_date DESC, p.created_at DESC`,
    [id]
  );
  res.json({ data: rows });
}));

router.get('/:id/invoices', requireAnyPermission('invoices.view', 'patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query(
    `SELECT i.*, (SELECT count(*) FROM invoice_items ii WHERE ii.invoice_id = i.id)::int AS item_count
     FROM invoices i WHERE i.patient_id = $1 ORDER BY i.invoice_date DESC, i.created_at DESC`,
    [id]
  );
  res.json({ data: rows });
}));

router.get('/:id/payments', requireAnyPermission('payments.view', 'patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query(
    `SELECT p.*, i.invoice_no, u.full_name AS recorded_by_name
     FROM payments p JOIN invoices i ON i.id = p.invoice_id LEFT JOIN users u ON u.id = p.recorded_by
     WHERE p.patient_id = $1 ORDER BY p.payment_date DESC`,
    [id]
  );
  res.json({ data: rows });
}));

/* ---------- documents ---------- */
router.get('/:id/documents', requireAnyPermission('patients.documents', 'patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query(
    `SELECT d.id, d.file_name, d.mime_type, d.size_bytes, d.category, d.notes, d.created_at, u.full_name AS uploaded_by_name
     FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
     WHERE d.patient_id = $1 ORDER BY d.created_at DESC`,
    [id]
  );
  res.json({ data: rows });
}));

router.post('/:id/documents', requirePermission('patients.documents'), uploadDocument.single('file'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const exists = await query('SELECT 1 FROM patients WHERE id = $1', [id]);
  if (!exists.rowCount) throw ApiError.notFound('Patient not found');
  const { rows } = await query(
    `INSERT INTO documents (patient_id, file_name, stored_name, mime_type, size_bytes, category, notes, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, file_name, mime_type, size_bytes, category, created_at`,
    [id, req.file.originalname.slice(0, 255), req.file.filename, req.file.mimetype, req.file.size, String(req.body.category || 'other').slice(0, 50), req.body.notes || null, req.user.id]
  );
  await logAudit(null, req, { action: 'patient.document_uploaded', entityType: 'document', entityId: rows[0].id, details: { patientId: id, fileName: req.file.originalname } });
  res.status(201).json({ data: rows[0] });
}));

router.get('/:id/documents/:docId/download', requireAnyPermission('patients.documents', 'patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const docId = requireId(req.params.docId, 'Document');
  const { rows } = await query('SELECT * FROM documents WHERE id = $1 AND patient_id = $2', [docId, id]);
  const doc = rows[0];
  if (!doc) throw ApiError.notFound('Document not found');
  const filePath = path.join(DATA_DIRS.documents, path.basename(doc.stored_name));
  if (!fs.existsSync(filePath)) {
    const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
      <rect width="400" height="300" fill="#f8fafc"/>
      <rect x="20" y="20" width="360" height="260" rx="16" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
      <text x="200" y="140" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#475569" text-anchor="middle">Document File</text>
      <text x="200" y="165" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">File stored on clinic workstation</text>
    </svg>`;
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.type('image/svg+xml').send(placeholderSvg);
  }
  await logAudit(null, req, { action: 'patient.document_viewed', entityType: 'document', entityId: docId });
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name)}"`);
  res.type(doc.mime_type);
  res.sendFile(filePath);
}));

router.delete('/:id/documents/:docId', requirePermission('patients.documents'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const docId = requireId(req.params.docId, 'Document');
  const { rows } = await query('DELETE FROM documents WHERE id = $1 AND patient_id = $2 RETURNING stored_name, file_name', [docId, id]);
  if (!rows[0]) throw ApiError.notFound('Document not found');
  const filePath = path.join(DATA_DIRS.documents, path.basename(rows[0].stored_name));
  if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
  await logAudit(null, req, { action: 'patient.document_deleted', entityType: 'document', entityId: docId, details: { fileName: rows[0].file_name } });
  res.json({ data: { ok: true } });
}));

/* ---------- patient ledger & statement ---------- */
router.get('/:id/ledger', requirePermission('patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const exists = await query('SELECT 1 FROM patients WHERE id = $1', [id]);
  if (!exists.rowCount) throw ApiError.notFound('Patient not found');

  const [invoices, payments, credits, adjustments] = await Promise.all([
    query(`SELECT * FROM invoices WHERE patient_id = $1 ORDER BY invoice_date, created_at`, [id]),
    query(`SELECT p.*, i.invoice_no FROM payments p JOIN invoices i ON i.id = p.invoice_id
           WHERE p.patient_id = $1 ORDER BY p.payment_date`, [id]),
    query(`SELECT * FROM patient_credits WHERE patient_id = $1 ORDER BY received_at`, [id]),
    query(`SELECT a.*, i.invoice_no FROM invoice_adjustments a JOIN invoices i ON i.id = a.invoice_id
           WHERE a.patient_id = $1 ORDER BY a.created_at`, [id])
  ]);

  const totalInvoiced = invoices.rows.reduce((s, i) => s + toPaise(i.total), 0n);
  const totalPaid = payments.rows.filter((p) => p.status === 'completed').reduce((s, p) => s + toPaise(p.amount), 0n);
  const totalOutstanding = invoices.rows.reduce((s, i) => s + toPaise(i.outstanding_balance), 0n);
  const totalCreditsReceived = credits.rows.filter((c) => c.status !== 'void').reduce((s, c) => s + toPaise(c.amount), 0n);
  const totalCreditsAvailable = credits.rows.filter((c) => c.status !== 'void').reduce((s, c) => s + (toPaise(c.amount) - toPaise(c.used_amount)), 0n);
  const totalWrittenOff = adjustments.rows.filter((a) => a.type === 'write_off').reduce((s, a) => s + toPaise(a.amount), 0n);
  const totalCreditNotes = adjustments.rows.filter((a) => a.type === 'credit_note').reduce((s, a) => s + toPaise(a.amount), 0n);
  const totalDebitNotes = adjustments.rows.filter((a) => a.type === 'debit_note').reduce((s, a) => s + toPaise(a.amount), 0n);

  const entries = [];
  for (const inv of invoices.rows) {
    entries.push({ date: inv.invoice_date, kind: 'invoice', reference: inv.invoice_no, debit: inv.total, credit: null, note: inv.status });
  }
  for (const pay of payments.rows) {
    if (pay.status !== 'completed') continue;
    entries.push({ date: (pay.payment_date || '').slice(0, 10), kind: 'payment', reference: pay.payment_no, debit: null, credit: pay.amount, note: `${pay.method}${pay.invoice_no ? ` · ${pay.invoice_no}` : ''}` });
  }
  for (const c of credits.rows) {
    if (c.status === 'void') continue;
    entries.push({ date: (c.received_at || '').slice(0, 10), kind: 'advance', reference: c.credit_no, debit: null, credit: c.amount, note: `Advance received (${c.method})` });
  }
  for (const a of adjustments.rows) {
    entries.push({
      date: (a.created_at || '').slice(0, 10),
      kind: a.type,
      reference: a.adjustment_no,
      debit: a.type === 'debit_note' ? a.amount : null,
      credit: a.type === 'credit_note' || a.type === 'write_off' ? a.amount : null,
      note: a.reason
    });
  }
  entries.sort((x, y) => String(x.date).localeCompare(String(y.date)));

  let running = 0n;
  const ledger = entries.map((e) => {
    running += toPaise(e.debit || 0) - toPaise(e.credit || 0);
    return { ...e, balance: fromPaise(running) };
  });

  res.json({
    data: {
      summary: {
        totalInvoiced: fromPaise(totalInvoiced),
        totalPaid: fromPaise(totalPaid),
        totalOutstanding: fromPaise(totalOutstanding),
        totalCreditsReceived: fromPaise(totalCreditsReceived),
        totalCreditsAvailable: fromPaise(totalCreditsAvailable),
        totalWrittenOff: fromPaise(totalWrittenOff),
        totalCreditNotes: fromPaise(totalCreditNotes),
        totalDebitNotes: fromPaise(totalDebitNotes)
      },
      entries: ledger,
      invoices: invoices.rows,
      payments: payments.rows,
      credits: credits.rows,
      adjustments: adjustments.rows
    }
  });
}));

router.get('/:id/statement.pdf', requirePermission('patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query('SELECT * FROM patients WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Patient not found');
  const ledgerRes = await query('SELECT 1');
  // Reuse the ledger endpoint logic by calling internal function is awkward; rebuild summary quickly.
  const [invoices, payments, credits, adjustments] = await Promise.all([
    query(`SELECT * FROM invoices WHERE patient_id = $1 ORDER BY invoice_date, created_at`, [id]),
    query(`SELECT p.*, i.invoice_no FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE p.patient_id = $1 ORDER BY p.payment_date`, [id]),
    query(`SELECT * FROM patient_credits WHERE patient_id = $1 ORDER BY received_at`, [id]),
    query(`SELECT a.*, i.invoice_no FROM invoice_adjustments a JOIN invoices i ON i.id = a.invoice_id WHERE a.patient_id = $1 ORDER BY a.created_at`, [id])
  ]);
  const totalInvoiced = invoices.rows.reduce((s, i) => s + toPaise(i.total), 0n);
  const totalPaid = payments.rows.filter((p) => p.status === 'completed').reduce((s, p) => s + toPaise(p.amount), 0n);
  const totalOutstanding = invoices.rows.reduce((s, i) => s + toPaise(i.outstanding_balance), 0n);
  const totalCreditsAvailable = credits.rows.filter((c) => c.status !== 'void').reduce((s, c) => s + (toPaise(c.amount) - toPaise(c.used_amount)), 0n);
  const entries = [];
  for (const inv of invoices.rows) entries.push({ date: inv.invoice_date, kind: 'Invoice', reference: inv.invoice_no, debit: inv.total, credit: null });
  for (const pay of payments.rows) {
    if (pay.status !== 'completed') continue;
    entries.push({ date: (pay.payment_date || '').slice(0, 10), kind: 'Payment', reference: pay.payment_no, debit: null, credit: pay.amount });
  }
  for (const c of credits.rows) {
    if (c.status === 'void') continue;
    entries.push({ date: (c.received_at || '').slice(0, 10), kind: 'Advance', reference: c.credit_no, debit: null, credit: c.amount });
  }
  for (const a of adjustments.rows) {
    entries.push({
      date: (a.created_at || '').slice(0, 10),
      kind: a.type.replace('_', ' '),
      reference: a.adjustment_no,
      debit: a.type === 'debit_note' ? a.amount : null,
      credit: a.type === 'credit_note' || a.type === 'write_off' ? a.amount : null
    });
  }
  entries.sort((x, y) => String(x.date).localeCompare(String(y.date)));
  let running = 0n;
  const ledger = entries.map((e) => {
    running += toPaise(e.debit || 0) - toPaise(e.credit || 0);
    return { ...e, balance: fromPaise(running) };
  });

  const { streamPatientStatement } = await import('../services/pdf.service.js');
  await streamPatientStatement(
    {
      patient: rows[0],
      clinic: await (await import('../services/clinic.service.js')).getClinic(),
      summary: {
        totalInvoiced: fromPaise(totalInvoiced),
        totalPaid: fromPaise(totalPaid),
        totalOutstanding: fromPaise(totalOutstanding),
        totalCreditsAvailable: fromPaise(totalCreditsAvailable)
      },
      entries: ledger
    },
    res
  );
}));

/* ---------- patient communications ---------- */
router.get('/:id/communications', requireAnyPermission('patients.communications', 'patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query(
    `SELECT c.*, u.full_name AS recorded_by_name, a.appointment_no
     FROM patient_communications c LEFT JOIN users u ON u.id = c.created_by
     LEFT JOIN appointments a ON a.id = c.appointment_id
     WHERE c.patient_id = $1 ORDER BY c.created_at DESC`,
    [id]
  );
  res.json({ data: rows.map((r) => ({
    id: r.id,
    appointmentId: r.appointment_id,
    appointmentNo: r.appointment_no,
    channel: r.channel,
    direction: r.direction,
    purpose: r.purpose,
    outcome: r.outcome,
    notes: r.notes,
    followUpDate: r.follow_up_date,
    recordedByName: r.recorded_by_name,
    createdAt: r.created_at
  })) });
}));

const communicationSchema = z.object({
  channel: z.enum(['phone', 'whatsapp', 'sms', 'email', 'in_person', 'other']),
  direction: z.enum(['outbound', 'inbound']).optional(),
  purpose: z.enum(['appointment', 'confirmation', 'reminder', 'follow_up', 'recall', 'payment', 'clinical', 'general']).optional(),
  outcome: z.enum(['connected', 'no_answer', 'busy', 'wrong_number', 'callback_requested', 'message_sent', 'other']).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
  appointmentId: z.string().uuid().nullable().optional()
});

router.post('/:id/communications', requirePermission('patients.communications'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const body = validate(communicationSchema, req.body);
  const exists = await query('SELECT 1 FROM patients WHERE id = $1', [id]);
  if (!exists.rowCount) throw ApiError.notFound('Patient not found');
  const { rows } = await query(
    `INSERT INTO patient_communications (patient_id, appointment_id, channel, direction, purpose, outcome, notes, follow_up_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [id, body.appointmentId || null, body.channel, body.direction || 'outbound',
      body.purpose || 'general', body.outcome || 'connected', body.notes || null,
      body.followUpDate || null, req.user.id]
  );
  await logAudit(null, req, { action: 'patient.communication_recorded', entityType: 'patient_communication', entityId: rows[0].id, details: { patientId: id, channel: body.channel, purpose: body.purpose } });
  res.status(201).json({ data: rows[0] });
}));

/* ---------- clinical photos ---------- */
router.get('/:id/photos', requireAnyPermission('patients.documents', 'patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const { rows } = await query(
    `SELECT cp.*, d.file_name, d.mime_type, d.size_bytes, d.stored_name, u.full_name AS created_by_name
     FROM clinical_photos cp JOIN documents d ON d.id = cp.document_id
     LEFT JOIN users u ON u.id = cp.created_by
     WHERE cp.patient_id = $1 ORDER BY cp.taken_at DESC, cp.created_at DESC`,
    [id]
  );
  res.json({ data: rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    documentId: r.document_id,
    toothNumber: r.tooth_number,
    photoType: r.photo_type,
    takenAt: r.taken_at,
    notes: r.notes,
    fileName: r.file_name,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    url: `/api/patients/${id}/photos/${r.id}/file`,
    createdByName: r.created_by_name,
    createdAt: r.created_at
  })) });
}));

router.post('/:id/photos', requirePermission('patients.documents'), uploadClinicalPhoto.single('photo'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  if (!req.file) throw ApiError.badRequest('No photo uploaded');
  const exists = await query('SELECT 1 FROM patients WHERE id = $1', [id]);
  if (!exists.rowCount) {
    require('node:fs').unlink(req.file.path, () => {});
    throw ApiError.notFound('Patient not found');
  }
  const photoType = String(req.body.photoType || 'intraoral').slice(0, 30);
  const toothNumber = req.body.toothNumber ? String(req.body.toothNumber).trim().slice(0, 3) : null;
  const takenAt = /^\d{4}-\d{2}-\d{2}$/.test(req.body.takenAt || '') ? req.body.takenAt : null;
  const notes = req.body.notes ? String(req.body.notes).trim().slice(0, 500) : null;

  const photo = await withTransaction(async (client) => {
    // Ensure file_data column exists on documents table
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_data text').catch(() => {});

    let fileData = null;
    try {
      const mime = req.file.mimetype || 'image/jpeg';
      fileData = `data:${mime};base64,${fs.readFileSync(req.file.path).toString('base64')}`;
    } catch {}

    const { rows: docRows } = await client.query(
      `INSERT INTO documents (patient_id, file_name, stored_name, mime_type, size_bytes, category, notes, uploaded_by, file_data)
       VALUES ($1,$2,$3,$4,$5,'clinical_photo',$6,$7,$8) RETURNING id`,
      [id, req.file.originalname.slice(0, 255), req.file.filename, req.file.mimetype, req.file.size, notes, req.user.id, fileData]
    );
    const { rows } = await client.query(
      `INSERT INTO clinical_photos (patient_id, document_id, tooth_number, photo_type, taken_at, notes, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7) RETURNING *`,
      [id, docRows[0].id, toothNumber, photoType, takenAt, notes, req.user.id]
    );
    return rows[0];
  });

  await logAudit(null, req, { action: 'patient.photo_uploaded', entityType: 'clinical_photo', entityId: photo.id, details: { patientId: id, fileName: req.file.originalname, photoType } });
  res.status(201).json({ data: photo });
}));

router.get('/:id/photos/:photoId/file', requireAnyPermission('patients.documents', 'patients.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const photoId = requireId(req.params.photoId, 'Clinical photo');
  const { rows } = await query(
    `SELECT d.stored_name, d.mime_type, d.file_name, d.file_data FROM clinical_photos cp
     JOIN documents d ON d.id = cp.document_id WHERE cp.id = $1 AND cp.patient_id = $2`,
    [photoId, id]
  );
  const doc = rows[0];
  if (!doc) throw ApiError.notFound('Photo not found');

  // 1. If stored in PostgreSQL as Base64 (Render cloud persistent)
  if (doc.file_data && typeof doc.file_data === 'string' && doc.file_data.includes(',')) {
    const parts = doc.file_data.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || doc.mime_type || 'image/jpeg';
    const buffer = Buffer.from(parts[1], 'base64');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.type(mime).send(buffer);
  }

  // 2. Check all possible disk paths (both DATA_DIRS.photos AND DATA_DIRS.documents)
  const filename = path.basename(doc.stored_name);
  const candidatePaths = [
    path.join(DATA_DIRS.photos, filename),
    path.join(DATA_DIRS.documents, filename),
    path.resolve('data/photos', filename),
    path.resolve('data/documents', filename),
    path.resolve('release/server/ZhanX-DentalCare-Server-1.0.0/data/photos', filename),
    path.resolve('release/server/ZhanX-DentalCare-Server-1.0.0/data/documents', filename)
  ];

  const foundPath = candidatePaths.find((p) => fs.existsSync(p));
  if (foundPath) {
    // Opportunistically persist to DB so next container restart will serve directly from DB
    try {
      const mime = doc.mime_type || 'image/jpeg';
      const b64 = `data:${mime};base64,${fs.readFileSync(foundPath).toString('base64')}`;
      query('UPDATE documents SET file_data = $1 WHERE stored_name = $2', [b64, doc.stored_name]).catch(() => {});
    } catch {}

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.type(doc.mime_type || 'image/jpeg');
    return res.sendFile(foundPath);
  }

  // 3. Fallback placeholder
  const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <rect width="400" height="300" fill="#f8fafc"/>
    <rect x="20" y="20" width="360" height="260" rx="16" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 6"/>
    <circle cx="200" cy="120" r="40" fill="#e2e8f0"/>
    <path d="M190 110 C190 100, 210 100, 210 110 C210 125, 205 135, 200 145 C195 135, 190 125, 190 110 Z" fill="#94a3b8"/>
    <text x="200" y="195" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#475569" text-anchor="middle">Clinical Photo</text>
    <text x="200" y="215" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Image stored on local clinic workstation</text>
  </svg>`;
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.type('image/svg+xml').send(placeholderSvg);
}));

router.delete('/:id/photos/:photoId', requirePermission('patients.documents'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Patient');
  const photoId = requireId(req.params.photoId, 'Clinical photo');
  const { rows } = await query(
    `DELETE FROM clinical_photos WHERE id = $1 AND patient_id = $2 RETURNING document_id`,
    [photoId, id]
  );
  if (!rows[0]) throw ApiError.notFound('Photo not found');
  const docRows = await query('DELETE FROM documents WHERE id = $1 RETURNING stored_name', [rows[0].document_id]);
  if (docRows.rows[0]?.stored_name) {
    const filePath = path.join(DATA_DIRS.documents, path.basename(docRows.rows[0].stored_name));
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
  }
  await logAudit(null, req, { action: 'patient.photo_deleted', entityType: 'clinical_photo', entityId: photoId });
  res.json({ data: { ok: true } });
}));

async function findDuplicates(body) {
  const { rows } = await query(
    `SELECT id, patient_no, full_name, mobile, dob, created_at
     FROM patients
     WHERE mobile = $1
        OR (lower(full_name) = lower($2) AND ($3::date IS NOT NULL AND dob = $3::date))
     LIMIT 5`,
    [body.mobile, body.fullName, body.dob || null]
  );
  return rows;
}

function mapPatient(r) {
  if (!r) return null;
  return {
    id: r.id,
    patientNo: r.patient_no,
    fullName: r.full_name,
    dob: r.dob,
    age: r.age ?? null,
    gender: r.gender,
    mobile: r.mobile,
    alternateMobile: r.alternate_mobile || null,
    email: r.email,
    address: r.address,
    city: r.city || null,
    state: r.state || null,
    pincode: r.pincode || null,
    bloodGroup: r.blood_group || null,
    maritalStatus: r.marital_status || null,
    occupation: r.occupation || null,
    idProofType: r.id_proof_type || null,
    idProofNumber: r.id_proof_number || null,
    emergencyContactName: r.emergency_contact_name,
    emergencyContactRelation: r.emergency_contact_relation || null,
    emergencyContactPhone: r.emergency_contact_phone,
    referredBy: r.referred_by,
    insuranceProvider: r.insurance_provider || null,
    insurancePolicyNo: r.insurance_policy_no || null,
    dataConsent: Boolean(r.data_consent),
    dataConsentAt: r.data_consent_at || null,
    hasPhoto: Boolean(r.photo_file || r.photo_data),
    notes: r.notes,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    outstanding: r.outstanding ?? '0',
    allergies: r.allergies || null,
    conditions: r.conditions || null,
    lastVisit: r.last_visit ?? null,
    visitCount: Number(r.visit_count ?? 0),
    isNewPatient: (Number(r.visit_count ?? 0) <= 0 || !r.last_visit),
    nextAppointment: r.next_appointment_date
      ? { date: r.next_appointment_date, startTime: r.next_appointment_time || null }
      : null
  };
}

function mapMedicalHistory(r) {
  if (!r) return null;
  return {
    id: r.id,
    conditions: r.conditions,
    allergies: r.allergies,
    medications: r.medications,
    surgicalHistory: r.surgical_history,
    dentalHistory: r.dental_history,
    previousTreatments: r.previous_treatments,
    clinicianNotes: r.clinician_notes,
    consentConfirmed: r.consent_confirmed,
    consentConfirmedAt: r.consent_confirmed_at,
    recordedBy: r.recorded_by_name || r.recorded_by,
    createdAt: r.created_at
  };
}

export { mapPatient };
export default router;
