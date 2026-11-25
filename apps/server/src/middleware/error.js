import { ApiError } from '../utils/errors.js';

export function notFound(req, res) {
  res.status(404).json({ error: { message: `No route for ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.expose || status < 500 ? err.message : 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.details;

  if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request payload too large';
    code = 'PAYLOAD_TOO_LARGE';
  }

  switch (err.code) {
    case '23505':
      status = 409;
      message = friendlyUnique(err);
      code = 'DUPLICATE';
      break;
    case '23P01':
      status = 409;
      message = 'This time slot overlaps another active appointment for the dentist';
      code = 'APPOINTMENT_OVERLAP';
      break;
    case '23503':
      status = 400;
      message = 'Related record does not exist or is in use';
      code = 'FOREIGN_KEY';
      break;
    case '23514':
      status = 400;
      message = 'Data violates a database constraint';
      code = 'CHECK_VIOLATION';
      break;
    case '22P02':
    case '22007':
    case '22008':
      status = 400;
      message = 'Malformed identifier or date value';
      code = 'INVALID_INPUT';
      break;
  }

  if (status >= 500) {
    req.log?.error({ err }, 'request failed');
    console.error('[error]', err.stack || err.message);
    message = 'Internal server error';
    code = 'INTERNAL_ERROR';
    details = undefined;
  }

  res.status(status).json({ error: { message, code, details } });
}

function friendlyUnique(err) {
  const constraint = err.constraint || '';
  if (constraint.includes('username')) return 'That username is already taken';
  if (constraint.includes('patient_no')) return 'Patient number already exists';
  if (constraint.includes('invoice_no')) return 'Invoice number already exists';
  if (constraint.includes('prescription_no')) return 'Prescription number already exists';
  if (constraint.includes('payment_no')) return 'Payment number already exists';
  if (constraint.includes('idempotency')) return 'This operation was already submitted';
  if (constraint.includes('mobile')) return 'A patient with this mobile number already exists';
  return 'This record already exists';
}

export function requireId(value, entity = 'Record') {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(value || '')) throw ApiError.badRequest(`${entity} id is not valid`);
  return value;
}
