import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createLicense } from '../../../../tools/license-generator/lib/issue.js';
import { config } from '../../src/config/env.js';
import { getDeviceIdentity, resetDeviceIdentityCache } from '../../src/licensing/device-identity.js';
import { licenseFilePath, resetLicenseCache } from '../../src/licensing/license.service.js';

export function testPrivateKey() {
  const seed = Buffer.from(process.env.ZHANX_TEST_LICENSE_SEED, 'hex');
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  return crypto.createPrivateKey({ key: Buffer.concat([prefix, seed]), format: 'der', type: 'pkcs8' });
}

export async function currentDeviceId() {
  resetDeviceIdentityCache();
  return (await getDeviceIdentity({ refresh: true })).deviceId;
}

export function issueTestLicense({ deviceId, clinicName = 'Test Dental Clinic', type = 'perpetual', expiresAt = null } = {}) {
  return createLicense({
    privateKey: testPrivateKey(),
    deviceId,
    clinicName,
    dentistName: 'Dr. Test Dentist',
    licenseType: type,
    expiresAt
  });
}

export function writeLicense(license) {
  fs.mkdirSync(config.licensing.dir, { recursive: true });
  fs.writeFileSync(licenseFilePath(), `${JSON.stringify(license, null, 2)}\n`, { mode: 0o600 });
  resetLicenseCache();
}

export function removeLicense() {
  fs.rmSync(licenseFilePath(), { force: true });
  resetLicenseCache();
}

export async function activateTestLicense(options = {}) {
  const deviceId = options.deviceId || (await currentDeviceId());
  const license = issueTestLicense({ ...options, deviceId });
  writeLicense(license);
  return { license, deviceId };
}

export function licenseDir() {
  return path.dirname(licenseFilePath());
}
