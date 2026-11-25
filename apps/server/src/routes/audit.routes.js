import { Router } from 'express';
import { query } from '../database/db.js';
import { asyncHandler } from '../utils/errors.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { parsePagination, paginatedMeta } from '../utils/validate.js';

const router = Router();
router.use(authenticate, requirePermission('audit.view'));

router.get('/', asyncHandler(async (req, res) => {
  const { page, pageSize, offset, limit } = parsePagination(req.query, { defaultSize: 50, maxSize: 200 });
  const where = ['1=1'];
  const params = [];

  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(a.action ILIKE $${params.length} OR a.username ILIKE $${params.length} OR a.entity_type ILIKE $${params.length})`);
  }
  if (req.query.action) {
    params.push(req.query.action);
    where.push(`a.action = $${params.length}`);
  }
  if (req.query.entityType) {
    params.push(req.query.entityType);
    where.push(`a.entity_type = $${params.length}`);
  }
  if (req.query.userId) {
    params.push(req.query.userId);
    where.push(`a.user_id = $${params.length}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.startDate || '')) {
    params.push(req.query.startDate);
    where.push(`a.created_at >= $${params.length}::date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate || '')) {
    params.push(req.query.endDate);
    where.push(`a.created_at < ($${params.length}::date + interval '1 day')`);
  }

  const countQ = await query(`SELECT count(*) AS total FROM audit_logs a WHERE ${where.join(' AND ')}`, params);
  params.push(limit, offset);
  const { rows } = await query(
    `SELECT a.* FROM audit_logs a WHERE ${where.join(' AND ')}
     ORDER BY a.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    data: rows.map((r) => ({
      id: r.id,
      username: r.username,
      userId: r.user_id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.details,
      ip: r.ip,
      createdAt: r.created_at
    })),
    meta: paginatedMeta(countQ.rows[0].total, page, pageSize)
  });
}));

router.get('/actions', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  res.json({ data: rows.map((r) => r.action) });
}));

export default router;
