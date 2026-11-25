import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { closeDatabase, createPatient, getApp, loginAs } from './helpers/testDb.js';
import { createBackup, verifyBackup } from '../src/services/backup.service.js';

const app = await getApp();

test.after(async () => {
  await closeDatabase();
});

const auth = (session) => ({ Authorization: `Bearer ${session.accessToken}` });
const DAY = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

let admin;
let receptionist;
let dentistId;
let patient;
let appointment;

test.before(async () => {
  admin = await loginAs('admin', 'Admin@Test123');
  receptionist = await loginAs('reception.test');
  patient = await createPatient(app, receptionist.accessToken, {
    fullName: 'Reminder Test Patient',
    mobile: '9845333003'
  });

  const dentists = await request(app).get('/api/users/dentists').set(auth(receptionist));
  dentistId = dentists.body.data[0].id;

  const apptRes = await request(app)
    .post('/api/appointments')
    .set(auth(receptionist))
    .send({
      patientId: patient.id,
      dentistId,
      appointmentDate: DAY,
      startTime: '16:00',
      endTime: '16:30',
      reason: 'Routine dental check'
    });
  assert.equal(apptRes.status, 201);
  appointment = apptRes.body.data;
});

test('appointment reminder sends with opened status and records communication log', async () => {
  const res = await request(app)
    .post('/api/reminders/send')
    .set(auth(receptionist))
    .send({
      appointmentId: appointment.id,
      channel: 'whatsapp',
      messageBody: 'Your dental appointment is scheduled for next week.',
      status: 'opened'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.reminder.status, 'opened');
  assert.ok(res.body.data.communicationId, 'Communication entry should be created');

  const commRes = await request(app)
    .get(`/api/patients/${patient.id}/communications`)
    .set(auth(receptionist));
  assert.equal(commRes.status, 200);
  const found = commRes.body.data.find((c) => c.id === res.body.data.communicationId);
  assert.ok(found);
  assert.equal(found.purpose, 'reminder');
  assert.equal(found.outcome, 'message_opened');
});

test('recall outreach log records in patient communications', async () => {
  const logRes = await request(app)
    .post('/api/recalls/log')
    .set(auth(receptionist))
    .send({
      patientId: patient.id,
      channel: 'whatsapp',
      notes: 'WhatsApp routine recall outreach initiated'
    });

  assert.equal(logRes.status, 201);
  assert.equal(logRes.body.data.purpose, 'recall');
  assert.equal(logRes.body.data.outcome, 'message_opened');
});

test('unified full clinic backup creates tar package and verifies DB and files', async () => {
  const backup = await createBackup({ type: 'manual', userId: admin.user?.id || null });
  assert.ok(backup.id);
  assert.ok(backup.fileName.endsWith('.tar.gz'));
  assert.ok(backup.sizeBytes > 1024);

  const verification = await verifyBackup(backup.id);
  assert.equal(verification.ok, true);
  assert.equal(verification.isFullSet, true);
  assert.ok(verification.entries > 0);
});
