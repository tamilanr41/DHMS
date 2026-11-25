import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { config } from '../config/env.js';
import { query } from '../database/db.js';
import { DATA_DIRS } from '../middleware/upload.js';
import { ApiError } from '../utils/errors.js';

function resolveBinary(configured, baseName) {
  if (configured && configured !== baseName && fs.existsSync(configured)) return configured;
  const candidates = [
    process.env.PG_BIN_DIR && path.join(process.env.PG_BIN_DIR, `${baseName}.exe`),
    `C:\\Program Files\\PostgreSQL\\18\\bin\\${baseName}.exe`,
    `C:\\Program Files\\PostgreSQL\\17\\bin\\${baseName}.exe`,
    `C:\\Program Files\\PostgreSQL\\16\\bin\\${baseName}.exe`,
    `C:\\Windows\\System32\\${baseName}.exe`
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return baseName;
}

function runProcess(command, args, { env = {}, timeoutMs = 10 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      windowsHide: true
    });
    let stderr = '';
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Backup command timed out'));
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Command failed (${code}): ${stderr || stdout}`));
    });
  });
}

function pgEnv() {
  return { PGPASSWORD: config.db.password };
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

export async function createBackup({ type = 'manual', userId = null } = {}) {
  fs.mkdirSync(DATA_DIRS.backups, { recursive: true });
  const { rows: prefsRows } = await query('SELECT backup_preferences FROM clinic_settings WHERE id = 1');
  const prefs = prefsRows[0]?.backup_preferences || {};
  let destination = DATA_DIRS.backups;
  if (prefs.directory && typeof prefs.directory === 'string') {
    try {
      fs.mkdirSync(prefs.directory, { recursive: true });
      destination = prefs.directory;
    } catch {
      destination = DATA_DIRS.backups;
    }
  }

  const stamp = timestamp();
  const fileName = `zhanx-${stamp}-full.tar.gz`;
  const filePath = path.join(destination, fileName);

  const { rows } = await query(
    `INSERT INTO backup_history (file_name, file_path, status, type, created_by)
     VALUES ($1,$2,'running',$3,$4) RETURNING id`,
    [fileName, filePath, type, userId]
  );
  const backupId = rows[0].id;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `zhanx-backup-${stamp}-`));
  try {
    const binary = resolveBinary(config.pgDumpBinary, 'pg_dump');
    const dumpPath = path.join(tempDir, 'database.dump');
    await runProcess(binary, [
      '-Fc',
      '-h', config.db.host,
      '-p', String(config.db.port),
      '-U', config.db.user,
      '-d', config.db.database,
      '-f', dumpPath
    ], { env: pgEnv() });

    const dumpStat = fs.statSync(dumpPath);
    if (dumpStat.size < 1024) throw new Error('Database dump file is unexpectedly small');

    // Archive files (documents, photos, branding, consents, uploads)
    let totalFiles = 0;
    const filesDir = path.join(tempDir, 'files');
    fs.mkdirSync(filesDir, { recursive: true });
    for (const [key, dir] of Object.entries(DATA_DIRS)) {
      if (key === 'backups' || key === 'root') continue;
      const targetSub = path.join(filesDir, key);
      totalFiles += copyDirRecursive(dir, targetSub);
    }

    const manifest = {
      appName: 'ZhanX DentalCare / HospitalOS',
      backupVersion: '2.0.0',
      type,
      database: config.db.database,
      dumpSize: dumpStat.size,
      totalFiles,
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    // Package entire set with tar
    const tar = resolveBinary(process.env.TAR_BIN, 'tar');
    await runProcess(tar, ['-czf', filePath, '-C', tempDir, '.']);

    const stat = fs.statSync(filePath);
    if (stat.size < 1024) throw new Error('Backup archive is unexpectedly small');

    await query(
      `UPDATE backup_history SET status = 'success', size_bytes = $2, finished_at = now() WHERE id = $1`,
      [backupId, stat.size]
    );
    await enforceRetention();
    return { id: backupId, fileName, filePath, sizeBytes: stat.size, filesIncluded: totalFiles };
  } catch (err) {
    await query(
      `UPDATE backup_history SET status = 'failed', error = $2, finished_at = now() WHERE id = $1`,
      [backupId, String(err.message).slice(0, 1000)]
    );
    throw new ApiError(500, `Backup failed: ${err.message}`);
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { }
  }
}

export async function reconcileInterruptedBackups() {
  const { rowCount } = await query(
    `UPDATE backup_history SET status = 'failed', error = 'Interrupted by a server restart',
       finished_at = now() WHERE status = 'running'`
  );
  return rowCount;
}

export async function verifyBackup(id) {
  const { rows } = await query('SELECT * FROM backup_history WHERE id = $1', [id]);
  const backup = rows[0];
  if (!backup) throw ApiError.notFound('Backup not found');
  if (!fs.existsSync(backup.file_path)) throw ApiError.notFound('Backup file is missing from disk');

  const isTar = backup.file_path.endsWith('.tar.gz') || backup.file_path.endsWith('.tgz');
  const binary = resolveBinary(config.pgRestoreBinary, 'pg_restore');

  if (isTar) {
    const tar = resolveBinary(process.env.TAR_BIN, 'tar');
    const { stdout: tarList } = await runProcess(tar, ['-tzf', backup.file_path]);
    const fileEntries = tarList.split(/\r?\n/).filter(Boolean);
    const hasDump = fileEntries.some((f) => f.includes('database.dump'));
    if (!hasDump) throw new ApiError(400, 'Backup package is missing database.dump');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `zhanx-verify-${Date.now()}-`));
    try {
      await runProcess(tar, ['-xzf', backup.file_path, '-C', tempDir, 'database.dump']);
      const extractedDump = path.join(tempDir, 'database.dump');
      const { stdout: restoreList } = await runProcess(binary, ['--list', extractedDump]);
      const entries = restoreList.split('\n').filter((l) => l && !l.startsWith(';')).length;
      return { ok: entries > 0, entries, filesCount: fileEntries.length - 2, isFullSet: true };
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { }
    }
  }

  // Legacy .dump direct file
  const { stdout } = await runProcess(binary, ['--list', backup.file_path]);
  const entries = stdout.split('\n').filter((l) => l && !l.startsWith(';')).length;
  return { ok: entries > 0, entries, isFullSet: false };
}

export async function restoreBackup(id, { confirmation }, req) {
  if (confirmation !== 'RESTORE') {
    throw ApiError.badRequest('Type RESTORE to confirm overwriting the live database');
  }
  const { rows } = await query('SELECT * FROM backup_history WHERE id = $1', [id]);
  const backup = rows[0];
  if (!backup) throw ApiError.notFound('Backup not found');
  if (backup.status !== 'success') throw ApiError.badRequest('Only successful backups can be restored');
  if (!fs.existsSync(backup.file_path)) throw ApiError.notFound('Backup file is missing from disk');

  const preRestore = await createBackup({ type: 'pre_restore', userId: req.user.id });

  const psql = resolveBinary(process.env.PG_PSQL_BIN, 'psql');
  try {
    await runProcess(psql, [
      '-h', config.db.host, '-p', String(config.db.port), '-U', config.db.user, '-d', 'postgres',
      '-c', `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${config.db.database}' AND pid <> pg_backend_pid()`
    ], { env: pgEnv() });
  } catch {
    // terminating idle sessions is best-effort
  }

  const binary = resolveBinary(config.pgRestoreBinary, 'pg_restore');
  const isTar = backup.file_path.endsWith('.tar.gz') || backup.file_path.endsWith('.tgz');
  const tempDir = isTar ? fs.mkdtempSync(path.join(os.tmpdir(), `zhanx-restore-data-${Date.now()}-`)) : null;

  const targetDumpPath = isTar ? path.join(tempDir, 'database.dump') : backup.file_path;

  if (isTar) {
    const tar = resolveBinary(process.env.TAR_BIN, 'tar');
    await runProcess(tar, ['-xzf', backup.file_path, '-C', tempDir]);
  }

  const tocFile = path.join(os.tmpdir(), `zhanx-restore-${Date.now()}-${process.pid}.list`);
  try {
    const { stdout } = await runProcess(binary, ['--list', targetDumpPath]);
    const filtered = stdout
      .split(/\r?\n/)
      .filter((line) => !/ EXTENSION - /.test(line) && !/ COMMENT - EXTENSION /.test(line))
      .join('\n');
    fs.writeFileSync(tocFile, filtered, 'utf8');

    await runProcess(binary, [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '--single-transaction',
      '-h', config.db.host,
      '-p', String(config.db.port),
      '-U', config.db.user,
      '-d', config.db.database,
      '--use-list', tocFile,
      targetDumpPath
    ], { env: pgEnv() });

    // Restore files if available in archive
    let filesRestored = 0;
    if (isTar && tempDir) {
      const filesDir = path.join(tempDir, 'files');
      if (fs.existsSync(filesDir)) {
        for (const [key, dir] of Object.entries(DATA_DIRS)) {
          if (key === 'backups' || key === 'root') continue;
          const sub = path.join(filesDir, key);
          if (fs.existsSync(sub)) {
            filesRestored += copyDirRecursive(sub, dir);
          }
        }
      }
    }

    return { restored: backup.file_name, preRestoreBackup: preRestore.fileName, filesRestored };
  } catch (err) {
    throw new ApiError(500, `Restore failed. Pre-restore backup was saved as ${preRestore.fileName}. ${err.message}`);
  } finally {
    fs.rmSync(tocFile, { force: true });
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { }
    }
  }
}

export async function enforceRetention() {
  const cutoff = new Date(Date.now() - config.backupRetentionDays * 24 * 60 * 60 * 1000);
  const { rows } = await query(
    `SELECT id, file_path FROM backup_history WHERE type <> 'pre_restore' AND status = 'success' AND started_at < $1`,
    [cutoff]
  );
  for (const row of rows) {
    if (fs.existsSync(row.file_path)) {
      try {
        fs.unlinkSync(row.file_path);
      } catch {
        continue;
      }
    }
    await query('DELETE FROM backup_history WHERE id = $1', [row.id]);
  }
  return rows.length;
}
