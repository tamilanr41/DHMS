import { Router } from 'express';
import { z } from 'zod';
import { query } from '../database/db.js';
import { asyncHandler } from '../utils/errors.js';
import { authenticate, requireAnyPermission } from '../middleware/auth.js';
import { getClinic } from '../services/clinic.service.js';
import { validate } from '../utils/validate.js';

const router = Router();
router.use(authenticate);

// Recall list is derived from completed visits, so it can never drift from the
// clinical record. No extra table is needed and no patient data is mutated.
router.get('/', requireAnyPermission('patients.view', 'appointments.view'), asyncHandler(async (req, res) => {
  const clinic = await getClinic();
  const recallMonths = Number(clinic?.recallMonths) || 6;
  const windowDays = Math.min(365, Math.max(0, Number.parseInt(req.query.windowDays, 10) || 0));

  const { rows } = await query(
    `WITH last_visit AS (
       SELECT c.patient_id, max(c.visit_at) AS last_visit, count(*)::int AS visit_count
       FROM consultations c
       WHERE c.status IN ('completed','amended')
       GROUP BY c.patient_id
     ),
     last_clinician AS (
       SELECT DISTINCT ON (c.patient_id) c.patient_id, u.full_name AS dentist_name, c.diagnosis
       FROM consultations c JOIN users u ON u.id = c.dentist_id
       WHERE c.status IN ('completed','amended')
       ORDER BY c.patient_id, c.visit_at DESC
     ),
     upcoming AS (
       SELECT DISTINCT patient_id FROM appointments
       WHERE appointment_date >= CURRENT_DATE
         AND status IN ('scheduled','confirmed','checked_in','waiting','in_consultation')
     )
     SELECT p.id, p.patient_no, p.full_name, p.mobile, p.gender, p.dob,
            date_part('year', age(p.dob))::int AS age,
            lv.last_visit, lv.visit_count, lc.dentist_name, lc.diagnosis,
            due.due_at,
            (CURRENT_DATE - due.due_at)::int AS days_overdue,
            (up.patient_id IS NOT NULL) AS has_upcoming
     FROM patients p
     JOIN last_visit lv ON lv.patient_id = p.id
     CROSS JOIN LATERAL (
       SELECT (lv.last_visit::date + make_interval(months => $1::int))::date AS due_at
     ) due
     LEFT JOIN last_clinician lc ON lc.patient_id = p.id
     LEFT JOIN upcoming up ON up.patient_id = p.id
     WHERE due.due_at <= CURRENT_DATE + $2::int
     ORDER BY due_at ASC, p.full_name`,
    [recallMonths, windowDays]
  );

  res.json({
    data: rows.map((r) => ({
      patientId: r.id,
      patientNo: r.patient_no,
      fullName: r.full_name,
      mobile: r.mobile,
      gender: r.gender,
      age: r.age,
      lastVisit: r.last_visit,
      visitCount: r.visit_count,
      lastDentist: r.dentist_name,
      lastDiagnosis: r.diagnosis,
      dueDate: r.due_at,
      daysOverdue: r.days_overdue,
      hasUpcomingAppointment: r.has_upcoming
    })),
    meta: { recallMonths, windowDays, total: rows.length }
  });
}));

const logRecallSchema = z.object({
  patientId: z.string().uuid('Patient ID is required'),
  channel: z.enum(['whatsapp', 'sms', 'phone', 'email']).default('whatsapp'),
  notes: z.string().trim().max(1000).optional()
});

router.post('/log', requireAnyPermission('patients.view', 'appointments.manage', 'reminders.manage'), asyncHandler(async (req, res) => {
  const body = validate(logRecallSchema, req.body);
  const { rows } = await query(
    `INSERT INTO patient_communications (patient_id, channel, direction, purpose, outcome, notes, created_by)
     VALUES ($1, $2, 'outbound', 'recall', 'message_opened', $3, $4) RETURNING *`,
    [body.patientId, body.channel, body.notes || 'Routine recall follow-up outreach opened', req.user.id]
  );
  res.status(201).json({ data: rows[0] });
}));

export default router;
