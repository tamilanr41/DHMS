import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../database/db.js';
import { ApiError } from '../utils/errors.js';
import { config } from '../config/env.js';
import { hashPassword } from '../utils/password.js';

const router = Router();

// Public registration endpoint for new dental clinics requesting access
router.post('/register', async (req, res, next) => {
  try {
    const {
      clinicName, doctorName, mobile, email, city, address,
      requestedModules, requestedSystems, planName,
      deviceFingerprint, deviceName, osPlatform, browserInfo
    } = req.body;

    if (!clinicName || !doctorName || !mobile) {
      throw ApiError.badRequest('Clinic name, doctor name, and mobile number are required.');
    }

    // Generate readable clinic code: e.g. CLN-7482
    const randomCode = `CLN-${Math.floor(1000 + Math.random() * 9000)}`;

    const modules = Array.isArray(requestedModules) && requestedModules.length > 0
      ? requestedModules
      : ['appointments', 'queue', 'chart', 'plans', 'prescriptions', 'billing'];

    const systems = Number(requestedSystems) > 0 ? Number(requestedSystems) : 1;

    const { rows } = await query(
      `INSERT INTO clinic_tenants (
        clinic_code, clinic_name, doctor_name, mobile, email, city, address,
        requested_modules, active_modules, status, max_systems, plan_name,
        amount_paid
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_approval', $10, $11, 0)
      RETURNING *`,
      [
        randomCode,
        clinicName.trim(),
        doctorName.trim(),
        mobile.trim(),
        email ? email.trim() : null,
        city ? city.trim() : null,
        address ? address.trim() : null,
        JSON.stringify(modules),
        JSON.stringify([]), // No active modules until Admin approves
        systems,
        planName || `${systems}-System Care Plan`
      ]
    );

    const clinic = rows[0];

    // Automatically bind the registering computer/device fingerprint to this clinic
    if (deviceFingerprint) {
      await query(
        `INSERT INTO clinic_devices (
          clinic_id, device_fingerprint, device_name, os_platform, browser_info, is_authorized
        ) VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (clinic_id, device_fingerprint) DO NOTHING`,
        [clinic.id, deviceFingerprint, deviceName || 'Primary Station', osPlatform || null, browserInfo || null]
      );
    }

    res.status(201).json({
      success: true,
      data: clinic,
      message: 'Clinic registration submitted. Pending administrator review and authorization.'
    });
  } catch (err) {
    next(err);
  }
});

// Device / Hardware System Verification (Enforces Seat / System Limits)
router.post('/device/verify', async (req, res, next) => {
  try {
    const { clinicCode, deviceFingerprint, deviceName, osPlatform, browserInfo } = req.body;

    if (!deviceFingerprint) {
      return res.status(400).json({ allowed: false, reason: 'DEVICE_ID_REQUIRED', message: 'Device identity fingerprint is missing.' });
    }

    let clinic = null;

    if (clinicCode && typeof clinicCode === 'string' && clinicCode.trim()) {
      const cleanCode = clinicCode.trim();
      const q = await query('SELECT * FROM clinic_tenants WHERE UPPER(clinic_code) = UPPER($1)', [cleanCode]);
      if (q.rows.length > 0) clinic = q.rows[0];
    } else {
      // Find if this specific computer/device fingerprint was already registered to any clinic
      const devQ = await query(
        `SELECT c.* FROM clinic_tenants c
         JOIN clinic_devices d ON d.clinic_id = c.id
         WHERE d.device_fingerprint = $1
         ORDER BY d.first_seen_at DESC LIMIT 1`,
        [deviceFingerprint]
      );
      if (devQ.rows.length > 0) clinic = devQ.rows[0];
    }

    // If no clinic is linked to this computer or clinicCode:
    if (!clinic) {
      return res.json({
        allowed: false,
        reason: clinicCode ? 'CLINIC_NOT_FOUND' : 'REGISTER_REQUIRED',
        message: clinicCode
          ? `Clinic code '${clinicCode.toUpperCase()}' does not exist. Please check your clinic code or register a new clinic.`
          : 'No registered clinic found on this workstation. Please submit clinic registration.'
      });
    }

    // Check Approval & License Expiry
    if (clinic.status === 'pending_approval') {
      return res.json({
        allowed: false,
        reason: 'PENDING_APPROVAL',
        clinic,
        message: 'Your clinic registration is under review. Access will unlock once approved by the administrator.'
      });
    }

    if (clinic.status === 'suspended') {
      return res.json({
        allowed: false,
        reason: 'SUSPENDED',
        clinic,
        message: 'Your clinic account has been temporarily suspended. Kindly contact the administrator.'
      });
    }

    if (clinic.valid_until && new Date(clinic.valid_until) < new Date()) {
      return res.json({
        allowed: false,
        reason: 'EXPIRED',
        clinic,
        message: `Your subscription expired on ${new Date(clinic.valid_until).toLocaleDateString()}. Contact the administrator to renew.`
      });
    }

    // Check Device / System binding
    const deviceCheck = await query(
      'SELECT * FROM clinic_devices WHERE clinic_id = $1 AND device_fingerprint = $2',
      [clinic.id, deviceFingerprint]
    );

    if (deviceCheck.rows.length > 0) {
      // Existing device: update last_seen_at
      await query(
        'UPDATE clinic_devices SET last_seen_at = now(), device_name = COALESCE($1, device_name) WHERE id = $2',
        [deviceName || null, deviceCheck.rows[0].id]
      );

      return res.json({
        allowed: true,
        clinic,
        activeModules: clinic.active_modules || [],
        maxSystems: clinic.max_systems,
        deviceId: deviceCheck.rows[0].id
      });
    }

    // New device: check if max_systems quota is reached
    const countQuery = await query(
      'SELECT count(*)::int AS count FROM clinic_devices WHERE clinic_id = $1 AND is_authorized = true',
      [clinic.id]
    );

    const activeCount = countQuery.rows[0].count;

    if (activeCount >= clinic.max_systems) {
      return res.json({
        allowed: false,
        reason: 'MAX_SYSTEMS_REACHED',
        clinic,
        activeSystems: activeCount,
        maxSystems: clinic.max_systems,
        message: `Workstation seat limit reached! Your license allows ${clinic.max_systems} computer(s) (currently ${activeCount} active). Contact your administrator to add additional workstation seats.`
      });
    }

    // Quota available: bind this new system
    const newDevice = await query(
      `INSERT INTO clinic_devices (
        clinic_id, device_fingerprint, device_name, os_platform, browser_info, is_authorized
      ) VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *`,
      [clinic.id, deviceFingerprint, deviceName || 'Secondary Station', osPlatform || null, browserInfo || null]
    );

    return res.json({
      allowed: true,
      clinic,
      activeModules: clinic.active_modules || [],
      maxSystems: clinic.max_systems,
      deviceId: newDevice.rows[0].id
    });
  } catch (err) {
    next(err);
  }
});

// ── Tamilan Super Admin Endpoints ───────────────────────────────

// 1. Overall Stats Overview
router.get('/stats', async (req, res, next) => {
  try {
    const clinicsCount = await query('SELECT count(*)::int AS count FROM clinic_tenants');
    const pendingCount = await query("SELECT count(*)::int AS count FROM clinic_tenants WHERE status = 'pending_approval'");
    const activeCount = await query("SELECT count(*)::int AS count FROM clinic_tenants WHERE status = 'active'");
    const totalRev = await query('SELECT COALESCE(SUM(amount), 0) AS total FROM tamilan_payments');
    const totalDevices = await query('SELECT count(*)::int AS count FROM clinic_devices WHERE is_authorized = true');

    res.json({
      data: {
        totalClinics: clinicsCount.rows[0].count,
        pendingApprovals: pendingCount.rows[0].count,
        activeClinics: activeCount.rows[0].count,
        totalRevenue: Number(totalRev.rows[0].total),
        authorizedDevices: totalDevices.rows[0].count
      }
    });
  } catch (err) {
    next(err);
  }
});

// 2. List all registered clinics with rich telemetry & usage details
router.get('/clinics', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT 
        c.*,
        COALESCE(d.device_count, 0) AS active_devices_count,
        COALESCE(pat.patient_count, 0) AS patient_count,
        COALESCE(apt.appointment_count, 0) AS appointment_count,
        COALESCE(inv.invoice_count, 0) AS invoice_count,
        COALESCE(usr.user_count, 0) AS user_count,
        d.last_device_seen
      FROM clinic_tenants c
      LEFT JOIN (
        SELECT clinic_id, count(*)::int AS device_count, max(last_seen_at) AS last_device_seen
        FROM clinic_devices 
        WHERE is_authorized = true 
        GROUP BY clinic_id
      ) d ON d.clinic_id = c.id
      LEFT JOIN (
        SELECT clinic_id, count(*)::int AS patient_count
        FROM patients GROUP BY clinic_id
      ) pat ON pat.clinic_id = c.id
      LEFT JOIN (
        SELECT clinic_id, count(*)::int AS appointment_count
        FROM appointments GROUP BY clinic_id
      ) apt ON apt.clinic_id = c.id
      LEFT JOIN (
        SELECT clinic_id, count(*)::int AS invoice_count
        FROM invoices GROUP BY clinic_id
      ) inv ON inv.clinic_id = c.id
      LEFT JOIN (
        SELECT clinic_id, count(*)::int AS user_count
        FROM users GROUP BY clinic_id
      ) usr ON usr.clinic_id = c.id
      ORDER BY 
        CASE WHEN c.status = 'pending_approval' THEN 0 ELSE 1 END,
        c.created_at DESC
    `);

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// 3. Approve Clinic & Record Fee Collection (Tamilan Action)
router.post('/clinics/:id/approve-payment', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      amount, paymentMethod, transactionRef, durationMonths,
      maxSystems, activeModules, notes
    } = req.body;

    const amountNum = Number(amount || 0);
    const monthsNum = Number(durationMonths || 1);
    const systemsNum = Number(maxSystems || 1);

    const clinicRes = await query('SELECT * FROM clinic_tenants WHERE id = $1', [id]);
    if (clinicRes.rows.length === 0) throw ApiError.notFound('Clinic not found');

    const receiptNo = `TAM-REC-${Math.floor(100000 + Math.random() * 900000)}`;

    const daysToAdd = monthsNum * 30;
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + daysToAdd);

    const updatedClinic = await query(
      `UPDATE clinic_tenants SET
        status = 'active',
        max_systems = $1,
        active_modules = $2,
        amount_paid = amount_paid + $3,
        activated_at = COALESCE(activated_at, now()),
        valid_until = $4,
        admin_notes = COALESCE($5, admin_notes),
        updated_at = now()
      WHERE id = $6
      RETURNING *`,
      [
        systemsNum,
        JSON.stringify(activeModules || clinicRes.rows[0].requested_modules || []),
        amountNum,
        validUntilDate.toISOString(),
        notes || null,
        id
      ]
    );

    if (amountNum > 0) {
      await query(
        `INSERT INTO tamilan_payments (
          clinic_id, receipt_no, amount, payment_method, transaction_ref,
          months_granted, systems_granted, recorded_by, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Tamilan Master Admin', $8)`,
        [
          id, receiptNo, amountNum, paymentMethod || 'UPI',
          transactionRef || null, monthsNum, systemsNum, notes || null
        ]
      );
    }

    res.json({
      success: true,
      data: updatedClinic.rows[0],
      receiptNo,
      message: `Clinic ${updatedClinic.rows[0].clinic_name} approved and activated for ${systemsNum} system(s) until ${validUntilDate.toLocaleDateString()}.`
    });
  } catch (err) {
    next(err);
  }
});

// 4. Suspend or Toggle Clinic Access
router.post('/clinics/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!['pending_approval', 'active', 'suspended', 'expired'].includes(status)) {
      throw ApiError.badRequest('Invalid status');
    }

    const { rows } = await query(
      `UPDATE clinic_tenants SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = now()
       WHERE id = $3 RETURNING *`,
      [status, adminNotes || null, id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// 5. Manage Devices for a Clinic
router.get('/clinics/:id/devices', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      'SELECT * FROM clinic_devices WHERE clinic_id = $1 ORDER BY last_seen_at DESC',
      [id]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// 6. Revoke / De-authorize a Device (Allows clinic to replace broken PC)
router.delete('/devices/:deviceId', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    await query('DELETE FROM clinic_devices WHERE id = $1', [deviceId]);
    res.json({ success: true, message: 'Device authorization revoked. The clinic can now link a new replacement computer.' });
  } catch (err) {
    next(err);
  }
});

// 7. Get Tamilan Master Payments Ledger
router.get('/payments', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT p.*, c.clinic_name, c.doctor_name, c.mobile
      FROM tamilan_payments p
      JOIN clinic_tenants c ON c.id = p.clinic_id
      ORDER BY p.payment_date DESC
    `);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// 8. One-Click Support Impersonation: Master Admin enters Clinic Workspace
router.post('/clinics/:id/impersonate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const clinicQ = await query('SELECT * FROM clinic_tenants WHERE id = $1', [id]);
    if (clinicQ.rows.length === 0) throw ApiError.notFound('Clinic not found');
    const clinic = clinicQ.rows[0];

    // Find or create an admin user for this clinic
    let userQ = await query(
      "SELECT u.*, r.code AS role_code FROM users u JOIN roles r ON r.id = u.role_id WHERE u.clinic_id = $1 AND r.code = 'admin' LIMIT 1",
      [clinic.id]
    );

    let user = userQ.rows[0];
    if (!user) {
      const defaultHash = await hashPassword('Support@2026');
      const roleAdmin = await query("SELECT id FROM roles WHERE code = 'admin'");
      const ins = await query(
        `INSERT INTO users (username, password_hash, full_name, role_id, clinic_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, full_name, clinic_id`,
        [`admin_${clinic.clinic_code.toLowerCase().replace('-', '_')}`, defaultHash, `${clinic.doctor_name} (Admin)`, roleAdmin.rows[0].id, clinic.id]
      );
      user = { ...ins.rows[0], role_code: 'admin' };
    }

    const token = jwt.sign(
      { sub: user.id, role: 'admin', name: `Support: ${clinic.clinic_name}`, clinicId: clinic.id, isSupportMode: true },
      config.auth.jwtSecret,
      { expiresIn: '12h', issuer: 'zhanx-dentalcare', audience: 'zhanx-desktop' }
    );

    res.json({
      success: true,
      data: {
        accessToken: token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: 'admin',
          clinicId: clinic.id
        },
        clinic: {
          id: clinic.id,
          clinicCode: clinic.clinic_code,
          clinicName: clinic.clinic_name
        }
      },
      message: `Support session established for ${clinic.clinic_name}`
    });
  } catch (err) {
    next(err);
  }
});

// 9. Reset Clinic Admin Password & Unlock Lockout
router.post('/clinics/:id/reset-admin-password', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const passwordToSet = newPassword || 'Clinic@2026';
    const hash = await hashPassword(passwordToSet);

    const clinicQ = await query('SELECT * FROM clinic_tenants WHERE id = $1', [id]);
    if (clinicQ.rows.length === 0) throw ApiError.notFound('Clinic not found');

    const updateRes = await query(
      `UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = null, updated_at = now()
       WHERE clinic_id = $2
       RETURNING id, username, full_name`,
      [hash, id]
    );

    if (updateRes.rows.length === 0) {
      const roleAdmin = await query("SELECT id FROM roles WHERE code = 'admin'");
      await query(
        `INSERT INTO users (username, password_hash, full_name, role_id, clinic_id)
         VALUES ($1, $2, $3, $4, $5)`,
        ['admin', hash, clinicQ.rows[0].doctor_name, roleAdmin.rows[0].id, id]
      );
    }

    res.json({
      success: true,
      temporaryPassword: passwordToSet,
      message: `Password reset to: ${passwordToSet}. Account lockout cleared.`
    });
  } catch (err) {
    next(err);
  }
});

// 10. Update Active Modules
router.post('/clinics/:id/modules', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { activeModules } = req.body;
    if (!Array.isArray(activeModules)) throw ApiError.badRequest('activeModules must be an array');
    const { rows } = await query(
      'UPDATE clinic_tenants SET active_modules = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [JSON.stringify(activeModules), id]
    );
    res.json({ success: true, data: rows[0], message: 'Modules updated successfully.' });
  } catch (err) {
    next(err);
  }
});

// 11. Extend Subscription Validity
router.post('/clinics/:id/extend-validity', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { daysToAdd, validUntil } = req.body;
    let newDate;
    if (validUntil) {
      newDate = new Date(validUntil);
    } else {
      const days = Number(daysToAdd || 30);
      const curQ = await query('SELECT valid_until FROM clinic_tenants WHERE id = $1', [id]);
      const current = curQ.rows[0]?.valid_until ? new Date(curQ.rows[0].valid_until) : new Date();
      const base = current > new Date() ? current : new Date();
      base.setDate(base.getDate() + days);
      newDate = base;
    }

    const { rows } = await query(
      `UPDATE clinic_tenants SET valid_until = $1, status = 'active', updated_at = now() WHERE id = $2 RETURNING *`,
      [newDate.toISOString(), id]
    );
    res.json({ success: true, data: rows[0], message: `Subscription extended until ${newDate.toLocaleDateString()}.` });
  } catch (err) {
    next(err);
  }
});

// 12. Update Max Systems / Seat Limits
router.post('/clinics/:id/seat-limit', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { maxSystems } = req.body;
    const count = Number(maxSystems);
    if (!count || count < 1) throw ApiError.badRequest('maxSystems must be at least 1');
    const { rows } = await query(
      'UPDATE clinic_tenants SET max_systems = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [count, id]
    );
    res.json({ success: true, data: rows[0], message: `Seat limit updated to ${count} workstation(s).` });
  } catch (err) {
    next(err);
  }
});

// 13. Reset / Unbind all devices for a clinic
router.post('/clinics/:id/reset-devices', async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM clinic_devices WHERE clinic_id = $1', [id]);
    res.json({ success: true, message: 'All device bindings cleared. Clinic computers can now freshly connect.' });
  } catch (err) {
    next(err);
  }
});

// 14. Super Admin Direct Clinic Onboarding
router.post('/clinics', async (req, res, next) => {
  try {
    const {
      clinicName, doctorName, mobile, email, city, address,
      planName, maxSystems, durationMonths, initialPassword, activeModules
    } = req.body;

    if (!clinicName || !doctorName || !mobile) {
      throw ApiError.badRequest('Clinic name, doctor name, and mobile are required.');
    }

    const randomCode = `CLN-${Math.floor(1000 + Math.random() * 9000)}`;
    const months = Number(durationMonths || 12);
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + months * 30);

    const defaultModules = [
      'appointments', 'queue', 'chart', 'plans', 'prescriptions',
      'billing', 'labs', 'inventory', 'reports'
    ];
    const modules = Array.isArray(activeModules) && activeModules.length > 0 ? activeModules : defaultModules;
    const systems = Number(maxSystems || 1);

    const { rows } = await query(
      `INSERT INTO clinic_tenants (
        clinic_code, clinic_name, doctor_name, mobile, email, city, address,
        requested_modules, active_modules, status, max_systems, plan_name,
        amount_paid, activated_at, valid_until
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, 0, now(), $12)
      RETURNING *`,
      [
        randomCode,
        clinicName.trim(),
        doctorName.trim(),
        mobile.trim(),
        email ? email.trim() : null,
        city ? city.trim() : null,
        address ? address.trim() : null,
        JSON.stringify(modules),
        JSON.stringify(modules),
        systems,
        planName || 'Growth Care Plan',
        validUntilDate.toISOString()
      ]
    );

    const clinic = rows[0];

    // Create Admin User for this clinic
    const passwordToSet = initialPassword || 'Admin@12345';
    const hash = await hashPassword(passwordToSet);
    const roleAdmin = await query("SELECT id FROM roles WHERE code = 'admin'");
    await query(
      `INSERT INTO users (username, password_hash, full_name, role_id, clinic_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [`admin_${clinic.clinic_code.toLowerCase().replace('-', '_')}`, hash, `${clinic.doctor_name} (Admin)`, roleAdmin.rows[0].id, clinic.id]
    );

    res.status(201).json({
      success: true,
      data: clinic,
      credentials: {
        username: `admin_${clinic.clinic_code.toLowerCase().replace('-', '_')}`,
        password: passwordToSet,
        clinicCode: clinic.clinic_code
      },
      message: `Clinic ${clinic.clinic_name} created successfully with code ${clinic.clinic_code}.`
    });
  } catch (err) {
    next(err);
  }
});

// 15. Delete Clinic (Super Admin Purge)
router.delete('/clinics/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM clinic_devices WHERE clinic_id = $1', [id]);
    await query('DELETE FROM users WHERE clinic_id = $1', [id]);
    await query('DELETE FROM tamilan_payments WHERE clinic_id = $1', [id]);
    const { rowCount } = await query('DELETE FROM clinic_tenants WHERE id = $1', [id]);
    if (!rowCount) throw ApiError.notFound('Clinic not found');
    res.json({ success: true, message: 'Clinic tenant record purged successfully.' });
  } catch (err) {
    next(err);
  }
});

// 16. Database Health & Storage Overview
router.get('/database-health', async (req, res, next) => {
  try {
    const [tables, sizeRes, stats] = await Promise.all([
      query(`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`),
      query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`),
      query(`
        SELECT 
          (SELECT count(*)::int FROM patients) AS total_patients,
          (SELECT count(*)::int FROM appointments) AS total_appointments,
          (SELECT count(*)::int FROM invoices) AS total_invoices,
          (SELECT count(*)::int FROM users) AS total_users,
          (SELECT count(*)::int FROM prescriptions) AS total_prescriptions
      `)
    ]);

    res.json({
      success: true,
      data: {
        totalTables: tables.rows[0]?.count || 48,
        databaseSize: sizeRes.rows[0]?.size || '32 MB',
        counts: stats.rows[0] || {}
      }
    });
  } catch (err) {
    next(err);
  }
});

// 17. Single Clinic Live Activity Feed & Staff Pulse
router.get('/live-activity', async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [auditRes, staffRes, todayOps, todayFinance, workstations] = await Promise.all([
      // 1. Recent Audit Logs (Staff actions: billing, consults, edits)
      query(`
        SELECT a.id, a.action, a.username, a.entity_type, a.entity_id, a.details, a.ip, a.created_at
        FROM audit_logs a
        ORDER BY a.created_at DESC
        LIMIT 50
      `),
      // 2. Staff Roster & Status
      query(`
        SELECT u.id, u.username, u.full_name, u.is_active, u.last_login_at, r.name AS role_name, r.code AS role_code
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        ORDER BY u.created_at ASC
      `),
      // 3. Today's Clinical Counts
      query(`
        SELECT
          (SELECT count(*)::int FROM appointments WHERE appointment_date = $1) AS today_appointments,
          (SELECT count(*)::int FROM patients WHERE created_at::date = $1::date) AS today_new_patients,
          (SELECT count(*)::int FROM prescriptions WHERE created_at::date = $1::date) AS today_prescriptions,
          (SELECT count(*)::int FROM invoices WHERE invoice_date = $1) AS today_invoices
      `, [today]),
      // 4. Today's Financial Collection (Cash vs UPI vs Card)
      query(`
        SELECT 
          COALESCE(SUM(amount), 0) AS total_collected,
          COALESCE(SUM(CASE WHEN method = 'Cash' THEN amount ELSE 0 END), 0) AS cash_collected,
          COALESCE(SUM(CASE WHEN method ILIKE '%UPI%' THEN amount ELSE 0 END), 0) AS upi_collected,
          COALESCE(SUM(CASE WHEN method ILIKE '%Card%' THEN amount ELSE 0 END), 0) AS card_collected
        FROM payments
        WHERE payment_date::date = $1::date
      `, [today]),
      // 5. Workstations / Connected PCs
      query(`
        SELECT d.id, d.device_fingerprint, d.device_name, d.os_platform, d.last_seen_at, d.is_authorized
        FROM clinic_devices d
        ORDER BY d.last_seen_at DESC
        LIMIT 10
      `)
    ]);

    res.json({
      success: true,
      data: {
        recentActivity: auditRes.rows || [],
        staff: staffRes.rows || [],
        todayOps: todayOps.rows[0] || {},
        todayFinance: todayFinance.rows[0] || {},
        workstations: workstations.rows || []
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
