import crypto from 'node:crypto';
import fs from 'node:fs';
import { LICENSE_FORMAT, LICENSE_VERSION, PRODUCT_ID, signingInput } from '../../../apps/server/src/licensing/license-format.js';
import { verifyLicense } from '../../../apps/server/src/licensing/license-verifier.js';

const DEVICE_ID_PATTERN = /^ZXDC-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

export function loadPrivateKey(keyPath) {
  const pem = fs.readFileSync(keyPath, 'utf8');
  const key = crypto.createPrivateKey({ key: pem, format: 'pem' });
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('The signing key must be Ed25519');
  return key;
}

export function publicKeyFromPrivate(privateKey) {
  return crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).toString('base64');
}

export function newLicenseId(now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `LIC-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function createLicense({
  privateKey,
  deviceId,
  clinicName,
  dentistName = null,
  licenseType = 'perpetual',
  expiresAt = null,
  features = ['*'],
  licenseId = newLicenseId(),
  issuedAt = new Date().toISOString()
}) {
  if (!DEVICE_ID_PATTERN.test(deviceId || '')) {
    throw new Error('Device ID must look like ZXDC-7A91-2F83-C4D8');
  }
  if (licenseType !== 'perpetual' && licenseType !== 'subscription' && licenseType !== 'evaluation') {
    throw new Error('License type must be perpetual, subscription or evaluation');
  }
  if (licenseType === 'perpetual' && expiresAt) throw new Error('A perpetual license must not have an expiry date');
  if (licenseType !== 'perpetual' && !expiresAt) throw new Error('A subscription or evaluation license requires an expiry date');

  const payload = {
    licenseId,
    productId: PRODUCT_ID,
    licenseVersion: LICENSE_VERSION,
    deviceId,
    clinicName,
    dentistName,
    licenseType,
    issuedAt,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    features
  };
  const signature = crypto.sign(null, Buffer.from(signingInput(payload), 'utf8'), privateKey).toString('base64');
  return { format: LICENSE_FORMAT, payload, signature };
}

export function verifyLicenseFile({ text, publicKey, deviceId = null }) {
  if (deviceId) return verifyLicense({ text, publicKey, deviceId });
  const parsed = JSON.parse(text);
  const result = verifyLicense({ text, publicKey, deviceId: parsed.payload.deviceId });
  return result;
}

export function appendHistory(historyPath, entry) {
  let history = [];
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    } catch {
      history = [];
    }
  }
  history.push(entry);
  fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`);
}
