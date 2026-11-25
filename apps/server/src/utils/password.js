import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

export function hashPassword(plain) {
  return bcrypt.hash(plain, config.auth.bcryptRounds);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function passwordPolicyError(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain a letter';
  if (!/\d/.test(password)) return 'Password must contain a number';
  return null;
}
