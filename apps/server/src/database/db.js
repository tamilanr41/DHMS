import pg from 'pg';
import { config } from '../config/env.js';

// Return NUMERIC as string (money is exact) and DATE as string to avoid TZ drift.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => v);
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIME, (v) => v);

const databaseUrl = process.env.DATABASE_URL || config.db?.url;
const isRemoteUrl = Boolean(
  databaseUrl &&
  !databaseUrl.includes('127.0.0.1') &&
  !databaseUrl.includes('localhost')
);

export const pool = databaseUrl
  ? new pg.Pool({
      connectionString: databaseUrl,
      ssl: isRemoteUrl && !databaseUrl.includes('sslmode=disable') ? { rejectUnauthorized: false } : false,
      max: config.db.max || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      application_name: 'zhanx_dentalcare'
    })
  : new pg.Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      max: config.db.max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      application_name: 'zhanx_dentalcare'
    });

pool.on('error', (err) => {
  console.error('[db] idle client error', err.message);
});

export function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(fn, { isolation = 'read committed' } = {}) {
  const client = await pool.connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolation === 'serializable' ? 'SERIALIZABLE' : 'READ COMMITTED'}`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already broken */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function healthCheck() {
  const { rows } = await query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

export async function closePool() {
  await pool.end();
}
