import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate, parsePagination, paginatedMeta } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { hashPassword, passwordPolicyError } from '../utils/password.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();
router.use(authenticate);

const userCreateSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Only letters, numbers, dot, dash and underscore'),
  password: z.string().min(8).max(200),
  fullName: z.string().trim().min(2).max(150),
  roleCode: z.enum(['admin', 'dentist', 'receptionist', 'assistant']),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email('Invalid email').max(150).optional().nullable().or(z.literal(''))
});

const userUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(150).optional(),
  roleCode: z.enum(['admin', 'dentist', 'receptionist', 'assistant']).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email('Invalid email').max(150).optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional()
});

router.get('/dentists', asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.username, u.phone, u.email, u.is_active, u.created_at, u.last_login_at
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE r.code = 'dentist' ${includeInactive ? '' : 'AND u.is_active'}
     ORDER BY u.is_active DESC, u.full_name`
  );
  res.json({
    data: rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      username: r.username,
      phone: r.phone,
      email: r.email,
      isActive: r.is_active,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at
    }))
  });
}));

router.get('/roles', requireAnyPermission('users.manage', 'settings.manage'), asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, code, name, description FROM roles ORDER BY code');
  res.json({ data: rows });
}));

router.get('/', requireAnyPermission('users.manage', 'settings.manage'), asyncHandler(async (req, res) => {
  const { page, pageSize, offset, limit } = parsePagination(req.query);
  const q = String(req.query.q || '').trim();
  const params = [];
  const where = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length})`);
  }
  if (req.query.roleCode) {
    params.push(req.query.roleCode);
    where.push(`r.code = $${params.length}`);
  }
  if (req.query.isActive === 'true' || req.query.isActive === 'false') {
    params.push(req.query.isActive === 'true');
    where.push(`u.is_active = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countQ = await query(`SELECT count(*) AS total FROM users u JOIN roles r ON r.id=u.role_id ${whereSql}`, params);
  params.push(limit, offset);
  const { rows } = await query(
    `SELECT u.id, u.username, u.full_name, u.phone, u.email, u.is_active, u.must_change_password,
            u.last_login_at, u.created_at, r.code AS role_code, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id
     ${whereSql}
     ORDER BY u.is_active DESC, u.full_name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({
    data: rows.map(mapUser),
    meta: paginatedMeta(countQ.rows[0].total, page, pageSize)
  });
}));

router.post('/', requireAnyPermission('users.manage', 'settings.manage'), asyncHandler(async (req, res) => {
  const body = validate(userCreateSchema, req.body);
  const policy = passwordPolicyError(body.password);
  if (policy) throw ApiError.unprocessable(policy, [{ path: 'password', message: policy }]);
  const hash = await hashPassword(body.password);

  const user = await withTransaction(async (client) => {
    const { rows: roleRows } = await client.query('SELECT id FROM roles WHERE code = $1', [body.roleCode]);
    if (!roleRows[0]) throw ApiError.badRequest('Unknown role');
    const { rows } = await client.query(
      `INSERT INTO users (username, password_hash, full_name, role_id, phone, email, must_change_password, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,$7)
       RETURNING id, username, full_name, phone, email, is_active, created_at`,
      [body.username.toLowerCase(), hash, body.fullName, roleRows[0].id, body.phone || null, body.email || null, req.user.id]
    );
    return rows[0];
  });

  await logAudit(null, req, { action: 'user.created', entityType: 'user', entityId: user.id, details: { username: user.username, role: body.roleCode } });
  res.status(201).json({ data: { ...user, roleCode: body.roleCode } });
}));

router.patch('/:id', requireAnyPermission('users.manage', 'settings.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'User');
  const body = validate(userUpdateSchema, req.body);
  if (id === req.user.id && body.isActive === false) throw ApiError.badRequest('You cannot deactivate your own account');

  const user = await withTransaction(async (client) => {
    let roleId;
    if (body.roleCode) {
      const { rows } = await client.query('SELECT id FROM roles WHERE code = $1', [body.roleCode]);
      if (!rows[0]) throw ApiError.badRequest('Unknown role');
      roleId = rows[0].id;
    }
    const { rows } = await client.query(
      `UPDATE users SET
         full_name = COALESCE($2, full_name),
         role_id = COALESCE($3, role_id),
         phone = COALESCE($4, phone),
         email = COALESCE($5, email),
         is_active = COALESCE($6, is_active),
         updated_by = $7
       WHERE id = $1
       RETURNING id, username, full_name, phone, email, is_active, role_id`,
      [id, body.fullName ?? null, roleId ?? null, body.phone ?? null, body.email ?? null, body.isActive ?? null, req.user.id]
    );
    if (!rows[0]) throw ApiError.notFound('User not found');
    if (body.isActive === false) {
      await client.query('UPDATE refresh_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
    }
    return rows[0];
  });

  await logAudit(null, req, { action: 'user.updated', entityType: 'user', entityId: id, details: body });
  res.json({ data: user });
}));

const resetSchema = z.object({ newPassword: z.string().min(8).max(200) });

router.post('/:id/reset-password', requireAnyPermission('users.manage', 'settings.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'User');
  const { newPassword } = validate(resetSchema, req.body);
  const policy = passwordPolicyError(newPassword);
  if (policy) throw ApiError.unprocessable(policy, [{ path: 'newPassword', message: policy }]);
  const hash = await hashPassword(newPassword);
  await withTransaction(async (client) => {
    const { rowCount } = await client.query('UPDATE users SET password_hash = $2, must_change_password = true, failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [id, hash]);
    if (!rowCount) throw ApiError.notFound('User not found');
    await client.query('UPDATE refresh_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
  });
  await logAudit(null, req, { action: 'user.password_reset', entityType: 'user', entityId: id });
  res.json({ data: { ok: true } });
}));

function mapUser(r) {
  return {
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    phone: r.phone,
    email: r.email,
    isActive: r.is_active,
    mustChangePassword: r.must_change_password,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at,
    role: r.role_code,
    roleName: r.role_name
  };
}

export default router;
