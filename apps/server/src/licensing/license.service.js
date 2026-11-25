import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.js';
import { query } from '../database/db.js';
import { ApiError } from '../utils/errors.js';
import { logAudit } from '../services/audit.service.js';
import { getDeviceIdentity } from './device-identity.js';
import { licenseSummary, verifyLicense } from './license-verifier.js';

const LICENSE_FILE_NAME = 'zhanx.license.json';
const CACHE_TTL_MS = 20_000;

let verificationCache = null;

export function licenseFilePath() {
  return path.join(config.licensing.dir, LICENSE_FILE_NAME);
}

export function resetLicenseCache() {
  verificationCache = null;
}

function readStoredLicense() {
  const filePath = licenseFilePath();
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 64 * 1024) return { ok: false, code: 'LICENSE_INVALID', message: 'The stored license file is invalid.' };
    return { ok: true, text: fs.readFileSync(filePath, 'utf8'), mtimeMs: stat.mtimeMs };
  } catch {
    return { ok: false, code: 'LICENSE_MISSING', missing: true };
  }
}

async function verifyStoredLicense(deviceId) {
  const stored = readStoredLicense();
  if (stored.missing) {
    return {
      ok: false,
      reason: 'LICENSE_MISSING',
      message: 'This copy of ZhanX DentalCare is not activated. Import the license file issued for this computer.'
    };
  }
  if (!stored.ok) return { ok: false, reason: stored.code, message: stored.message };

  if (
    verificationCache &&
    verificationCache.mtimeMs === stored.mtimeMs &&
    verificationCache.deviceId === deviceId &&
    Date.now() - verificationCache.at < CACHE_TTL_MS
  ) {
    return verificationCache.result;
  }

  const result = verifyLicense({ text: stored.text, publicKey: config.licensing.publicKey, deviceId });
  verificationCache = { mtimeMs: stored.mtimeMs, deviceId, at: Date.now(), result };
  return result;
}

async function setupRequired() {
  const { rows } = await query('SELECT count(*)::int AS count FROM users');
  return rows[0].count === 0;
}

export async function getLicenseStatus() {
  const base = {
    productName: 'ZhanX DentalCare',
    support: { email: config.licensing.supportEmail, phone: config.licensing.supportPhone || null }
  };

  // 1. Check if clinic is activated in Tamilan Cloud SaaS
  try {
    const { rows } = await query(
      "SELECT * FROM clinic_tenants WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1"
    );
    if (rows.length > 0) {
      const activeClinic = rows[0];
      const userQ = await query(
        'SELECT count(*)::int AS count FROM users WHERE clinic_id = $1',
        [activeClinic.id]
      );
      const isSetupNeeded = userQ.rows[0].count === 0;

      return {
        ...base,
        activated: true,
        deviceId: 'TAMILAN-CLOUD-SAAS',
        deviceProtection: 'cloud-saas',
        reason: null,
        message: null,
        license: {
          licenseId: activeClinic.clinic_code,
          clinicName: activeClinic.clinic_name,
          tier: activeClinic.plan_name || 'Enterprise Cloud Care',
          validUntil: activeClinic.valid_until || '2099-12-31'
        },
        clinicId: activeClinic.id,
        clinicCode: activeClinic.clinic_code,
        setupRequired: isSetupNeeded
      };
    }
  } catch {
    // If table not present yet, fall back to file check below
  }

  let device;
  try {
    device = await getDeviceIdentity();
  } catch (err) {
    return {
      ...base,
      activated: false,
      deviceId: null,
      deviceProtection: null,
      reason: 'DEVICE_IDENTITY_UNAVAILABLE',
      message: `The device identity could not be read: ${err.message}. Contact support for a reactivation.`,
      license: null,
      setupRequired: true
    };
  }

  const result = await verifyStoredLicense(device.deviceId);
  return {
    ...base,
    activated: Boolean(result.ok),
    deviceId: device.deviceId,
    deviceProtection: device.protection,
    reason: result.ok ? null : result.reason || result.code || 'LICENSE_INVALID',
    message: result.ok ? null : result.message,
    license: result.ok ? licenseSummary(result.payload) : null,
    setupRequired: result.ok ? await setupRequired() : true
  };
}

export async function getLicenseInfo() {
  const status = await getLicenseStatus();
  if (!status.activated) throw ApiError.forbidden(status.message || 'The application is not activated');
  return status.license;
}

function writeLicenseFile(text) {
  fs.mkdirSync(config.licensing.dir, { recursive: true });
  const parsed = JSON.parse(text);
  const temp = `${licenseFilePath()}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, licenseFilePath());
  resetLicenseCache();
}

export async function activateLicense({ licenseText, clinic, req }) {
  const device = await getDeviceIdentity();
  const result = verifyLicense({ text: licenseText, publicKey: config.licensing.publicKey, deviceId: device.deviceId });
  if (!result.ok) throw new ApiError(400, result.message, { code: result.code });

  writeLicenseFile(licenseText);

  const clinicPatch = {
    clinicName: clinic?.clinicName?.trim(),
    dentistName: clinic?.dentistName?.trim(),
    address: clinic?.address?.trim(),
    phone: clinic?.contactNumber?.trim()
  };
  await query(
    `UPDATE clinic_settings
     SET clinic_name = COALESCE(NULLIF($1,''), clinic_name),
         dentist_name = COALESCE(NULLIF($2,''), dentist_name),
         address = COALESCE(NULLIF($3,''), address),
         phone = COALESCE(NULLIF($4,''), phone)
     WHERE id = 1`,
    [clinicPatch.clinicName, clinicPatch.dentistName, clinicPatch.address, clinicPatch.phone]
  );

  await logAudit(null, req, {
    action: 'license.activate',
    entityType: 'license',
    entityId: result.payload.licenseId,
    details: { deviceId: device.deviceId, clinicName: clinicPatch.clinicName || result.payload.clinicName }
  });

  return getLicenseStatus();
}

export async function requireLicense(req, res, next) {
  try {
    const status = await getLicenseStatus();
    if (!status.activated) {
      return res.status(403).json({
        error: {
          code: 'LICENSE_REQUIRED',
          message: status.message || 'ZhanX DentalCare is not activated on this computer.',
          details: { reason: status.reason, deviceId: status.deviceId }
        }
      });
    }
    req.license = status.license;
    return next();
  } catch (err) {
    return next(err);
  }
}
