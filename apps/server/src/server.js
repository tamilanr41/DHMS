import cron from 'node-cron';
import { createApp, logger } from './app.js';
import { config } from './config/env.js';
import { pool, closePool } from './database/db.js';
import { runMigrations } from './database/migrate.js';
import { ensureDataDirs } from './middleware/upload.js';
import { createBackup, reconcileInterruptedBackups } from './services/backup.service.js';
import { purgeExpiredSessions } from './services/auth.service.js';

async function main() {
  ensureDataDirs();
  await runMigrations();
  try {
    const interrupted = await reconcileInterruptedBackups();
    if (interrupted) logger.warn({ count: interrupted }, 'marked interrupted backups as failed');
  } catch (err) {
    logger.warn({ err }, 'backup reconciliation failed');
  }

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    logger.info(`ZhanX DentalCare API listening on http://${config.host}:${config.port}`);
  });

  if (cron.validate(config.backupSchedule)) {
    cron.schedule(config.backupSchedule, async () => {
      try {
        const result = await createBackup({ type: 'scheduled' });
        logger.info({ file: result.fileName }, 'scheduled backup completed');
      } catch (err) {
        logger.error({ err }, 'scheduled backup failed');
      }
    });
    logger.info(`Backup schedule active: ${config.backupSchedule}`);
  }

  const purgeTimer = setInterval(() => {
    purgeExpiredSessions().catch((err) => logger.warn({ err }, 'session purge failed'));
  }, 6 * 60 * 60 * 1000);
  purgeTimer.unref();

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception');
    pool.end().finally(() => process.exit(1));
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
