import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { hashPassword, passwordPolicyError } from '../utils/password.js';
import { getLicenseStatus } from '../licensing/license.service.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();

const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many setup attempts. Please wait 15 minutes.', code: 'RATE_LIMITED' } }
});

router.get('/status', asyncHandler(async (req, res) => {
  const { clinicCode, clinicId } = req.query;

  let clinic = null;
  if (clinicId) {
    const q = await query('SELECT * FROM clinic_tenants WHERE id = $1', [clinicId]);
    if (q.rows.length) clinic = q.rows[0];
  } else if (clinicCode) {
    const q = await query('SELECT * FROM clinic_tenants WHERE clinic_code = $1', [clinicCode]);
    if (q.rows.length) clinic = q.rows[0];
  } else {
    // Check if any active clinic exists
    const q = await query("SELECT * FROM clinic_tenants WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1");
    if (q.rows.length) clinic = q.rows[0];
  }

  if (clinic) {
    const { rows } = await query(
      'SELECT count(*)::int AS count FROM users WHERE clinic_id = $1',
      [clinic.id]
    );
    const count = rows[0].count;

    return res.json({
      data: {
        licenseActive: clinic.status === 'active',
        setupRequired: clinic.status === 'active' && count === 0,
        clinicId: clinic.id,
        clinicCode: clinic.clinic_code,
        clinicName: clinic.clinic_name,
        dentistName: clinic.doctor_name,
        userCount: count
      }
    });
  }

  // Fallback if no clinic tenant found
  const license = await getLicenseStatus();
  const { rows } = await query('SELECT count(*)::int AS count FROM users');
  res.json({
    data: {
      licenseActive: Boolean(license.activated),
      setupRequired: Boolean(license.activated) && rows[0].count === 0,
      clinicName: license.license?.clinicName || null,
      dentistName: license.license?.dentistName || null,
      userCount: rows[0].count
    }
  });
}));

const setupSchema = z.object({
  clinicCode: z.string().optional(),
  clinicId: z.string().optional(),
  fullName: z.string().trim().min(2, 'Full name is required').max(200),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, numbers, dots, underscores or hyphens'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  roleCode: z.string().default('admin')
});

router.post('/', setupLimiter, asyncHandler(async (req, res) => {
  const body = validate(setupSchema, req.body);

  // 1. Resolve clinic
  let clinic = null;
  if (body.clinicId) {
    const q = await query('SELECT * FROM clinic_tenants WHERE id = $1', [body.clinicId]);
    if (q.rows.length) clinic = q.rows[0];
  } else if (body.clinicCode) {
    const q = await query('SELECT * FROM clinic_tenants WHERE clinic_code = $1', [body.clinicCode]);
    if (q.rows.length) clinic = q.rows[0];
  } else {
    const q = await query("SELECT * FROM clinic_tenants WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1");
    if (q.rows.length) clinic = q.rows[0];
  }

  if (clinic && clinic.status !== 'active') {
    throw new ApiError(403, 'Your clinic registration is still awaiting administrator activation.', { code: 'CLINIC_NOT_ACTIVE' });
  }

  // 2. Validate password policy
  const policyError = passwordPolicyError(body.password);
  if (policyError) throw ApiError.unprocessable(policyError);

  const hash = await hashPassword(body.password);
  const targetClinicId = clinic ? clinic.id : null;

  let created;
  try {
    created = await withTransaction(async (client) => {
      // Check if clinic already has users
      if (targetClinicId) {
        const { rows } = await client.query('SELECT count(*)::int AS count FROM users WHERE clinic_id = $1', [targetClinicId]);
        if (rows[0].count > 0) {
          throw ApiError.conflict('Clinic administrator account already exists. Please sign in.');
        }
      }

      // Find role
      const roleQ = await client.query('SELECT id FROM roles WHERE code = $1', [body.roleCode || 'admin']);
      const roleId = roleQ.rows[0]?.id || (await client.query("SELECT id FROM roles WHERE code = 'admin'")).rows[0].id;

      const inserted = await client.query(
        `INSERT INTO users (username, password_hash, full_name, role_id, clinic_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, full_name, clinic_id`,
        [body.username.toLowerCase(), hash, body.fullName, roleId, targetClinicId]
      );

      // Create clinic_settings if none exists for this clinic
      if (clinic) {
        await client.query(
          `INSERT INTO clinic_settings (clinic_name, dentist_name, phone, address, clinic_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [clinic.clinic_name, clinic.doctor_name, clinic.mobile, clinic.city, clinic.id]
        );
      }

      return inserted.rows[0];
    });
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('That username is already taken for this clinic.');
    throw err;
  }

  await logAudit(null, req, {
    action: 'setup.clinic_administrator_created',
    entityType: 'user',
    entityId: created.id,
    details: { username: created.username, clinicId: targetClinicId }
  });

  res.status(201).json({
    success: true,
    data: {
      id: created.id,
      username: created.username,
      fullName: created.full_name,
      clinicId: created.clinic_id
    },
    message: 'Clinic administrator account created successfully.'
  });
}));

export default router;
