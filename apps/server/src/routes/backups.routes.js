import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../database/db.js';
import { asyncHandler } from '../utils/errors.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { validate } from '../utils/validate.js';
import { createBackup, verifyBackup, restoreBackup } from '../services/backup.service.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();
router.use(authenticate);
router.use(requirePermission('backups.manage'));

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT b.*, u.full_name AS created_by_name FROM backup_history b
     LEFT JOIN users u ON u.id = b.created_by
     ORDER BY b.started_at DESC LIMIT 100`
  );
  res.json({ data: rows.map((b) => ({
    id: b.id,
    fileName: b.file_name,
    filePath: b.file_path,
    sizeBytes: b.size_bytes,
    status: b.status,
    type: b.type,
    error: b.error,
    startedAt: b.started_at,
    finishedAt: b.finished_at,
    createdByName: b.created_by_name
  })) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const backup = await createBackup({ type: 'manual', userId: req.user.id });
  await logAudit(null, req, { action: 'backup.created', entityType: 'backup', entityId: backup.id, details: { fileName: backup.fileName } });
  res.status(201).json({ data: backup });
}));

router.post('/:id/verify', asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Backup');
  const result = await verifyBackup(id);
  await logAudit(null, req, { action: 'backup.verified', entityType: 'backup', entityId: id, details: result });
  res.json({ data: result });
}));

router.get('/:id/download', asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Backup');
  const { rows } = await query('SELECT * FROM backup_history WHERE id = $1', [id]);
  const backup = rows[0];
  if (!backup) return res.status(404).json({ error: { message: 'Backup not found' } });
  if (!fs.existsSync(backup.file_path)) return res.status(404).json({ error: { message: 'Backup file missing' } });
  await logAudit(null, req, { action: 'backup.downloaded', entityType: 'backup', entityId: id });
  res.download(path.resolve(backup.file_path), backup.file_name);
}));

router.post('/:id/restore', asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Backup');
  const { confirmation } = validate(z.object({ confirmation: z.string() }), req.body);
  await logAudit(null, req, { action: 'backup.restore_requested', entityType: 'backup', entityId: id });
  const result = await restoreBackup(id, { confirmation }, req);
  res.json({ data: result });
}));

export default router;
