import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { closeDatabase, getApp, loginAs, TEST_PASSWORD } from './helpers/testDb.js';

const app = await getApp();

test.after(async () => {
  await closeDatabase();
});

const sessions = {};

test('signs in and returns the effective permissions', async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'Admin@Test123' });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.accessToken);
  assert.ok(res.body.data.refreshToken);
  assert.equal(res.body.data.user.role, 'admin');
  assert.ok(res.body.data.user.permissions.includes('users.manage'));
  assert.ok(res.body.data.user.permissions.includes('refunds.manage'));
  sessions.admin = res.body.data;

  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.data.accessToken}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.username, 'admin');
});

test('rejects bad credentials and missing or forged tokens', async () => {
  const bad = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong-password' });
  assert.equal(bad.status, 401);
  assert.match(bad.body.error.message, /Invalid username or password/);

  const missing = await request(app).get('/api/patients');
  assert.equal(missing.status, 401);

  const forged = await request(app).get('/api/patients').set('Authorization', 'Bearer not-a-real-token');
  assert.equal(forged.status, 401);
});

test('enforces role permissions on the server, not in the UI', async () => {
  sessions.dentist = await loginAs('dr.test');
  sessions.receptionist = await loginAs('reception.test');
  sessions.assistant = await loginAs('assistant.test');

  const asAdmin = await request(app).get('/api/users').set('Authorization', `Bearer ${sessions.admin.accessToken}`);
  assert.equal(asAdmin.status, 200);

  for (const key of ['receptionist', 'assistant', 'dentist']) {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${sessions[key].accessToken}`);
    assert.equal(res.status, 403, `${key} must not manage users`);
  }

  const assistantPatientsCreate = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${sessions.assistant.accessToken}`)
    .send({ fullName: 'Blocked Patient', mobile: '9845099999' });
  assert.equal(assistantPatientsCreate.status, 403);

  const assistantRefund = await request(app)
    .post('/api/refunds')
    .set('Authorization', `Bearer ${sessions.assistant.accessToken}`)
    .send({ invoiceId: '00000000-0000-0000-0000-000000000000', amount: 1, method: 'cash', reason: 'test', idempotencyKey: 'assistant-key-1' });
  assert.equal(assistantRefund.status, 403);

  const assistantAudit = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${sessions.assistant.accessToken}`);
  assert.equal(assistantAudit.status, 403);

  const receptionistFinancial = await request(app)
    .get('/api/reports/collections-daily')
    .set('Authorization', `Bearer ${sessions.receptionist.accessToken}`);
  assert.equal(receptionistFinancial.status, 403);
});

test('rotates refresh tokens and detects reuse of a revoked token', async () => {
  const first = sessions.admin.refreshToken;
  const res = await request(app).post('/api/auth/refresh').send({ refreshToken: first });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.accessToken);
  assert.notEqual(res.body.data.refreshToken, first);

  const replay = await request(app).post('/api/auth/refresh').send({ refreshToken: first });
  assert.equal(replay.status, 401);

  sessions.admin.accessToken = res.body.data.accessToken;
  sessions.admin.refreshToken = res.body.data.refreshToken;
});

test('logout revokes the refresh session', async () => {
  const token = sessions.receptionist.refreshToken;
  const out = await request(app).post('/api/auth/logout').send({ refreshToken: token });
  assert.equal(out.status, 200);

  const after = await request(app).post('/api/auth/refresh').send({ refreshToken: token });
  assert.equal(after.status, 401);
});

test('locks an account after repeated failures and unlocks on password reset', async () => {
  const created = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${sessions.admin.accessToken}`)
    .send({ username: 'lockme.test', password: 'LockMe@12345', fullName: 'Lock Test', roleCode: 'receptionist' });
  assert.equal(created.status, 201);
  const userId = created.body.data.id;

  for (let i = 0; i < 4; i++) {
    const res = await request(app).post('/api/auth/login').send({ username: 'lockme.test', password: 'nope-nope' });
    assert.equal(res.status, 401, `attempt ${i + 1} should be rejected`);
  }
  const locked = await request(app).post('/api/auth/login').send({ username: 'lockme.test', password: 'nope-nope' });
  assert.equal(locked.status, 423);
  assert.equal(locked.body.error.code, 'ACCOUNT_LOCKED');

  const stillLocked = await request(app).post('/api/auth/login').send({ username: 'lockme.test', password: 'LockMe@12345' });
  assert.equal(stillLocked.status, 423);

  const reset = await request(app)
    .post(`/api/users/${userId}/reset-password`)
    .set('Authorization', `Bearer ${sessions.admin.accessToken}`)
    .send({ newPassword: 'ResetMe@12345' });
  assert.equal(reset.status, 200);

  const unlocked = await request(app).post('/api/auth/login').send({ username: 'lockme.test', password: 'ResetMe@12345' });
  assert.equal(unlocked.status, 200);
});

test('changes a password only with the correct current password and policy', async () => {
  const token = sessions.assistant.accessToken;

  const wrongCurrent = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ currentPassword: 'not-the-password', newPassword: 'Another@12345' });
  assert.equal(wrongCurrent.status, 400);

  const weak = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ currentPassword: TEST_PASSWORD, newPassword: 'short' });
  assert.equal(weak.status, 422);

  const ok = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({ currentPassword: TEST_PASSWORD, newPassword: 'Assistant@2026' });
  assert.equal(ok.status, 200);

  const relogin = await request(app).post('/api/auth/login').send({ username: 'assistant.test', password: 'Assistant@2026' });
  assert.equal(relogin.status, 200);

  const oldPassword = await request(app).post('/api/auth/login').send({ username: 'assistant.test', password: TEST_PASSWORD });
  assert.equal(oldPassword.status, 401);
});

test('deactivated accounts cannot sign in or keep using a session', async () => {
  const token = sessions.dentist.accessToken;
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(me.status, 200);
  const dentistId = me.body.data.id;

  const deactivate = await request(app)
    .patch(`/api/users/${dentistId}`)
    .set('Authorization', `Bearer ${sessions.admin.accessToken}`)
    .send({ isActive: false });
  assert.equal(deactivate.status, 200);

  const login = await request(app).post('/api/auth/login').send({ username: 'dr.test', password: TEST_PASSWORD });
  assert.equal(login.status, 403);

  const reused = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(reused.status, 403);

  const selfDeactivate = await request(app)
    .patch(`/api/users/${sessions.admin.user.id}`)
    .set('Authorization', `Bearer ${sessions.admin.accessToken}`)
    .send({ isActive: false });
  assert.equal(selfDeactivate.status, 400);
});
