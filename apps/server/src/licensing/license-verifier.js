import crypto from 'node:crypto';
import { LICENSE_FORMAT, LICENSE_VERSION, PRODUCT_ID, signingInput } from './license-format.js';

function publicKeyFrom(value) {
  if (!value) throw new Error('License verification key is not configured');
  const text = String(value).trim();
  const keyObject = text.includes('BEGIN PUBLIC KEY')
    ? crypto.createPublicKey({ key: text, format: 'pem' })
    : crypto.createPublicKey({ key: Buffer.from(text, 'base64'), format: 'der', type: 'spki' });
  if (keyObject.asymmetricKeyType !== 'ed25519') throw new Error('License verification key must be Ed25519');
  return keyObject;
}

const fail = (code, message) => ({ ok: false, code, message });

export function parseLicenseText(text) {
  if (typeof text === 'string' && text.length > 64 * 1024) {
    return { ok: false, code: 'LICENSE_INVALID', message: 'The license file is too large to be a valid ZhanX license.' };
  }
  let parsed;
  try {
    parsed = typeof text === 'string' ? JSON.parse(text) : text;
  } catch {
    return { ok: false, code: 'LICENSE_INVALID', message: 'The license file is not valid JSON. Request a new license file.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, code: 'LICENSE_INVALID', message: 'The license file is empty or malformed.' };
  }
  if (parsed.format !== LICENSE_FORMAT || !parsed.payload || typeof parsed.signature !== 'string') {
    return { ok: false, code: 'LICENSE_INVALID', message: 'This file is not a ZhanX DentalCare license.' };
  }
  return { ok: true, license: parsed };
}

export function verifyLicense({ text, publicKey, deviceId, now = new Date() }) {
  const parsed = parseLicenseText(text);
  if (!parsed.ok) return parsed;

  const { license } = parsed;
  let verified = false;
  try {
    const key = publicKeyFrom(publicKey);
    verified = crypto.verify(
      null,
      Buffer.from(signingInput(license.payload), 'utf8'),
      key,
      Buffer.from(license.signature, 'base64')
    );
  } catch {
    verified = false;
  }
  if (!verified) {
    return fail('LICENSE_SIGNATURE_INVALID', 'The license signature is invalid. The file was modified or was not issued by ZhanX Studio.');
  }

  const payload = license.payload;
  if (payload.productId !== PRODUCT_ID) {
    return fail('LICENSE_PRODUCT_MISMATCH', 'This license was issued for a different ZhanX product.');
  }
  if (payload.licenseVersion !== LICENSE_VERSION) {
    return fail('LICENSE_VERSION_UNSUPPORTED', `This license version (${payload.licenseVersion}) is not supported by this application build.`);
  }
  if (typeof payload.deviceId !== 'string' || payload.deviceId !== deviceId) {
    return fail(
      'LICENSE_DEVICE_MISMATCH',
      'This license was issued for a different computer. Send the Device ID shown on the activation screen to your license administrator.'
    );
  }
  if (payload.expiresAt) {
    const expiry = new Date(payload.expiresAt);
    if (Number.isNaN(expiry.getTime())) {
      return fail('LICENSE_INVALID', 'The license expiry date is malformed.');
    }
    if (expiry.getTime() <= now.getTime()) {
      return fail('LICENSE_EXPIRED', `This license expired on ${expiry.toISOString().slice(0, 10)}. Request a renewal to continue.`);
    }
  }
  return { ok: true, license, payload };
}

export function licenseSummary(payload) {
  return {
    licenseId: payload.licenseId,
    productId: payload.productId,
    licenseVersion: payload.licenseVersion,
    deviceId: payload.deviceId,
    clinicName: payload.clinicName,
    dentistName: payload.dentistName,
    licenseType: payload.licenseType,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt || null,
    features: Array.isArray(payload.features) ? payload.features : []
  };
}
