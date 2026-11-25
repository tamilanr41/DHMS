import { Router } from 'express';
import { query } from '../database/db.js';
import { ApiError } from '../utils/errors.js';

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

    if (clinicCode) {
      const q = await query('SELECT * FROM clinic_tenants WHERE clinic_code = $1', [clinicCode]);
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
        reason: 'REGISTER_REQUIRED',
        message: 'No registered clinic found on this workstation. Please submit clinic registration.'
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
      [clinic.id, deviceFingerprint, deviceName || 'Clinic Computer', osPlatform || null, browserInfo || null]
    );

    return res.json({
      allowed: true,
      clinic,
      activeModules: clinic.active_modules || [],
      maxSystems: clinic.max_systems,
      deviceId: newDevice.rows[0].id,
      message: `System registered successfully (${activeCount + 1}/${clinic.max_systems} systems authorized).`
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

// 2. List all registered clinics with device counts
router.get('/clinics', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT 
        c.*,
        COALESCE(d.device_count, 0) AS active_devices_count
      FROM clinic_tenants c
      LEFT JOIN (
        SELECT clinic_id, count(*)::int AS device_count 
        FROM clinic_devices 
        WHERE is_authorized = true 
        GROUP BY clinic_id
      ) d ON d.clinic_id = c.id
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

    // Calculate new validity
    const daysToAdd = monthsNum * 30;
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + daysToAdd);

    // Update clinic record
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

    // Insert payment record
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

export default router;
