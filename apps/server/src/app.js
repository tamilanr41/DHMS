import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { config } from './config/env.js';
import { notFound, errorHandler } from './middleware/error.js';
import { healthCheck } from './database/db.js';

import authRoutes from './routes/auth.routes.js';
import licenseRoutes from './routes/license.routes.js';
import setupRoutes from './routes/setup.routes.js';
import tamilanRoutes from './routes/tamilan.routes.js';
import { requireLicense } from './licensing/license.service.js';
import usersRoutes from './routes/users.routes.js';
import clinicRoutes from './routes/clinic.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import patientsRoutes from './routes/patients.routes.js';
import appointmentsRoutes from './routes/appointments.routes.js';
import consultationsRoutes from './routes/consultations.routes.js';
import dentalChartRoutes from './routes/dentalChart.routes.js';
import treatmentsRoutes from './routes/treatments.routes.js';
import treatmentPlansRoutes from './routes/treatmentPlans.routes.js';
import prescriptionsRoutes from './routes/prescriptions.routes.js';
import invoicesRoutes from './routes/invoices.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import refundsRoutes from './routes/refunds.routes.js';
import patientCreditsRoutes from './routes/patientCredits.routes.js';
import claimsRoutes from './routes/claims.routes.js';
import remindersRoutes from './routes/reminders.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import labsRoutes from './routes/labs.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import recallsRoutes from './routes/recalls.routes.js';
import backupsRoutes from './routes/backups.routes.js';
import auditRoutes from './routes/audit.routes.js';

export const logger = pino({
  level: config.env === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'req.body.password', 'req.body.currentPassword', 'req.body.newPassword']
});

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true); // Electron / curl / mobile / same-origin requests
        if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        // Allow Netlify production & preview deploys, Render backends, or localhost
        if (
          origin.endsWith('.netlify.app') ||
          origin.endsWith('.onrender.com') ||
          origin.includes('localhost') ||
          origin.includes('127.0.0.1')
        ) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  if (config.env !== 'test') {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  }

  app.get(['/', '/healthz', '/api/health'], async (req, res) => {
    try {
      const ok = await healthCheck();
      res.status(ok ? 200 : 503).json({
        data: {
          status: ok ? 'ok' : 'degraded',
          database: ok,
          name: 'ZhanX DentalCare Cloud API',
          version: '1.0.0',
          time: new Date().toISOString()
        }
      });
    } catch {
      res.status(503).json({
        data: {
          status: 'down',
          database: false,
          name: 'ZhanX DentalCare Cloud API',
          version: '1.0.0',
          time: new Date().toISOString()
        }
      });
    }
  });

  app.use('/api/license', licenseRoutes);
  app.use('/api/setup', setupRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/tamilan', tamilanRoutes);

  // Fail closed: every clinical, financial and administrative module requires a valid,
  // device-bound license. The renderer can never bypass this by changing its own state.
  app.use('/api', requireLicense);

  app.use('/api/users', usersRoutes);
  app.use('/api/clinic', clinicRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/patients', patientsRoutes);
  app.use('/api/appointments', appointmentsRoutes);
  app.use('/api/consultations', consultationsRoutes);
  app.use('/api/dental-chart', dentalChartRoutes);
  app.use('/api/treatments', treatmentsRoutes);
  app.use('/api/treatment-plans', treatmentPlansRoutes);
  app.use('/api/prescriptions', prescriptionsRoutes);
  app.use('/api/invoices', invoicesRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/refunds', refundsRoutes);
  app.use('/api/patient-credits', patientCreditsRoutes);
  app.use('/api/claims', claimsRoutes);
  app.use('/api/reminders', remindersRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/suppliers', inventoryRoutes.suppliers);
  app.use('/api/laboratories', labsRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/recalls', recallsRoutes);
  app.use('/api/backups', backupsRoutes);
  app.use('/api/audit-logs', auditRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
