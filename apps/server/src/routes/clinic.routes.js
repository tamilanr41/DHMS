import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../database/db.js';
import { validate } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { uploadBrandingImage, DATA_DIRS } from '../middleware/upload.js';
import { getClinic } from '../services/clinic.service.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  res.json({ data: await getClinic() });
}));

const settingsSchema = z.object({
  clinicName: z.string().trim().min(1).max(150).optional(),
  address: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email().max(150).nullable().optional().or(z.literal('')),
  website: z.string().trim().max(200).nullable().optional(),
  workingHours: z.record(z.any()).optional(),
  currency: z.string().trim().min(1).max(10).optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
  receiptFooter: z.string().trim().max(500).nullable().optional(),
  prescriptionFooter: z.string().trim().max(500).nullable().optional(),
  dentistName: z.string().trim().max(150).nullable().optional(),
  dentistQualification: z.string().trim().max(150).nullable().optional(),
  dentistRegistrationNo: z.string().trim().max(100).nullable().optional(),
  dentistContact: z.string().trim().max(100).nullable().optional(),
  appointmentSlotMinutes: z.coerce.number().int().min(5).max(240).optional(),
  invoicePrefix: z.string().trim().min(1).max(10).optional(),
  patientPrefix: z.string().trim().min(1).max(10).optional(),
  prescriptionPrefix: z.string().trim().min(1).max(10).optional(),
  sessionTimeoutMinutes: z.coerce.number().int().min(5).max(480).optional(),
  labModuleEnabled: z.boolean().optional(),
  taxEnabled: z.boolean().optional(),
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  defaultPaymentMethods: z.array(z.string().trim().min(1).max(50)).min(1).max(10).optional(),
  recallMonths: z.coerce.number().int().min(1).max(60).optional(),
  toothNumbering: z.enum(['fdi', 'universal', 'palmer']).optional(),
  periodontalChartingEnabled: z.boolean().optional(),
  labWorkTypes: z.array(z.string().trim().min(1).max(80)).min(1).max(40).optional(),
  backupPreferences: z.record(z.any()).optional()
});

const COLUMN_MAP = {
  clinicName: 'clinic_name',
  address: 'address',
  phone: 'phone',
  email: 'email',
  website: 'website',
  workingHours: 'working_hours',
  currency: 'currency',
  timezone: 'timezone',
  receiptFooter: 'receipt_footer',
  prescriptionFooter: 'prescription_footer',
  dentistName: 'dentist_name',
  dentistQualification: 'dentist_qualification',
  dentistRegistrationNo: 'dentist_registration_no',
  dentistContact: 'dentist_contact',
  appointmentSlotMinutes: 'appointment_slot_minutes',
  invoicePrefix: 'invoice_prefix',
  patientPrefix: 'patient_prefix',
  prescriptionPrefix: 'prescription_prefix',
  sessionTimeoutMinutes: 'session_timeout_minutes',
  labModuleEnabled: 'lab_module_enabled',
  taxEnabled: 'tax_enabled',
  taxPercent: 'tax_percent',
  defaultPaymentMethods: 'default_payment_methods',
  recallMonths: 'recall_months',
  toothNumbering: 'tooth_numbering',
  periodontalChartingEnabled: 'periodontal_charting_enabled',
  labWorkTypes: 'lab_work_types',
  backupPreferences: 'backup_preferences'
};
const JSON_COLUMNS = new Set(['workingHours', 'defaultPaymentMethods', 'labWorkTypes', 'backupPreferences']);

router.patch('/', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const body = validate(settingsSchema, req.body);
  const sets = [];
  const params = [req.user.id];
  for (const [key, column] of Object.entries(COLUMN_MAP)) {
    if (body[key] === undefined) continue;
    params.push(JSON_COLUMNS.has(key) && body[key] !== null ? JSON.stringify(body[key]) : body[key]);
    sets.push(`${column} = $${params.length}${JSON_COLUMNS.has(key) ? '::jsonb' : ''}`);
  }
  if (!sets.length) throw ApiError.badRequest('No changes supplied');
  params.push(new Date());
  await query(
    `UPDATE clinic_settings SET ${sets.join(', ')}, updated_at = $${params.length}, updated_by = $1 WHERE id = 1`,
    params
  );
  await logAudit(null, req, { action: 'clinic.settings_updated', entityType: 'clinic_settings', entityId: '1', details: body });
  res.json({ data: await getClinic() });
}));

function saveBranding(kind) {
  return asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No image uploaded');
    const column = kind === 'logo' ? 'logo_path' : 'dentist_signature_path';
    const previous = (await query(`SELECT ${column} AS p FROM clinic_settings WHERE id = 1`)).rows[0]?.p;
    await query(`UPDATE clinic_settings SET ${column} = $1, updated_at = now(), updated_by = $2 WHERE id = 1`, [req.file.filename, req.user.id]);
    if (previous) {
      const oldPath = path.join(DATA_DIRS.branding, previous);
      if (fs.existsSync(oldPath)) fs.unlink(oldPath, () => {});
    }
    await logAudit(null, req, { action: `clinic.${kind}_updated`, entityType: 'clinic_settings', entityId: '1' });
    res.json({ data: { fileName: req.file.filename } });
  });
}

router.post('/logo', requirePermission('settings.manage'), uploadBrandingImage.single('file'), saveBranding('logo'));
router.post('/signature', requirePermission('settings.manage'), uploadBrandingImage.single('file'), saveBranding('signature'));

router.get('/files/:kind', asyncHandler(async (req, res) => {
  const kind = req.params.kind;
  if (!['logo', 'signature'].includes(kind)) throw ApiError.notFound();
  const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  const column = kind === 'logo' ? 'logo_path' : 'dentist_signature_path';
  const { rows } = await query(`SELECT ${column} AS file_name FROM clinic_settings ORDER BY id ASC LIMIT 1`);
  const fileName = rows[0]?.file_name;
  if (!fileName) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.type('image/gif').send(transparentGif);
  }
  const filePath = path.join(DATA_DIRS.branding, path.basename(fileName));
  if (!fs.existsSync(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.type('image/gif').send(transparentGif);
  }
  res.sendFile(filePath);
}));

export default router;
