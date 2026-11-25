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

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

export function renderTemplate(body, context) {
  return String(body || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const value = context[key];
    return value === undefined || value === null ? match : String(value);
  });
}

function appointmentContext(row, clinic) {
  return {
    patient: row.patient_name || 'Patient',
    clinic: clinic.name || 'the clinic',
    date: fmtDate(row.appointment_date),
    time: fmtTime(row.start_time),
    dentist: row.dentist_name || 'your dentist',
    phone: clinic.phone || '',
    address: clinic.address || ''
  };
}

const templateSchema = z.object({
  name: z.string().trim().min(2, 'Template name is required').max(120),
  channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
  purpose: z.string().trim().max(50).default('reminder'),
  body: z.string().trim().min(5, 'Message body is required').max(2000),
  isActive: z.boolean().optional()
});

router.get('/templates', requirePermission('reminders.manage'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM message_templates
     WHERE ($1::boolean IS TRUE OR is_active)
     ORDER BY is_active DESC, purpose, name`,
    [req.query.includeInactive === 'true']
  );
  res.json({ data: rows });
}));

router.post('/templates', requirePermission('reminders.manage'), asyncHandler(async (req, res) => {
  const body = validate(templateSchema, req.body);
  const { rows } = await query(
    `INSERT INTO message_templates (name, channel, purpose, body, is_active, created_by)
     VALUES ($1,$2,$3,$4,COALESCE($5,true),$6) RETURNING *`,
    [body.name, body.channel, body.purpose, body.body, body.isActive ?? null, req.user.id]
  );
  await logAudit(null, req, { action: 'message_template.created', entityType: 'message_template', entityId: rows[0].id, details: { name: body.name, channel: body.channel } });
  res.status(201).json({ data: rows[0] });
}));

router.patch('/templates/:id', requirePermission('reminders.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Message template');
  const body = validate(templateSchema.partial(), req.body);
  const { rows } = await query(
    `UPDATE message_templates SET
       name = COALESCE($2, name), channel = COALESCE($3, channel), purpose = COALESCE($4, purpose),
       body = COALESCE($5, body), is_active = COALESCE($6, is_active)
     WHERE id = $1 RETURNING *`,
    [id, body.name ?? null, body.channel ?? null, body.purpose ?? null, body.body ?? null, body.isActive ?? null]
  );
  if (!rows[0]) throw ApiError.notFound('Message template not found');
  await logAudit(null, req, { action: 'message_template.updated', entityType: 'message_template', entityId: id });
  res.json({ data: rows[0] });
}));

router.delete('/templates/:id', requirePermission('reminders.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Message template');
  const { rowCount } = await query('UPDATE message_templates SET is_active = false WHERE id = $1', [id]);
  if (!rowCount) throw ApiError.notFound('Message template not found');
  await logAudit(null, req, { action: 'message_template.deactivated', entityType: 'message_template', entityId: id });
  res.json({ data: { ok: true } });
}));

router.get('/appointment/:appointmentId', requirePermission('reminders.manage'), asyncHandler(async (req, res) => {
  const appointmentId = requireId(req.params.appointmentId, 'Appointment');
  const { rows } = await query(
    `SELECT a.*, p.full_name AS patient_name, p.patient_no, p.mobile, p.alternate_mobile, p.email,
            u.full_name AS dentist_name
     FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = a.dentist_id
     WHERE a.id = $1`,
    [appointmentId]
  );
  if (!rows[0]) throw ApiError.notFound('Appointment not found');
  const clinic = await getClinic();
  const [templates, log] = await Promise.all([
    query(`SELECT * FROM message_templates WHERE is_active ORDER BY channel, purpose, name`),
    query(
      `SELECT r.*, u.full_name AS sent_by_name, t.name AS template_name
       FROM appointment_reminders r LEFT JOIN users u ON u.id = r.sent_by
       LEFT JOIN message_templates t ON t.id = r.template_id
       WHERE r.appointment_id = $1 ORDER BY r.sent_at DESC`,
      [appointmentId]
    )
  ]);
  const context = appointmentContext(rows[0], clinic);
  res.json({
    data: {
      appointment: {
        id: rows[0].id,
        appointmentNo: rows[0].appointment_no,
        patientId: rows[0].patient_id,
        patientName: rows[0].patient_name,
        patientNo: rows[0].patient_no,
        mobile: rows[0].mobile,
        alternateMobile: rows[0].alternate_mobile,
        email: rows[0].email,
        dentistName: rows[0].dentist_name,
        clinicName: clinic?.name || 'ZhanX DentalCare',
        appointmentDate: rows[0].appointment_date,
        startTime: rows[0].start_time,
        status: rows[0].status,
        lastReminderAt: rows[0].last_reminder_at,
        reminderCount: rows[0].reminder_count
      },
      context,
      templates: templates.rows.map((t) => ({ ...t, preview: renderTemplate(t.body, context) })),
      history: log.rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        messageBody: r.message_body,
        status: r.status,
        error: r.error,
        templateName: r.template_name,
        sentByName: r.sent_by_name,
        sentAt: r.sent_at
      }))
    }
  });
}));

const sendSchema = z.object({
  appointmentId: z.string().uuid('Select an appointment'),
  templateId: z.string().uuid().nullable().optional(),
  channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
  messageBody: z.string().trim().min(5, 'Message is too short').max(2000),
  status: z.enum(['sent', 'opened', 'prepared', 'failed', 'cancelled']).default('opened'),
  error: z.string().trim().max(500).nullable().optional(),
  logCommunication: z.boolean().optional()
});

router.post('/send', requirePermission('reminders.manage'), asyncHandler(async (req, res) => {
  const body = validate(sendSchema, req.body);

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT a.*, p.full_name AS patient_name, p.mobile, p.email FROM appointments a
       JOIN patients p ON p.id = a.patient_id WHERE a.id = $1 FOR UPDATE`,
      [body.appointmentId]
    );
    const appointment = rows[0];
    if (!appointment) throw ApiError.notFound('Appointment not found');
    if (['cancelled', 'no_show'].includes(appointment.status)) {
      throw ApiError.conflict('Cannot send a reminder for a cancelled or no-show appointment');
    }

    const { rows: reminderRows } = await client.query(
      `INSERT INTO appointment_reminders (appointment_id, patient_id, template_id, channel, message_body,
         status, error, sent_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.appointmentId, appointment.patient_id, body.templateId || null, body.channel,
        body.messageBody, body.status, body.error || null, req.user.id]
    );

    if (['sent', 'opened', 'prepared'].includes(body.status)) {
      await client.query(
        `UPDATE appointments SET last_reminder_at = now(), reminder_count = reminder_count + 1, updated_by = $2
         WHERE id = $1`,
        [body.appointmentId, req.user.id]
      );
    }

    let communicationId = null;
    if (body.logCommunication !== false && ['sent', 'opened', 'prepared'].includes(body.status)) {
      const outcome = body.status === 'sent' ? 'message_sent' : 'message_opened';
      const { rows: commRows } = await client.query(
        `INSERT INTO patient_communications (patient_id, appointment_id, channel, direction, purpose, outcome, notes, created_by)
         VALUES ($1,$2,$3,'outbound','reminder',$4,$5,$6) RETURNING id`,
        [appointment.patient_id, body.appointmentId, body.channel, outcome,
          `Reminder for ${appointment.appointment_no} (${fmtDate(appointment.appointment_date)} ${fmtTime(appointment.start_time)}) [${body.status}]`, req.user.id]
      );
      communicationId = commRows[0].id;
    }

    return { reminder: reminderRows[0], communicationId };
  });

  await logAudit(null, req, {
    action: ['sent', 'opened', 'prepared'].includes(body.status) ? 'appointment.reminder_sent' : 'appointment.reminder_failed',
    entityType: 'appointment',
    entityId: body.appointmentId,
    details: { channel: body.channel, templateId: body.templateId || null, status: body.status }
  });

  res.status(201).json({ data: { reminder: result.reminder, communicationId: result.communicationId } });
}));

router.get('/log', requirePermission('reminders.manage'), asyncHandler(async (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (req.query.appointmentId) {
    params.push(req.query.appointmentId);
    where.push(`r.appointment_id = $${params.length}`);
  }
  if (req.query.patientId) {
    params.push(req.query.patientId);
    where.push(`r.patient_id = $${params.length}`);
  }
  params.push(Math.min(300, Number.parseInt(req.query.pageSize, 10) || 100));
  const { rows } = await query(
    `SELECT r.*, p.full_name AS patient_name, p.patient_no, a.appointment_no,
            u.full_name AS sent_by_name, t.name AS template_name
     FROM appointment_reminders r
     JOIN patients p ON p.id = r.patient_id
     JOIN appointments a ON a.id = r.appointment_id
     LEFT JOIN users u ON u.id = r.sent_by
     LEFT JOIN message_templates t ON t.id = r.template_id
     WHERE ${where.join(' AND ')}
     ORDER BY r.sent_at DESC LIMIT $${params.length}`,
    params
  );
  res.json({ data: rows });
}));

export default router;
