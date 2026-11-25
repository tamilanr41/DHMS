import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { closeDatabase, createPatient, getApp, loginAs } from './helpers/testDb.js';

const app = await getApp();

test.after(async () => {
  await closeDatabase();
});

const auth = (session) => ({ Authorization: `Bearer ${session.accessToken}` });
const DAY = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

let dentist;
let receptionist;
let assistant;
let dentistId;
let patient;
let appointment;

test.before(async () => {
  dentist = await loginAs('dr.test');
  receptionist = await loginAs('reception.test');
  assistant = await loginAs('assistant.test');
  patient = await createPatient(app, receptionist.accessToken, { fullName: 'Clinical Patient', mobile: '9845222002' });

  const dentists = await request(app).get('/api/users/dentists').set(auth(receptionist));
  assert.equal(dentists.status, 200);
  dentistId = dentists.body.data.find((d) => d.username === 'dr.test').id;
});

test('books appointments and refuses overlapping slots for the same dentist', async () => {
  const first = await request(app)
    .post('/api/appointments')
    .set(auth(receptionist))
    .send({
      patientId: patient.id,
      dentistId,
      appointmentDate: DAY,
      startTime: '10:00',
      endTime: '10:30',
      reason: 'Tooth pain'
    });
  assert.equal(first.status, 201);
  assert.match(first.body.data.appointmentNo, /^APT-\d{6}$/);
  assert.equal(first.body.data.status, 'scheduled');
  appointment = first.body.data;

  const overlap = await request(app)
    .post('/api/appointments')
    .set(auth(receptionist))
    .send({ patientId: patient.id, dentistId, appointmentDate: DAY, startTime: '10:15', endTime: '10:45' });
  assert.equal(overlap.status, 409);
  assert.equal(overlap.body.error.code, 'APPOINTMENT_CONFLICT');

  const adjacent = await request(app)
    .post('/api/appointments')
    .set(auth(receptionist))
    .send({ patientId: patient.id, dentistId, appointmentDate: DAY, startTime: '10:30', endTime: '11:00' });
  assert.equal(adjacent.status, 201);

  const forced = await request(app)
    .post('/api/appointments')
    .set(auth(receptionist))
    .send({ patientId: patient.id, dentistId, appointmentDate: DAY, startTime: '10:15', endTime: '10:45', force: true });
  assert.equal(forced.status, 409, 'the force flag must not bypass overlap prevention');

  const badRange = await request(app)
    .post('/api/appointments')
    .set(auth(receptionist))
    .send({ patientId: patient.id, dentistId, appointmentDate: DAY, startTime: '12:00', endTime: '11:00' });
  assert.equal(badRange.status, 422);

  const assistantBooking = await request(app)
    .post('/api/appointments')
    .set(auth(assistant))
    .send({ patientId: patient.id, dentistId, appointmentDate: DAY, startTime: '15:00', endTime: '15:30' });
  assert.equal(assistantBooking.status, 403);
});

test('records status transitions and keeps a status history', async () => {
  const invalid = await request(app)
    .post(`/api/appointments/${appointment.id}/status`)
    .set(auth(receptionist))
    .send({ status: 'completed' });
  assert.equal(invalid.status, 400);

  for (const status of ['confirmed', 'checked_in', 'waiting']) {
    const res = await request(app)
      .post(`/api/appointments/${appointment.id}/status`)
      .set(auth(receptionist))
      .send({ status });
    assert.equal(res.status, 200, `transition to ${status}`);
    assert.equal(res.body.data.status, status);
  }

  const queue = await request(app).get(`/api/appointments/queue?date=${DAY}`).set(auth(assistant));
  assert.equal(queue.status, 200);
  assert.ok(queue.body.data.some((a) => a.id === appointment.id));

  const detail = await request(app).get(`/api/appointments/${appointment.id}`).set(auth(receptionist));
  assert.equal(detail.status, 200);
  const statuses = detail.body.data.history.map((h) => h.to_status);
  assert.equal(statuses.length, 4);
  assert.equal(statuses[0], 'scheduled');
  assert.equal(statuses[statuses.length - 1], 'waiting');
  for (const expected of ['confirmed', 'checked_in', 'waiting']) {
    assert.ok(statuses.includes(expected), `history should include ${expected}`);
  }
  assert.equal(detail.body.data.history.find((h) => h.to_status === 'confirmed').from_status, 'scheduled');
});

test('finalizes consultations only with a diagnosis and records amendments', async () => {
  const created = await request(app)
    .post('/api/consultations')
    .set(auth(dentist))
    .send({
      patientId: patient.id,
      appointmentId: appointment.id,
      chiefComplaint: 'Pain on biting',
      examinationFindings: 'Deep caries on 36'
    });
  assert.equal(created.status, 201);
  const consultation = created.body.data;
  assert.match(consultation.consultationNo, /^CONS-\d{6}$/);

  const apptAfter = await request(app).get(`/api/appointments/${appointment.id}`).set(auth(dentist));
  assert.equal(apptAfter.body.data.status, 'in_consultation');

  const early = await request(app).post(`/api/consultations/${consultation.id}/complete`).set(auth(dentist));
  assert.equal(early.status, 422);

  const patched = await request(app)
    .patch(`/api/consultations/${consultation.id}`)
    .set(auth(dentist))
    .send({ diagnosis: 'Irreversible pulpitis 36', recommendations: 'RCT followed by crown' });
  assert.equal(patched.status, 200);

  const completed = await request(app).post(`/api/consultations/${consultation.id}/complete`).set(auth(dentist));
  assert.equal(completed.status, 200);
  assert.equal(completed.body.data.status, 'completed');

  const apptDone = await request(app).get(`/api/appointments/${appointment.id}`).set(auth(dentist));
  assert.equal(apptDone.body.data.status, 'completed');

  const noAmend = await request(app)
    .post(`/api/consultations/${consultation.id}/amend`)
    .set(auth(assistant))
    .send({ content: 'Assistant should not amend' });
  assert.equal(noAmend.status, 403);

  const amended = await request(app)
    .post(`/api/consultations/${consultation.id}/amend`)
    .set(auth(dentist))
    .send({ content: 'Radiograph confirms pulp involvement', diagnosis: 'Irreversible pulpitis 36 (confirmed)' });
  assert.equal(amended.status, 201);

  const detail = await request(app).get(`/api/consultations/${consultation.id}`).set(auth(dentist));
  assert.equal(detail.body.data.status, 'amended');
  assert.equal(detail.body.data.diagnosis, 'Irreversible pulpitis 36 (confirmed)');
  assert.equal(detail.body.data.notes.length, 1);
  assert.equal(detail.body.data.notes[0].noteType, 'amendment');
});

test('supersedes dental chart findings instead of overwriting history', async () => {
  const first = await request(app)
    .post(`/api/dental-chart/patients/${patient.id}`)
    .set(auth(dentist))
    .send({ toothNumber: '36', dentition: 'permanent', conditionCode: 'caries', surface: 'occlusal', notes: 'Deep caries' });
  assert.equal(first.status, 201);
  assert.equal(first.body.data.isCurrent, true);

  const second = await request(app)
    .post(`/api/dental-chart/patients/${patient.id}`)
    .set(auth(dentist))
    .send({ toothNumber: '36', dentition: 'permanent', conditionCode: 'restored', notes: 'Composite after RCT' });
  assert.equal(second.status, 201);

  const chart = await request(app).get(`/api/dental-chart/patients/${patient.id}`).set(auth(dentist));
  assert.equal(chart.status, 200);
  const current = chart.body.data.permanent.find((r) => r.toothNumber === '36');
  assert.equal(current.conditionCode, 'restored');
  assert.equal(current.historyCount, 2);

  const history = await request(app)
    .get(`/api/dental-chart/patients/${patient.id}/teeth/36/history`)
    .set(auth(assistant));
  assert.equal(history.status, 200);
  assert.equal(history.body.data.length, 2);
  const superseded = history.body.data.find((r) => r.conditionCode === 'caries');
  assert.equal(superseded.isCurrent, false);
  assert.ok(superseded.supersededAt);

  const invalidTooth = await request(app)
    .post(`/api/dental-chart/patients/${patient.id}`)
    .set(auth(dentist))
    .send({ toothNumber: '99', dentition: 'permanent', conditionCode: 'caries' });
  assert.equal(invalidTooth.status, 422);

  const notApplicable = await request(app)
    .post(`/api/dental-chart/patients/${patient.id}`)
    .set(auth(dentist))
    .send({ toothNumber: '75', dentition: 'primary', conditionCode: 'rct' });
  assert.equal(notApplicable.status, 400);

  const primary = await request(app)
    .post(`/api/dental-chart/patients/${patient.id}`)
    .set(auth(dentist))
    .send({ toothNumber: '75', dentition: 'primary', conditionCode: 'caries' });
  assert.equal(primary.status, 201);

  const assistantWrite = await request(app)
    .post(`/api/dental-chart/patients/${patient.id}`)
    .set(auth(assistant))
    .send({ toothNumber: '37', dentition: 'permanent', conditionCode: 'caries' });
  assert.equal(assistantWrite.status, 403);
});
