import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { closeDatabase, getApp } from './helpers/testDb.js';
import { pool } from '../src/database/db.js';

const app = await getApp();
// Simulate a brand-new installation: the license is active but no staff account exists yet.
await pool.query('DELETE FROM users');

test.after(async () => {
  await closeDatabase();
});

test('setup status reports a fresh installation awaiting its first administrator', async () => {
  const res = await request(app).get('/api/setup/status');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.licenseActive, true);
  assert.equal(res.body.data.setupRequired, true);
  assert.equal(res.body.data.clinicName, 'Test Dental Clinic');
});

test('setup rejects weak passwords and invalid usernames', async () => {
  const weak = await request(app).post('/api/setup').send({ fullName: 'Clinic Owner', username: 'owner', password: 'short' });
  assert.equal(weak.status, 422);

  const badName = await request(app).post('/api/setup').send({ fullName: 'Clinic Owner', username: 'bad user!', password: 'Setup@12345' });
  assert.equal(badName.status, 422);

  const { rows } = await pool.query('SELECT count(*)::int AS count FROM users');
  assert.equal(rows[0].count, 0);
});

test('first administrator is created and can sign in with full access', async () => {
  const created = await request(app)
    .post('/api/setup')
    .send({ fullName: 'Dr. Priya Raman', username: 'dr.priya', password: 'Setup@12345' });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.username, 'dr.priya');

  const { rows } = await pool.query(
    `SELECT u.username, r.code AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.username = 'dr.priya'`
  );
  assert.equal(rows[0].role, 'admin');

  const audit = await pool.query(`SELECT action FROM audit_logs WHERE action = 'setup.administrator_created'`);
  assert.equal(audit.rowCount, 1);

  const login = await request(app).post('/api/auth/login').send({ username: 'dr.priya', password: 'Setup@12345' });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.role, 'admin');

  const staff = await request(app).get('/api/users').set('Authorization', `Bearer ${login.body.data.accessToken}`);
  assert.equal(staff.status, 200);
  assert.ok(staff.body.data.some((u) => u.username === 'dr.priya'));
});

test('setup is closed after the first administrator exists', async () => {
  const status = await request(app).get('/api/setup/status');
  assert.equal(status.body.data.setupRequired, false);

  const second = await request(app)
    .post('/api/setup')
    .send({ fullName: 'Second Owner', username: 'second.owner', password: 'Setup@12345' });
  assert.equal(second.status, 409);
});
