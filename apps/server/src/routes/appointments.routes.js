import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate, todayISO } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { logAudit } from '../services/audit.service.js';
import { getClinic } from '../services/clinic.service.js';

const router = Router();
router.use(authenticate);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const STATUSES = ['scheduled', 'confirmed', 'checked_in', 'waiting', 'in_consultation', 'completed', 'cancelled', 'no_show'];
const TRANSITIONS = {
  scheduled: ['confirmed', 'checked_in', 'cancelled', 'no_show'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['waiting', 'in_consultation', 'cancelled'],
  waiting: ['in_consultation', 'cancelled'],
  in_consultation: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: []
};

const appointmentSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  dentistId: z.string().uuid('Select a dentist'),
  appointmentDate: z.string().regex(DATE, 'Choose a date'),
  startTime: z.string().regex(TIME, 'Invalid start time'),
  endTime: z.string().regex(TIME, 'Invalid end time'),
  appointmentType: z.string().trim().max(50).optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
  bookingSource: z.enum(['reception', 'phone', 'walk_in', 'online', 'follow_up']).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['scheduled', 'confirmed']).optional()
});

function normalizeTime(t) {
  return t.length === 5 ? `${t}:00` : t;
}

async function assertDentist(dentistId) {
  const { rows } = await query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND r.code = 'dentist' AND u.is_active`,
    [dentistId]
  );
  if (!rows[0]) throw ApiError.badRequest('Selected dentist is not available');
}

async function findConflicts({ dentistId, date, start, end, excludeId }) {
  const { rows } = await query(
    `SELECT a.id, a.appointment_no, a.start_time, a.end_time, a.status, p.full_name AS patient_name
     FROM appointments a JOIN patients p ON p.id = a.patient_id
     WHERE a.dentist_id = $1 AND a.appointment_date = $2
       AND a.status NOT IN ('cancelled','no_show','completed')
       AND ($5::uuid IS NULL OR a.id <> $5)
       AND a.start_time < $4::time AND a.end_time > $3::time`,
    [dentistId, date, start, end, excludeId || null]
  );
  return rows;
}

router.get('/', requirePermission('appointments.view'), asyncHandler(async (req, res) => {
  const where = ['1=1'];
  const params = [];

  if (req.user?.clinicId) {
    params.push(req.user.clinicId);
    where.push(`a.clinic_id = $${params.length}`);
  }

  if (DATE.test(req.query.date || '')) {
    params.push(req.query.date);
    where.push(`a.appointment_date = $${params.length}`);
  } else {
    if (DATE.test(req.query.startDate || '')) {
      params.push(req.query.startDate);
      where.push(`a.appointment_date >= $${params.length}`);
    }
    if (DATE.test(req.query.endDate || '')) {
      params.push(req.query.endDate);
      where.push(`a.appointment_date <= $${params.length}`);
    }
  }
  if (req.query.dentistId) {
    params.push(req.query.dentistId);
    where.push(`a.dentist_id = $${params.length}`);
  }
  if (req.query.status && STATUSES.includes(req.query.status)) {
    params.push(req.query.status);
    where.push(`a.status = $${params.length}`);
  }
  if (req.query.patientId) {
    params.push(req.query.patientId);
    where.push(`a.patient_id = $${params.length}`);
  }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(p.full_name ILIKE $${params.length} OR p.mobile ILIKE $${params.length} OR a.appointment_no ILIKE $${params.length})`);
  }
  const limit = Math.min(500, Number.parseInt(req.query.pageSize, 10) || 200);
  params.push(limit);
  const { rows } = await query(
    `SELECT a.*, p.full_name AS patient_name, p.patient_no, p.mobile, p.photo_file, p.photo_data,
            u.full_name AS dentist_name,
            (SELECT count(*) FROM consultations c WHERE c.patient_id = p.id)::int AS visit_count,
            (SELECT count(*) FROM consultations c WHERE c.appointment_id = a.id)::int AS consultation_count
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u ON u.id = a.dentist_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.appointment_date, a.start_time
     LIMIT $${params.length}`,
    params
  );
  res.json({ data: rows.map(mapAppointment) });
}));

router.get('/queue', requirePermission('queue.view'), asyncHandler(async (req, res) => {
  const date = DATE.test(req.query.date || '') ? req.query.date : todayISO();
  const clinicWhere = req.user?.clinicId ? 'AND a.clinic_id = $2' : '';
  const params = req.user?.clinicId ? [date, req.user.clinicId] : [date];
  const { rows } = await query(
    `SELECT a.*, p.full_name AS patient_name, p.patient_no, p.mobile, p.photo_file, p.photo_data, u.full_name AS dentist_name,
            (SELECT count(*) FROM consultations c WHERE c.patient_id = p.id)::int AS visit_count,
            (SELECT max(changed_at) FROM appointment_status_history h
              WHERE h.appointment_id = a.id AND h.to_status IN ('checked_in','waiting')) AS queued_at
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u ON u.id = a.dentist_id
     WHERE a.appointment_date = $1 AND a.status IN ('checked_in','waiting','in_consultation') ${clinicWhere}
     ORDER BY queued_at NULLS LAST, a.start_time`,
    params
  );
  res.json({ data: rows.map(mapAppointment) });
}));

router.get('/availability', requirePermission('appointments.view'), asyncHandler(async (req, res) => {
  const date = DATE.test(req.query.date || '') ? req.query.date : todayISO();
  const dentistId = req.query.dentistId;
  if (!dentistId) throw ApiError.badRequest('dentistId is required');
  const clinic = await getClinic(req.user?.clinicId);
  const { rows } = await query(
    `SELECT start_time::text, end_time::text, appointment_no, status
     FROM appointments
     WHERE dentist_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled','no_show')
     ORDER BY start_time`,
    [dentistId, date]
  );
  res.json({ data: { slotMinutes: clinic.appointmentSlotMinutes, workingHours: clinic.workingHours, booked: rows } });
}));

router.post('/', requirePermission('appointments.manage'), asyncHandler(async (req, res) => {
  const body = validate(appointmentSchema, req.body);
  const start = normalizeTime(body.startTime);
  const end = normalizeTime(body.endTime);
  if (end <= start) throw ApiError.unprocessable('End time must be after start time', [{ path: 'endTime', message: 'End time must be after start time' }]);
  await assertDentist(body.dentistId);
  const patient = await query('SELECT 1 FROM patients WHERE id = $1', [body.patientId]);
  if (!patient.rowCount) throw ApiError.badRequest('Patient not found');

  const conflicts = await findConflicts({ dentistId: body.dentistId, date: body.appointmentDate, start, end });
  if (conflicts.length) {
    throw new ApiError(409, 'The dentist already has an appointment during this time', {
      code: 'APPOINTMENT_CONFLICT',
      details: { conflicts: conflicts.map((c) => ({ ...c, start_time: c.start_time, end_time: c.end_time })) }
    });
  }

  const clinicId = req.user?.clinicId || null;
  const appointment = await withTransaction(async (client) => {
    const { rows: seq } = await client.query(`SELECT nextval('seq_appointment') AS n`);
    const appointmentNo = `APT-${String(seq[0].n).padStart(6, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO appointments (appointment_no, patient_id, dentist_id, appointment_date, start_time, end_time,
         appointment_type, reason, booking_source, notes, status, created_by, updated_by, clinic_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13) RETURNING *`,
      [
        appointmentNo, body.patientId, body.dentistId, body.appointmentDate, start, end,
        body.appointmentType || 'consultation', body.reason || null, body.bookingSource || 'reception',
        body.notes || null, body.status || 'scheduled', req.user.id, clinicId
      ]
    );
    await client.query(
      `INSERT INTO appointment_status_history (appointment_id, from_status, to_status, note, changed_by)
       VALUES ($1, NULL, $2, $3, $4)`,
      [rows[0].id, rows[0].status, 'Appointment created', req.user.id]
    );
    return rows[0];
  });

  await logAudit(null, req, {
    action: 'appointment.created',
    entityType: 'appointment',
    entityId: appointment.id,
    details: { appointmentNo: appointment.appointment_no, patientId: body.patientId, date: body.appointmentDate }
  });
  res.status(201).json({ data: mapAppointment(appointment) });
}));

router.get('/:id', requirePermission('appointments.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Appointment');
  const clinicWhere = req.user?.clinicId ? ' AND a.clinic_id = $2' : '';
  const params = req.user?.clinicId ? [id, req.user.clinicId] : [id];
  const { rows } = await query(
    `SELECT a.*, p.full_name AS patient_name, p.patient_no, p.mobile, p.photo_file, p.photo_data, u.full_name AS dentist_name,
            (SELECT id FROM consultations c WHERE c.appointment_id = a.id ORDER BY created_at DESC LIMIT 1) AS consultation_id
     FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = a.dentist_id
     WHERE a.id = $1${clinicWhere}`,
    params
  );
  if (!rows[0]) throw ApiError.notFound('Appointment not found');
  const history = await query(
    `SELECT h.*, u.full_name AS changed_by_name FROM appointment_status_history h
     LEFT JOIN users u ON u.id = h.changed_by WHERE h.appointment_id = $1 ORDER BY h.changed_at`,
    [id]
  );
  res.json({ data: { ...mapAppointment(rows[0]), consultationId: rows[0].consultation_id, history: history.rows } });
}));

const updateSchema = appointmentSchema.partial().omit({ patientId: true });

router.patch('/:id', requirePermission('appointments.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Appointment');
  const body = validate(updateSchema, req.body);
  const { rows: existingRows } = await query('SELECT * FROM appointments WHERE id = $1', [id]);
  const existing = existingRows[0];
  if (!existing) throw ApiError.notFound('Appointment not found');
  if (['completed', 'cancelled', 'no_show'].includes(existing.status)) {
    throw ApiError.badRequest('This appointment is closed and cannot be rescheduled');
  }

  const dentistId = body.dentistId || existing.dentist_id;
  const date = body.appointmentDate || existing.appointment_date;
  const start = normalizeTime(body.startTime || existing.start_time);
  const end = normalizeTime(body.endTime || existing.end_time);
  if (end <= start) throw ApiError.unprocessable('End time must be after start time');
  if (body.dentistId) await assertDentist(body.dentistId);

  const conflicts = await findConflicts({ dentistId, date, start, end, excludeId: id });
  if (conflicts.length) {
    throw new ApiError(409, 'The dentist already has an appointment during this time', {
      code: 'APPOINTMENT_CONFLICT',
      details: { conflicts }
    });
  }

  const updated = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE appointments SET
         dentist_id = $2, appointment_date = $3, start_time = $4, end_time = $5,
         appointment_type = COALESCE($6, appointment_type), reason = COALESCE($7, reason),
         booking_source = COALESCE($8, booking_source), notes = COALESCE($9, notes),
         updated_by = $10
       WHERE id = $1 RETURNING *`,
      [id, dentistId, date, start, end, body.appointmentType, body.reason, body.bookingSource, body.notes, req.user.id]
    );
    const rescheduled = existing.appointment_date !== date || existing.start_time !== start || existing.dentist_id !== dentistId;
    if (rescheduled) {
      await client.query(
        `INSERT INTO appointment_status_history (appointment_id, from_status, to_status, note, changed_by)
         VALUES ($1,$2,$2,$3,$4)`,
        [id, existing.status, `Rescheduled to ${date} ${start.slice(0, 5)}`, req.user.id]
      );
    }
    return rows[0];
  });

  await logAudit(null, req, { action: 'appointment.updated', entityType: 'appointment', entityId: id, details: body });
  res.json({ data: mapAppointment(updated) });
}));

const statusSchema = z.object({
  status: z.enum(STATUSES),
  note: z.string().trim().max(500).nullable().optional()
});

router.post('/:id/status', requireAnyPermission('queue.manage', 'appointments.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Appointment');
  const { status, note } = validate(statusSchema, req.body);
  const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [id]);
  const appointment = rows[0];
  if (!appointment) throw ApiError.notFound('Appointment not found');
  if (appointment.status === status) return res.json({ data: mapAppointment(appointment) });
  if (!TRANSITIONS[appointment.status].includes(status)) {
    throw ApiError.badRequest(`Cannot change status from ${appointment.status.replace('_', ' ')} to ${status.replace('_', ' ')}`);
  }

  const updated = await withTransaction(async (client) => {
    const { rows: upd } = await client.query('UPDATE appointments SET status = $2, updated_by = $3 WHERE id = $1 RETURNING *', [id, status, req.user.id]);
    await client.query(
      `INSERT INTO appointment_status_history (appointment_id, from_status, to_status, note, changed_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, appointment.status, status, note || null, req.user.id]
    );
    return upd[0];
  });
  await logAudit(null, req, { action: 'appointment.status_changed', entityType: 'appointment', entityId: id, details: { from: appointment.status, to: status, note } });
  res.json({ data: mapAppointment(updated) });
}));

function mapAppointment(r) {
  if (!r) return null;
  return {
    id: r.id,
    appointmentNo: r.appointment_no,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientNo: r.patient_no,
    mobile: r.mobile,
    hasPhoto: Boolean(r.photo_file || r.photo_data),
    dentistId: r.dentist_id,
    dentistName: r.dentist_name,
    appointmentDate: r.appointment_date,
    startTime: r.start_time,
    endTime: r.end_time,
    appointmentType: r.appointment_type,
    reason: r.reason,
    bookingSource: r.booking_source,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
    lastReminderAt: r.last_reminder_at,
    reminderCount: r.reminder_count,
    queuedAt: r.queued_at,
    consultationCount: r.consultation_count,
    visitCount: Number(r.visit_count ?? 0),
    isNewPatient: Number(r.visit_count ?? 0) <= 0
  };
}

export default router;
