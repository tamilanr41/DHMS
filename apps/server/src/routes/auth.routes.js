import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { validate } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate } from '../middleware/auth.js';
import { login, refreshSession, logout, changePassword, loadUserWithPermissions, toClientUser } from '../services/auth.service.js';
import { getLicenseStatus } from '../licensing/license.service.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts. Please wait 15 minutes.', code: 'RATE_LIMITED' } }
});

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(200)
});

async function assertLicensed() {
  const license = await getLicenseStatus();
  if (!license.activated) {
    throw new ApiError(403, license.message || 'ZhanX DentalCare is not activated on this computer.', {
      code: 'LICENSE_REQUIRED'
    });
  }
}

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  await assertLicensed();
  const body = validate(loginSchema, req.body);
  const result = await login(body, req);
  res.json({ data: result });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  await assertLicensed();
  const { refreshToken } = req.body || {};
  const result = await refreshSession(refreshToken, req);
  res.json({ data: result });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  await logout(refreshToken, req);
  res.json({ data: { ok: true } });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const profile = await loadUserWithPermissions(req.user.id);
  res.json({ data: toClientUser(profile) });
}));

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200)
});

router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const body = validate(changePasswordSchema, req.body);
  await changePassword(req.user.id, body, req);
  res.json({ data: { ok: true } });
}));

export default router;
