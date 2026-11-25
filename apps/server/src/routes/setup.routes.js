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
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many setup attempts. Please wait 15 minutes.', code: 'RATE_LIMITED' } }
});

async function userCount() {
  const { rows } = await query('SELECT count(*)::int AS count FROM users');
  return rows[0].count;
}

router.get('/status', asyncHandler(async (req, res) => {
  const license = await getLicenseStatus();
  const count = await userCount();
  res.json({
    data: {
      licenseActive: license.activated,
      setupRequired: license.activated && count === 0,
      clinicName: license.license?.clinicName || null,
      dentistName: license.license?.dentistName || null
    }
  });
}));

const setupSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(200),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, numbers, dots, underscores or hyphens'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200)
});

router.post('/', setupLimiter, asyncHandler(async (req, res) => {
  const body = validate(setupSchema, req.body);
  const license = await getLicenseStatus();
  if (!license.activated) {
    throw new ApiError(403, 'Activate ZhanX DentalCare before creating the administrator account.', { code: 'LICENSE_REQUIRED' });
  }
  if ((await userCount()) > 0) {
    throw ApiError.conflict('Initial setup has already been completed. Sign in with an administrator account.');
  }
  const policyError = passwordPolicyError(body.password);
  if (policyError) throw ApiError.unprocessable(policyError);

  const hash = await hashPassword(body.password);
  let created;
  try {
    created = await withTransaction(async (client) => {
      // Serialize concurrent first-run requests so only one administrator can win.
      await client.query('SELECT pg_advisory_xact_lock(823641)');
      const { rows } = await client.query('SELECT count(*)::int AS count FROM users');
      if (rows[0].count > 0) {
        throw ApiError.conflict('Initial setup has already been completed. Sign in with an administrator account.');
      }
      const inserted = await client.query(
        `INSERT INTO users (username, password_hash, full_name, role_id)
         VALUES ($1,$2,$3,(SELECT id FROM roles WHERE code = 'admin'))
         RETURNING id, username, full_name`,
        [body.username, hash, body.fullName]
      );
      return inserted.rows[0];
    });
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict('That username is already in use.');
    throw err;
  }

  await logAudit(null, req, {
    action: 'setup.administrator_created',
    entityType: 'user',
    entityId: created.id,
    details: { username: created.username }
  });

  res.status(201).json({ data: { id: created.id, username: created.username, fullName: created.full_name } });
}));

export default router;
