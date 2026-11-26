import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { ApiError } from '../utils/errors.js';
import { loadUserWithPermissions } from '../services/auth.service.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

    let payload;
    try {
      payload = jwt.verify(token, config.auth.jwtSecret, {
        issuer: 'zhanx-dentalcare',
        audience: 'zhanx-desktop'
      });
    } catch {
      throw ApiError.unauthorized('Session expired, please sign in again');
    }

    const profile = await loadUserWithPermissions(payload.sub);
    if (!profile) throw ApiError.unauthorized('User no longer exists');
    if (!profile.is_active) throw ApiError.forbidden('This account is deactivated');

    req.user = {
      id: profile.id,
      username: profile.username,
      fullName: profile.full_name,
      role: profile.role_code,
      clinicId: profile.clinic_id || payload.clinicId || null,
      permissions: profile.permissions,
      mustChangePassword: profile.must_change_password
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(...codes) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'admin') return next();
    const has = codes.every((c) => req.user.permissions?.includes(c));
    if (!has) return next(ApiError.forbidden());
    next();
  };
}

export function requireAnyPermission(...codes) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'admin') return next();
    const has = codes.some((c) => req.user.permissions?.includes(c));
    if (!has) return next(ApiError.forbidden());
    next();
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}
