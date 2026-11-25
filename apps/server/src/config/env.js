import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '../..');

// Repository layout: <repo>/apps/server → install root is two levels up.
// Packaged layout: <install>/server → install root is one level up. Using the repo
// formula blindly would move .env and data/ to the parent of the install folder.
export function resolveRepoRoot(serverRoot) {
  const serverParent = path.dirname(serverRoot);
  return path.basename(serverParent).toLowerCase() === 'apps' ? path.dirname(serverParent) : serverParent;
}

export const REPO_ROOT = resolveRepoRoot(SERVER_ROOT);

dotenv.config({ path: path.join(REPO_ROOT, '.env') });
dotenv.config({ path: path.join(SERVER_ROOT, '.env'), override: true });

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const isProd = process.env.NODE_ENV === 'production';
const dataDir = path.resolve(REPO_ROOT, process.env.DATA_DIR || 'data');

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production');
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd,
  port: num(process.env.PORT, 4000),
  host: process.env.HOST || '0.0.0.0',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: num(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME || 'zhanx_dentalcare',
    user: process.env.DB_USER || 'zhanx_app',
    password: process.env.DB_PASSWORD || '',
    max: num(process.env.DB_POOL_MAX, 10)
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'insecure-development-secret-do-not-use-in-production',
    accessTtlMin: num(process.env.ACCESS_TOKEN_TTL_MIN, 15),
    refreshTtlDays: num(process.env.REFRESH_TOKEN_TTL_DAYS, 7),
    bcryptRounds: num(process.env.BCRYPT_ROUNDS, 12),
    loginMaxAttempts: num(process.env.LOGIN_MAX_ATTEMPTS, 5),
    lockMinutes: num(process.env.LOGIN_LOCK_MINUTES, 15)
  },
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  dataDir,
  licensing: {
    // Only the public verification key ships with the application. The private signing
    // key lives exclusively with the publisher's license generator (tools/license-generator).
    publicKey:
      process.env.ZHANX_LICENSE_PUBLIC_KEY ||
      'MCowBQYDK2VwAyEAt1cjGeETFfLaZSjKofXxWh7UDEaarKc5hTT4YJQzgBI=',
    dir: path.join(dataDir, 'license'),
    supportEmail: process.env.ZHANX_SUPPORT_EMAIL || 'support@zhanxstudio.com',
    supportPhone: process.env.ZHANX_SUPPORT_PHONE || ''
  },
  uploadMaxMb: num(process.env.UPLOAD_MAX_MB, 10),
  backupSchedule: process.env.BACKUP_SCHEDULE || '0 21 * * *',
  backupRetentionDays: num(process.env.BACKUP_RETENTION_DAYS, 30),
  pgDumpBinary: process.env.PG_DUMP_BIN || 'pg_dump',
  pgRestoreBinary: process.env.PG_RESTORE_BIN || 'pg_restore'
};
