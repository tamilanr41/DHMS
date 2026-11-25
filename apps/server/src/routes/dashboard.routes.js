import { Router } from 'express';
import { query } from '../database/db.js';
import { asyncHandler } from '../utils/errors.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { parseDateRange, todayISO } from '../utils/validate.js';
import { clampNonNegative, fromPaise, toPaise } from '../utils/money.js';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('dashboard.view'), asyncHandler(async (req, res) => {
  const { start, end } = parseDateRange(req.query, { defaultDays: 30 });
  const today = todayISO();
  // Money on the dashboard follows the same permission as billing data, so an
  // assistant without billing access cannot read collections from this endpoint.
  const canSeeFinancials =
    req.user.permissions.includes('payments.view') || req.user.permissions.includes('reports.financial');

  const [
    appointments,
    queued,
    newPatients,
    totalPatients,
    collections,
    invoiced,
    outstanding,
    recentVisits,
    recentPayments,
    upcoming,
    statusDistribution,
    monthlyCollection,
    followUps,
    lowStock,
    expiring,
    procedureBreakdown,
    patientRetention,
    dailyCollections
  ] = await Promise.all([
    query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'completed')::int AS completed,
              count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
              count(*) FILTER (WHERE status = 'no_show')::int AS no_show
       FROM appointments WHERE appointment_date BETWEEN $1 AND $2`,
      [start, end]
    ),
    query(`SELECT count(*)::int AS c FROM appointments WHERE appointment_date = $1 AND status IN ('checked_in','waiting','in_consultation')`, [today]),
    query(`SELECT count(*)::int AS c FROM patients WHERE created_at::date BETWEEN $1 AND $2`, [start, end]),
    query(`SELECT count(*)::int AS c FROM patients WHERE is_active`),
    query(
      `SELECT COALESCE((SELECT sum(amount) FROM payments WHERE status='completed' AND payment_date::date BETWEEN $1 AND $2),0) AS paid,
              COALESCE((SELECT sum(amount) FROM refunds WHERE refunded_at::date BETWEEN $1 AND $2),0) AS refunded`,
      [start, end]
    ),
    query(`SELECT COALESCE(sum(total),0) AS c FROM invoices WHERE status NOT IN ('void','draft') AND invoice_date BETWEEN $1 AND $2`, [start, end]),
    query(
      `SELECT COALESCE(sum(outstanding_balance),0) AS c FROM invoices WHERE status IN ('issued','partially_paid')`
    ),
    query(
      `SELECT c.id, c.consultation_no, c.visit_at, c.diagnosis, c.status, p.full_name AS patient_name, p.id AS patient_id,
              u.full_name AS dentist_name
       FROM consultations c JOIN patients p ON p.id = c.patient_id JOIN users u ON u.id = c.dentist_id
       WHERE c.visit_at::date BETWEEN $1 AND $2
       ORDER BY c.visit_at DESC LIMIT 6`,
      [start, end]
    ),
    query(
      `SELECT pay.id, pay.payment_no, pay.amount, pay.method, pay.payment_date, pay.status,
              p.full_name AS patient_name, p.id AS patient_id, i.invoice_no
       FROM payments pay JOIN patients p ON p.id = pay.patient_id JOIN invoices i ON i.id = pay.invoice_id
       WHERE pay.payment_date::date BETWEEN $1 AND $2
       ORDER BY pay.payment_date DESC LIMIT 6`,
      [start, end]
    ),
    query(
      `SELECT a.id, a.appointment_no, a.appointment_date, a.start_time, a.status, a.reason,
              p.full_name AS patient_name, p.id AS patient_id, u.full_name AS dentist_name
       FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = a.dentist_id
       WHERE a.appointment_date >= $1 AND a.status IN ('scheduled','confirmed') AND a.appointment_date <= ($1::date + interval '7 days')
       ORDER BY a.appointment_date, a.start_time LIMIT 8`,
      [today]
    ),
    query(
      `SELECT status, count(*)::int AS count FROM appointments
       WHERE appointment_date BETWEEN $1 AND $2 GROUP BY status ORDER BY count DESC`,
      [start, end]
    ),
    query(
      `WITH months AS (
         SELECT generate_series(date_trunc('month', $1::date) - interval '5 months', date_trunc('month', $1::date), '1 month')::date AS m
       )
       SELECT to_char(m, 'Mon YYYY') AS label, m,
              COALESCE((SELECT sum(amount) FROM payments WHERE status='completed' AND payment_date >= m AND payment_date < m + interval '1 month'),0) AS collected,
              COALESCE((SELECT sum(amount) FROM refunds WHERE refunded_at >= m AND refunded_at < m + interval '1 month'),0) AS refunded
       FROM months ORDER BY m`,
      [end]
    ),
    query(
      `SELECT count(*)::int AS c FROM consultations WHERE follow_up_date BETWEEN $1 AND $2 AND status <> 'draft'`,
      [today, today]
    ),
    query(`SELECT count(*)::int AS c FROM inventory_items WHERE is_active AND quantity <= min_stock`),
    query(`SELECT count(*)::int AS c FROM inventory_items WHERE is_active AND expiry_date IS NOT NULL AND expiry_date <= (CURRENT_DATE + interval '60 days')`),
    query(
      `SELECT COALESCE(tc.category, 'General Dentistry') AS name,
              count(ii.id)::int AS value,
              COALESCE(sum(ii.line_total), 0)::numeric AS revenue
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       LEFT JOIN treatment_catalog tc ON tc.id = ii.treatment_id
       WHERE i.status NOT IN ('void','draft')
       GROUP BY COALESCE(tc.category, 'General Dentistry')
       ORDER BY value DESC LIMIT 6`
    ),
    query(
      `SELECT count(*) FILTER (WHERE (SELECT count(*) FROM consultations c WHERE c.patient_id = p.id) <= 1)::int AS new_patients,
              count(*) FILTER (WHERE (SELECT count(*) FROM consultations c WHERE c.patient_id = p.id) > 1)::int AS returning_patients
       FROM patients p WHERE p.is_active`
    ),
    query(
      `WITH days AS (
         SELECT generate_series(
           GREATEST($1::date, CURRENT_DATE - interval '14 days'),
           LEAST($2::date, CURRENT_DATE + interval '7 days'),
           '1 day'
         )::date AS d
       )
       SELECT to_char(d, 'DD Mon') AS label, d,
              COALESCE((SELECT sum(amount) FROM payments WHERE status='completed' AND payment_date::date = d), 0) AS revenue,
              COALESCE((SELECT count(*) FROM appointments WHERE appointment_date = d AND status <> 'cancelled'), 0)::int AS appointments,
              COALESCE((SELECT count(*) FROM consultations WHERE visit_at::date = d), 0)::int AS visits
       FROM days ORDER BY d`,
      [start, end]
    )
  ]);

  const collected = clampNonNegative(toPaise(collections.rows[0].paid) - toPaise(collections.rows[0].refunded));

  res.json({
    data: {
      range: { start, end },
      stats: {
        appointments: appointments.rows[0].total,
        completedConsultations: appointments.rows[0].completed,
        cancelledAppointments: appointments.rows[0].cancelled,
        noShows: appointments.rows[0].no_show,
        waiting: queued.rows[0].c,
        newPatients: newPatients.rows[0].c,
        totalPatients: totalPatients.rows[0].c,
        collected: canSeeFinancials ? fromPaise(collected) : null,
        refunded: canSeeFinancials ? fromPaise(toPaise(collections.rows[0].refunded)) : null,
        invoiced: canSeeFinancials ? invoiced.rows[0].c : null,
        outstanding: canSeeFinancials ? outstanding.rows[0].c : null,
        followUps: followUps.rows[0].c,
        lowStock: lowStock.rows[0].c,
        expiringItems: expiring.rows[0].c
      },
      recentVisits: recentVisits.rows.map((r) => ({
        id: r.id,
        consultationNo: r.consultation_no,
        visitAt: r.visit_at,
        diagnosis: r.diagnosis,
        status: r.status,
        patientName: r.patient_name,
        patientId: r.patient_id,
        dentistName: r.dentist_name
      })),
      recentPayments: (canSeeFinancials ? recentPayments.rows : []).map((r) => ({
        id: r.id,
        paymentNo: r.payment_no,
        amount: r.amount,
        method: r.method,
        paymentDate: r.payment_date,
        status: r.status,
        patientName: r.patient_name,
        patientId: r.patient_id,
        invoiceNo: r.invoice_no
      })),
      upcomingAppointments: upcoming.rows.map((r) => ({
        id: r.id,
        appointmentNo: r.appointment_no,
        appointmentDate: r.appointment_date,
        startTime: r.start_time,
        status: r.status,
        reason: r.reason,
        patientName: r.patient_name,
        patientId: r.patient_id,
        dentistName: r.dentist_name
      })),
      statusDistribution: statusDistribution.rows,
      monthlyCollection: (canSeeFinancials ? monthlyCollection.rows : []).map((r) => ({
        label: r.label,
        collected: r.collected,
        refunded: r.refunded
      })),
      procedureDistribution: procedureBreakdown.rows.map((r) => ({
        name: r.name,
        value: Number(r.value || 0),
        revenue: Number(r.revenue || 0)
      })),
      patientRetention: patientRetention.rows[0] || { new_patients: 0, returning_patients: 0 },
      dailyTrends: dailyCollections.rows.map((r) => ({
        label: r.label,
        date: r.d,
        revenue: Number(r.revenue || 0),
        appointments: Number(r.appointments || 0),
        visits: Number(r.visits || 0)
      }))
    }
  });
}));

export default router;
