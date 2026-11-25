import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate } from '../middleware/auth.js';
import { activateLicense, getLicenseInfo, getLicenseStatus } from '../licensing/license.service.js';
import { getDeviceIdentity } from '../licensing/device-identity.js';
import { licenseSummary, verifyLicense } from '../licensing/license-verifier.js';
import { config } from '../config/env.js';

const router = Router();

const activationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many activation attempts. Please wait 15 minutes.', code: 'RATE_LIMITED' } }
});

const activationSchema = z.object({
  license: z.union([z.string().min(2).max(64 * 1024), z.record(z.any())]),
  clinic: z.object({
    clinicName: z.string().trim().min(2, 'Clinic name is required').max(200),
    dentistName: z.string().trim().min(2, 'Dentist name is required').max(200),
    address: z.string().trim().min(3, 'Clinic address is required').max(500),
    contactNumber: z.string().trim().min(6, 'Contact number is required').max(40)
  })
});

router.get('/status', asyncHandler(async (req, res) => {
  res.json({ data: await getLicenseStatus() });
}));

router.get('/info', asyncHandler(async (req, res) => {
  res.json({ data: await getLicenseInfo() });
}));

async function authenticateAdmin(req) {
  await new Promise((resolve, reject) => {
    authenticate(req, null, (err) => (err ? reject(err) : resolve()));
  });
  if (req.user?.role !== 'admin') {
    throw ApiError.forbidden('Only an administrator can replace an active license');
  }
}

// Preview a license before activating: verifies signature, product and device binding.
// Nothing is stored, and no access is granted by a successful inspection.
router.post('/inspect', activationLimiter, asyncHandler(async (req, res) => {
  const body = validate(z.object({ license: z.union([z.string().min(2).max(64 * 1024), z.record(z.any())]) }), req.body);
  const device = await getDeviceIdentity();
  const text = typeof body.license === 'string' ? body.license : JSON.stringify(body.license);
  const result = verifyLicense({ text, publicKey: config.licensing.publicKey, deviceId: device.deviceId });
  res.json({
    data: {
      valid: Boolean(result.ok),
      code: result.ok ? null : result.code,
      message: result.ok ? null : result.message,
      deviceId: device.deviceId,
      license: result.ok ? licenseSummary(result.payload) : null
    }
  });
}));

router.post('/activate', activationLimiter, asyncHandler(async (req, res) => {
  const body = validate(activationSchema, req.body);
  const status = await getLicenseStatus();

  // The first activation is necessarily unauthenticated (nobody can sign in yet).
  // Replacing an active license requires a signed-in administrator.
  if (status.activated) await authenticateAdmin(req);

  const licenseText = typeof body.license === 'string' ? body.license : JSON.stringify(body.license);
  const result = await activateLicense({ licenseText, clinic: body.clinic, req });
  res.json({ data: result });
}));

export default router;
