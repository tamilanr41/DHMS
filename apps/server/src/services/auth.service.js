import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { query, withTransaction } from '../database/db.js';
import { verifyPassword, hashPassword, passwordPolicyError } from '../utils/password.js';
import { ApiError } from '../utils/errors.js';
import { logAudit, clientIp } from './audit.service.js';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role_code, name: user.full_name },
    config.auth.jwtSecret,
    { expiresIn: `${config.auth.accessTtlMin}m`, issuer: 'zhanx-dentalcare', audience: 'zhanx-desktop' }
  );
}

async function createRefreshSession(client, user, req) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + config.auth.refreshTtlDays * 24 * 60 * 60 * 1000);
  await client.query(
    `INSERT INTO refresh_sessions (user_id, token_hash, ip, user_agent, expires_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [user.id, hashToken(token), req ? clientIp(req) : null, req?.headers?.['user-agent']?.slice(0, 300) || null, expiresAt]
  );
  return { token, expiresAt };
}

export async function loadUserWithPermissions(userId) {
  const { rows } = await query(
    `SELECT u.id, u.username, u.full_name, u.is_active, u.must_change_password,
            r.code AS role_code, r.name AS role_name,
            COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     LEFT JOIN permissions p ON p.id = rp.permission_id
     WHERE u.id = $1
     GROUP BY u.id, r.code, r.name`,
    [userId]
  );
  return rows[0] || null;
}

export async function login({ username, password }, req) {
  const { rows } = await query(
    `SELECT u.id, u.username, u.password_hash, u.full_name, u.is_active, u.must_change_password,
            u.failed_login_attempts, u.locked_until, r.code AS role_code
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE lower(u.username) = lower($1)`,
    [String(username).trim()]
  );
  const user = rows[0];

  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw new ApiError(423, `Account locked. Try again in ${mins} minute(s).`, { code: 'ACCOUNT_LOCKED' });
  }

  const ok = user ? await verifyPassword(password, user.password_hash) : false;

  if (!user || !ok) {
    if (user) {
      const attempts = user.failed_login_attempts + 1;
      const lock = attempts >= config.auth.loginMaxAttempts;
      await query(
        `UPDATE users SET failed_login_attempts = $2,
           locked_until = CASE WHEN $3 THEN now() + ($4 || ' minutes')::interval ELSE locked_until END
         WHERE id = $1`,
        [user.id, lock ? 0 : attempts, lock, String(config.auth.lockMinutes)]
      );
      await logAudit(null, req, {
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user.id,
        details: { username: user.username, locked: lock }
      });
      if (lock) {
        throw new ApiError(423, 'Too many failed attempts. Account locked temporarily.', { code: 'ACCOUNT_LOCKED' });
      }
    }
    throw ApiError.unauthorized('Invalid username or password');
  }

  if (!user.is_active) throw ApiError.forbidden('This account is deactivated');

  const session = await withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`,
      [user.id]
    );
    return createRefreshSession(client, user, req);
  });

  const profile = await loadUserWithPermissions(user.id);
  // Express exposes headers/ip/socket via prototype accessors, so spreading the request
  // drops them; pass an explicit shape for the audit entry.
  const auditReq = req
    ? {
        user: { id: user.id, username: user.username },
        headers: { ...req.headers },
        ip: req.ip,
        socket: { remoteAddress: req.socket?.remoteAddress }
      }
    : null;
  await logAudit(null, auditReq, {
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken: session.token,
    refreshExpiresAt: session.expiresAt,
    user: toClientUser(profile)
  };
}

export async function refreshSession(refreshToken, req) {
  if (!refreshToken) throw ApiError.unauthorized('Refresh token missing');
  const { rows } = await query(
    `SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.is_active, u.username
     FROM refresh_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1`,
    [hashToken(refreshToken)]
  );
  const session = rows[0];
  if (!session || session.revoked_at || new Date(session.expires_at) <= new Date()) {
    throw ApiError.unauthorized('Session expired, please sign in again');
  }
  if (!session.is_active) throw ApiError.forbidden('This account is deactivated');

  const profile = await loadUserWithPermissions(session.user_id);

  const rotated = await withTransaction(async (client) => {
    await client.query('UPDATE refresh_sessions SET revoked_at = now(), last_used_at = now() WHERE id = $1', [session.id]);
    return createRefreshSession(client, { id: session.user_id }, req);
  });

  return {
    accessToken: signAccessToken({ id: profile.id, role_code: profile.role_code, full_name: profile.full_name }),
    refreshToken: rotated.token,
    refreshExpiresAt: rotated.expiresAt,
    user: toClientUser(profile)
  };
}

export async function logout(refreshToken, req) {
  if (refreshToken) {
    await query('UPDATE refresh_sessions SET revoked_at = now() WHERE token_hash = $1', [hashToken(refreshToken)]);
  }
  await logAudit(null, req, { action: 'auth.logout', entityType: 'user', entityId: req.user?.id });
}

export async function changePassword(userId, { currentPassword, newPassword }, req) {
  const policy = passwordPolicyError(newPassword);
  if (policy) throw ApiError.unprocessable(policy);

  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw ApiError.notFound('User not found');
  if (!(await verifyPassword(currentPassword, rows[0].password_hash))) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  const newHash = await hashPassword(newPassword);
  await withTransaction(async (client) => {
    await client.query(
      'UPDATE users SET password_hash = $2, must_change_password = false WHERE id = $1',
      [userId, newHash]
    );
    await client.query('UPDATE refresh_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
  });
  await logAudit(null, req, { action: 'auth.password_changed', entityType: 'user', entityId: userId });
}

export function toClientUser(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.full_name,
    role: profile.role_code,
    roleName: profile.role_name,
    permissions: profile.permissions,
    mustChangePassword: profile.must_change_password
  };
}

export async function purgeExpiredSessions() {
  await query(`DELETE FROM refresh_sessions WHERE expires_at < now() - interval '30 days'`);
}
