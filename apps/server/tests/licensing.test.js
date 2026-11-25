import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import request from 'supertest';
import { closeDatabase, getApp, getPool } from './helpers/testDb.js';
import {
  activateTestLicense,
  currentDeviceId,
  issueTestLicense,
  licenseDir,
  removeLicense,
  testPrivateKey,
  writeLicense
} from './helpers/licensing.js';
import { licenseFilePath, resetLicenseCache } from '../src/licensing/license.service.js';
import { resetDeviceIdentityCache } from '../src/licensing/device-identity.js';
import { createLicense } from '../../../tools/license-generator/lib/issue.js';
import { licenseSummary } from '../src/licensing/license-verifier.js';

const app = await getApp();
let deviceId;
let adminSession;

const CLINIC = {
  clinicName: 'Smile Dental Clinic',
  dentistName: 'Dr. Arjun Mehta',
  address: '12 MG Road, Kochi',
  contactNumber: '+91 98450 12345'
};

test.before(async () => {
  deviceId = await currentDeviceId();
  removeLicense();
});

test.after(async () => {
  // Later test files depend on an activated database.
  await activateTestLicense();
  await closeDatabase();
});

test('a fresh installation reports a stable Device ID and is not activated', async () => {
  const res = await request(app).get('/api/license/status');
  assert.equal(res.status, 200);
  assert.match(res.body.data.deviceId, /^ZXDC-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.equal(res.body.data.deviceId, deviceId);
  assert.equal(res.body.data.activated, false);
  assert.equal(res.body.data.reason, 'LICENSE_MISSING');
  assert.equal(res.body.data.setupRequired, true);
  assert.equal(res.body.data.license, null);
});

test('missing activation information does not bypass licensing or expose patient data', async () => {
  const patients = await request(app).get('/api/patients');
  assert.equal(patients.status, 403);
  assert.equal(patients.body.error.code, 'LICENSE_REQUIRED');
  assert.equal(patients.body.data, undefined);

  const login = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'Admin@Test123' });
  assert.equal(login.status, 403);
  assert.equal(login.body.error.code, 'LICENSE_REQUIRED');

  const dashboard = await request(app).get('/api/dashboard');
  assert.equal(dashboard.status, 403);
});

test('a license issued for another computer is rejected', async () => {
  const other = issueTestLicense({ deviceId: 'ZXDC-0000-1111-2222' });
  const res = await request(app).post('/api/license/activate').send({ license: other, clinic: CLINIC });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'LICENSE_DEVICE_MISMATCH');
  assert.equal((await request(app).get('/api/license/status')).body.data.activated, false);
});

test('a modified payload or forged signature is rejected', async () => {
  const license = issueTestLicense({ deviceId });
  const tampered = JSON.parse(JSON.stringify(license));
  tampered.payload.clinicName = 'Attacker Clinic';
  let res = await request(app).post('/api/license/activate').send({ license: tampered, clinic: CLINIC });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'LICENSE_SIGNATURE_INVALID');

  const forged = JSON.parse(JSON.stringify(license));
  forged.signature = Buffer.from('not a signature').toString('base64');
  res = await request(app).post('/api/license/activate').send({ license: forged, clinic: CLINIC });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'LICENSE_SIGNATURE_INVALID');
});

test('an expired license follows the configured expiry policy', async () => {
  const expired = issueTestLicense({ deviceId, type: 'subscription', expiresAt: '2020-01-01T00:00:00.000Z' });
  const res = await request(app).post('/api/license/activate').send({ license: expired, clinic: CLINIC });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'LICENSE_EXPIRED');
});

test('a valid license activates the device, stores clinic details and survives restart', async () => {
  const license = issueTestLicense({ deviceId, clinicName: CLINIC.clinicName });
  const res = await request(app).post('/api/license/activate').send({ license, clinic: CLINIC });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.activated, true);
  assert.equal(res.body.data.setupRequired, false);
  assert.equal(res.body.data.license.clinicName, 'Smile Dental Clinic');
  assert.ok(fs.existsSync(licenseFilePath()));

  const pool = await getPool();
  const { rows } = await pool.query('SELECT clinic_name, dentist_name, address, phone FROM clinic_settings WHERE id = 1');
  assert.equal(rows[0].clinic_name, CLINIC.clinicName);
  assert.equal(rows[0].dentist_name, CLINIC.dentistName);

  // Simulated restart: no cached identity or verification may be needed.
  resetLicenseCache();
  resetDeviceIdentityCache();
  const after = await request(app).get('/api/license/status');
  assert.equal(after.body.data.activated, true);
  assert.equal(after.body.data.reason, null);

  const login = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'Admin@Test123' });
  assert.equal(login.status, 200);
  adminSession = login.body.data;
});

test('backend authorization cannot be bypassed by frontend state', async () => {
  const noToken = await request(app).get('/api/patients');
  assert.equal(noToken.status, 401);
  const forged = await request(app).get('/api/patients').set('Authorization', 'Bearer forged-token');
  assert.equal(forged.status, 401);
});

test('corrupted activation data fails closed with a recoverable state', async () => {
  fs.writeFileSync(licenseFilePath(), '{ not valid json', 'utf8');
  resetLicenseCache();
  const status = await request(app).get('/api/license/status');
  assert.equal(status.body.data.activated, false);
  assert.equal(status.body.data.reason, 'LICENSE_INVALID');
  assert.match(status.body.data.message, /not valid JSON|license/i);

  const patients = await request(app).get('/api/patients');
  assert.equal(patients.status, 403);

  // Recovery: re-import a correctly signed license for this device.
  const recovered = await request(app).post('/api/license/activate').send({
    license: issueTestLicense({ deviceId }),
    clinic: CLINIC
  });
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.data.activated, true);

  const login = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'Admin@Test123' });
  assert.equal(login.status, 200);
  adminSession = login.body.data;
});

test('replacing an active license requires a signed-in administrator', async () => {
  const replacement = issueTestLicense({ deviceId, clinicName: 'Renamed Clinic' });
  const anonymous = await request(app).post('/api/license/activate').send({ license: replacement, clinic: CLINIC });
  assert.equal(anonymous.status, 401);

  const withAdmin = await request(app)
    .post('/api/license/activate')
    .set('Authorization', `Bearer ${adminSession.accessToken}`)
    .send({ license: replacement, clinic: CLINIC });
  assert.equal(withAdmin.status, 200);
  assert.equal(withAdmin.body.data.license.clinicName, 'Renamed Clinic');
});

test('initial setup is closed once an administrator exists', async () => {
  const status = await request(app).get('/api/setup/status');
  assert.equal(status.status, 200);
  assert.equal(status.body.data.licenseActive, true);
  assert.equal(status.body.data.setupRequired, false);

  const res = await request(app).post('/api/setup').send({ fullName: 'Second Admin', username: 'second.admin', password: 'Setup@12345' });
  assert.equal(res.status, 409);
});

test('tampering with the stored license file is detected on the next check', async () => {
  const license = issueTestLicense({ deviceId });
  license.payload.clinicName = 'Edited On Disk';
  writeLicense(license); // signature no longer matches the edited payload
  resetLicenseCache();
  const status = await request(app).get('/api/license/status');
  assert.equal(status.body.data.activated, false);
  assert.equal(status.body.data.reason, 'LICENSE_SIGNATURE_INVALID');

  await activateTestLicense();
});

test('license verification module accepts only canonical signed payloads', () => {
  const license = createLicense({
    privateKey: testPrivateKey(),
    deviceId,
    clinicName: 'Canonical Clinic',
    licenseType: 'perpetual'
  });
  const summary = licenseSummary(license.payload);
  assert.equal(summary.deviceId, deviceId);
  assert.equal(summary.productId, 'zhanx-dentalcare');
  assert.ok(fs.existsSync(licenseDir()));
});
