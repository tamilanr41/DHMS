/**
 * Test bootstrap: every test file runs in its own process, so the dedicated
 * test database is recreated from the real migrations and reference seed.
 * Nothing here may touch the development or production database.
 */
import './env.js';
import pg from 'pg';
import request from 'supertest';
import { config } from '../../src/config/env.js';

if (!/^[a-z][a-z0-9_]*$/.test(config.db.database)) {
  throw new Error(`Refusing to use unsafe test database name: ${config.db.database}`);
}
if (!/test/i.test(config.db.database)) {
  throw new Error(`Test database name must contain "test" (got ${config.db.database})`);
}

export const TEST_PASSWORD = 'Test@12345';

let prepared = false;

async function recreateDatabase() {
  // The application role is deliberately unprivileged, so the test database is
  // created by a maintenance role and handed to the application role as owner.
  const adminUser = process.env.TEST_DB_ADMIN_USER || 'postgres';
  const admin = new pg.Client({
    host: config.db.host,
    port: config.db.port,
    user: adminUser,
    password: process.env.TEST_DB_ADMIN_PASSWORD || '',
    database: 'postgres'
  });
  await admin.connect();
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      await admin.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [config.db.database]
      );
      try {
        await admin.query(`DROP DATABASE IF EXISTS "${config.db.database}"`);
        break;
      } catch (err) {
        if (attempt === 4) throw err;
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    await admin.query(`CREATE DATABASE "${config.db.database}" OWNER "${config.db.user}"`);
  } finally {
    await admin.end();
  }
}

export async function prepareDatabase() {
  if (prepared) return;
  await recreateDatabase();

  const { runSeed } = await import('../../src/database/seed.js');
  const { pool } = await import('../../src/database/db.js');
  const { hashPassword } = await import('../../src/utils/password.js');

  await runSeed({ demo: false });

  const hash = await hashPassword(TEST_PASSWORD);
  const users = [
    ['dr.test', 'Dr. Test Dentist', 'dentist'],
    ['reception.test', 'Reception Test', 'receptionist'],
    ['assistant.test', 'Assistant Test', 'assistant']
  ];
  for (const [username, fullName, role] of users) {
    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role_id)
       VALUES ($1,$2,$3,(SELECT id FROM roles WHERE code = $4))`,
      [username, hash, fullName, role]
    );
  }

  // Every module fails closed without a valid license, so the shared test database is
  // activated with a disposable test-signed license before any API test runs.
  const { activateTestLicense } = await import('./licensing.js');
  await activateTestLicense();

  prepared = true;
}

export async function getApp() {
  await prepareDatabase();
  const { createApp } = await import('../../src/app.js');
  return createApp();
}

export async function getPool() {
  await prepareDatabase();
  const { pool } = await import('../../src/database/db.js');
  return pool;
}

export async function closeDatabase() {
  const { closePool } = await import('../../src/database/db.js');
  await closePool();
}

export async function loginAs(username, password = TEST_PASSWORD) {
  const app = await getApp();
  const res = await request(app).post('/api/auth/login').send({ username, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${username}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

export async function createPatient(app, token, overrides = {}) {
  const res = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${token}`)
    .send({
      fullName: 'Test Patient',
      mobile: '9845000001',
      gender: 'male',
      dob: '1990-01-01',
      ...overrides
    });
  if (res.status !== 201) throw new Error(`Patient creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}
