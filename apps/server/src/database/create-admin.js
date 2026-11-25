import readline from 'node:readline';
import { pool } from './db.js';
import { runMigrations } from './migrate.js';
import { runSeed } from './seed.js';
import { hashPassword, passwordPolicyError } from '../utils/password.js';

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (text) => {
      if (String(text).includes(question)) write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function readPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!process.stdin.isTTY) return null;
  const first = await promptHidden('Password: ');
  const second = await promptHidden('Confirm password: ');
  if (first !== second) throw new Error('Passwords do not match');
  return first;
}

async function findAdmin() {
  const { rows } = await pool.query(
    `SELECT u.id, u.username FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'admin' ORDER BY u.created_at LIMIT 1`
  );
  return rows[0] || null;
}

async function main() {
  const reset = process.argv.includes('--reset-password');
  const username = argValue('username', process.env.ADMIN_USERNAME || null);
  const fullName = argValue('full-name', process.env.ADMIN_FULL_NAME || 'Clinic Administrator');

  await runMigrations({ silent: false });

  const password = await readPassword();
  if (password !== null) {
    const policy = passwordPolicyError(password);
    if (policy) throw new Error(policy);
    process.env.ADMIN_PASSWORD = password;
  }
  if (username) process.env.ADMIN_USERNAME = username;

  const existing = await findAdmin();

  if (existing && !reset) {
    console.log(`[create-admin] administrator "${existing.username}" already exists.`);
    console.log('[create-admin] run with --reset-password to set a new password.');
    return;
  }

  if (existing && reset) {
    if (!password) throw new Error('A new password is required for --reset-password (set ADMIN_PASSWORD or run interactively)');
    const hash = await hashPassword(password);
    await pool.query(
      `UPDATE users SET password_hash = $2, must_change_password = false, failed_login_attempts = 0,
         locked_until = NULL, updated_at = now() WHERE id = $1`,
      [existing.id, hash]
    );
    await pool.query('DELETE FROM refresh_sessions WHERE user_id = $1', [existing.id]);
    console.log(`[create-admin] password reset for "${existing.username}". All sessions revoked.`);
    return;
  }

  const created = await runSeed({ demo: false });
  if (created) {
    console.log(`[create-admin] administrator "${created.username}" created.`);
    if (created.generated) {
      console.log(`[create-admin] generated password: ${created.password}`);
      console.log('[create-admin] change this password on first sign-in.');
    }
  } else {
    const current = await findAdmin();
    console.log(`[create-admin] administrator "${current?.username || 'admin'}" already exists.`);
  }
}

main()
  .catch((err) => {
    console.error(`[create-admin] ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
