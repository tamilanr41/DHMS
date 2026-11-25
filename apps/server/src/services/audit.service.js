import { pool } from '../database/db.js';

export function clientIp(req) {
  const fwd = req?.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req?.ip || req?.socket?.remoteAddress || null;
}

export async function logAudit(executor, req, { action, entityType, entityId, details }) {
  const db = executor?.query ? executor : pool;
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        req?.user?.id || null,
        req?.user?.username || null,
        action,
        entityType || null,
        entityId != null ? String(entityId) : null,
        details ? JSON.stringify(details) : null,
        req ? clientIp(req) : null
      ]
    );
  } catch (err) {
    // auditing must never break the request path, but must be visible in logs
    console.error('[audit] failed to write entry', err.message);
  }
}
