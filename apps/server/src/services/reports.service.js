import { query } from '../database/db.js';

const money = 'money';

function clinicWhere(user, col = 'clinic_id') {
  if (!user?.clinicId) return '';
  return `AND ${col} = '${user.clinicId}'`;
}

const REPORTS = {
  patients: {
    title: 'Patient registrations',
    permission: 'reports.view',
    dateColumn: 'registration date',
    run: ({ start, end, user }) => query(
      `SELECT patient_no, full_name, gender, dob, mobile, email, address, created_at::date AS registered_on
       FROM patients WHERE created_at::date BETWEEN $1 AND $2 ${clinicWhere(user)} ORDER BY created_at DESC`,
      [start, end]
    ),
    columns: [
      { key: 'patient_no', label: 'Patient ID' },
      { key: 'full_name', label: 'Name' },
      { key: 'gender', label: 'Gender' },
      { key: 'dob', label: 'DOB' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'registered_on', label: 'Registered' }
    ]
  },
  'patient-visits': {
    title: 'Patient visits',
    permission: 'reports.view',
    run: ({ start, end, user }) => query(
      `SELECT c.consultation_no, c.visit_at::date AS visit_date, p.patient_no, p.full_name AS patient,
              u.full_name AS dentist, c.diagnosis, c.status
       FROM consultations c JOIN patients p ON p.id = c.patient_id JOIN users u ON u.id = c.dentist_id
       WHERE c.visit_at::date BETWEEN $1 AND $2 ${clinicWhere(user, 'p.clinic_id')} ORDER BY c.visit_at DESC`,
      [start, end]
    ),
    columns: [
      { key: 'consultation_no', label: 'Consultation' },
      { key: 'visit_date', label: 'Date' },
      { key: 'patient_no', label: 'Patient ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'dentist', label: 'Dentist' },
      { key: 'diagnosis', label: 'Diagnosis' },
      { key: 'status', label: 'Status' }
    ]
  },
  appointments: {
    title: 'Daily appointments',
    permission: 'reports.view',
    run: ({ start, end, user }) => query(
      `SELECT a.appointment_no, a.appointment_date, a.start_time::text, a.end_time::text,
              p.patient_no, p.full_name AS patient, u.full_name AS dentist,
              replace(a.appointment_type,'_',' ') AS type, replace(a.status,'_',' ') AS status
       FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = a.dentist_id
       WHERE a.appointment_date BETWEEN $1 AND $2 ${clinicWhere(user, 'a.clinic_id')} ORDER BY a.appointment_date, a.start_time`,
      [start, end]
    ),
    columns: [
      { key: 'appointment_no', label: 'Appointment' },
      { key: 'appointment_date', label: 'Date' },
      { key: 'start_time', label: 'Start' },
      { key: 'end_time', label: 'End' },
      { key: 'patient_no', label: 'Patient ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'dentist', label: 'Dentist' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' }
    ]
  },
  'cancelled-appointments': {
    title: 'Cancelled appointments',
    permission: 'reports.view',
    run: ({ start, end, user }) => query(
      `SELECT a.appointment_no, a.appointment_date, a.start_time::text, p.patient_no, p.full_name AS patient,
              u.full_name AS dentist, a.reason
       FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = a.dentist_id
       WHERE a.status = 'cancelled' AND a.appointment_date BETWEEN $1 AND $2 ${clinicWhere(user, 'a.clinic_id')} ORDER BY a.appointment_date DESC`,
      [start, end]
    ),
    columns: [
      { key: 'appointment_no', label: 'Appointment' },
      { key: 'appointment_date', label: 'Date' },
      { key: 'start_time', label: 'Time' },
      { key: 'patient_no', label: 'Patient ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'dentist', label: 'Dentist' },
      { key: 'reason', label: 'Reason' }
    ]
  },
  'no-show-appointments': {
    title: 'No-show appointments',
    permission: 'reports.view',
    run: ({ start, end, user }) => query(
      `SELECT a.appointment_no, a.appointment_date, a.start_time::text, p.patient_no, p.full_name AS patient,
              u.full_name AS dentist
       FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = a.dentist_id
       WHERE a.status = 'no_show' AND a.appointment_date BETWEEN $1 AND $2 ${clinicWhere(user, 'a.clinic_id')} ORDER BY a.appointment_date DESC`,
      [start, end]
    ),
    columns: [
      { key: 'appointment_no', label: 'Appointment' },
      { key: 'appointment_date', label: 'Date' },
      { key: 'start_time', label: 'Time' },
      { key: 'patient_no', label: 'Patient ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'dentist', label: 'Dentist' }
    ]
  },
  'dentist-appointments': {
    title: 'Appointments by dentist',
    permission: 'reports.view',
    run: ({ start, end }) => query(
      `SELECT u.full_name AS dentist, count(*)::int AS appointments,
              count(*) FILTER (WHERE a.status = 'completed')::int AS completed,
              count(*) FILTER (WHERE a.status = 'cancelled')::int AS cancelled,
              count(*) FILTER (WHERE a.status = 'no_show')::int AS no_show
       FROM appointments a JOIN users u ON u.id = a.dentist_id
       WHERE a.appointment_date BETWEEN $1 AND $2
       GROUP BY u.full_name ORDER BY appointments DESC`,
      [start, end]
    ),
    columns: [
      { key: 'dentist', label: 'Dentist' },
      { key: 'appointments', label: 'Appointments', format: 'int' },
      { key: 'completed', label: 'Completed', format: 'int' },
      { key: 'cancelled', label: 'Cancelled', format: 'int' },
      { key: 'no_show', label: 'No show', format: 'int' }
    ]
  },
  'collections-daily': {
    title: 'Daily collection',
    permission: 'reports.financial',
    run: ({ start, end, user }) => query(
      `WITH days AS (SELECT generate_series($1::date, $2::date, '1 day')::date AS d)
       SELECT to_char(days.d, 'YYYY-MM-DD') AS date,
              COALESCE((SELECT sum(amount) FROM payments WHERE status='completed' AND payment_date::date = days.d ${clinicWhere(user)}),0) AS collected,
              COALESCE((SELECT sum(amount) FROM refunds WHERE refunded_at::date = days.d ${clinicWhere(user)}),0) AS refunded,
              COALESCE((SELECT sum(amount) FROM payments WHERE status='completed' AND method='Cash' AND payment_date::date = days.d ${clinicWhere(user)}),0) AS cash,
              (SELECT count(*) FROM payments WHERE status='completed' AND payment_date::date = days.d ${clinicWhere(user)})::int AS transactions
       FROM days WHERE days.d <= CURRENT_DATE ORDER BY days.d DESC`,
      [start, end]
    ),
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'collected', label: 'Collected', format: money },
      { key: 'refunded', label: 'Refunded', format: money },
      { key: 'cash', label: 'Cash', format: money },
      { key: 'transactions', label: 'Transactions', format: 'int' }
    ]
  },
  'monthly-collection': {
    title: 'Monthly collection',
    permission: 'reports.financial',
    run: ({ start, end, user }) => query(
      `SELECT to_char(date_trunc('month', payment_date), 'Mon YYYY') AS month,
              sum(amount) AS collected,
              count(*)::int AS transactions
       FROM payments WHERE status='completed' AND payment_date::date BETWEEN $1 AND $2 ${clinicWhere(user)}
       GROUP BY date_trunc('month', payment_date) ORDER BY date_trunc('month', payment_date) DESC`,
      [start, end]
    ),
    columns: [
      { key: 'month', label: 'Month' },
      { key: 'collected', label: 'Collected', format: money },
      { key: 'transactions', label: 'Transactions', format: 'int' }
    ]
  },
  'payment-methods': {
    title: 'Collection by payment method',
    permission: 'reports.financial',
    run: ({ start, end, user }) => query(
      `SELECT method, sum(amount) AS collected, count(*)::int AS transactions
       FROM payments WHERE status='completed' AND payment_date::date BETWEEN $1 AND $2 ${clinicWhere(user)}
       GROUP BY method ORDER BY collected DESC`,
      [start, end]
    ),
    columns: [
      { key: 'method', label: 'Method' },
      { key: 'collected', label: 'Collected', format: money },
      { key: 'transactions', label: 'Transactions', format: 'int' }
    ]
  },
  'outstanding-invoices': {
    title: 'Outstanding invoices',
    permission: 'reports.financial',
    run: ({ user }) => query(
      `SELECT i.invoice_no, i.invoice_date, p.patient_no, p.full_name AS patient, p.mobile,
              i.total, i.amount_paid, i.outstanding_balance, i.status
       FROM invoices i JOIN patients p ON p.id = i.patient_id
       WHERE i.status IN ('issued','partially_paid') AND i.outstanding_balance > 0 ${clinicWhere(user, 'i.clinic_id')}
       ORDER BY i.invoice_date ASC`
    ),
    columns: [
      { key: 'invoice_no', label: 'Invoice' },
      { key: 'invoice_date', label: 'Date' },
      { key: 'patient_no', label: 'Patient ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'total', label: 'Total', format: money },
      { key: 'amount_paid', label: 'Paid', format: money },
      { key: 'outstanding_balance', label: 'Outstanding', format: money },
      { key: 'status', label: 'Status' }
    ]
  },
  discounts: {
    title: 'Discounts given',
    permission: 'reports.financial',
    run: ({ start, end }) => query(
      `SELECT i.invoice_no, i.invoice_date, p.patient_no, p.full_name AS patient,
              ii.description, ii.discount
       FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN patients p ON p.id = i.patient_id
       WHERE ii.discount > 0 AND i.status <> 'void' AND i.invoice_date BETWEEN $1 AND $2
       ORDER BY i.invoice_date DESC`,
      [start, end]
    ),
    columns: [
      { key: 'invoice_no', label: 'Invoice' },
      { key: 'invoice_date', label: 'Date' },
      { key: 'patient_no', label: 'Patient ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'description', label: 'Treatment' },
      { key: 'discount', label: 'Discount', format: money }
    ]
  },
  refunds: {
    title: 'Refunds',
    permission: 'reports.financial',
    run: ({ start, end }) => query(
      `SELECT r.refund_no, r.refunded_at::date AS date, i.invoice_no, p.patient_no, p.full_name AS patient,
              r.amount, r.method, r.reason
       FROM refunds r JOIN invoices i ON i.id = r.invoice_id JOIN patients p ON p.id = r.patient_id
       WHERE r.refunded_at::date BETWEEN $1 AND $2 ORDER BY r.refunded_at DESC`,
      [start, end]
    ),
    columns: [
      { key: 'refund_no', label: 'Refund' },
      { key: 'date', label: 'Date' },
      { key: 'invoice_no', label: 'Invoice' },
      { key: 'patient_no', label: 'Patient ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'amount', label: 'Amount', format: money },
      { key: 'method', label: 'Method' },
      { key: 'reason', label: 'Reason' }
    ]
  },
  'treatment-revenue': {
    title: 'Revenue by treatment',
    permission: 'reports.financial',
    run: ({ start, end }) => query(
      `SELECT ii.description AS treatment, sum(ii.quantity) AS quantity,
              sum(ii.line_total) AS revenue, count(DISTINCT i.id)::int AS invoices
       FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
       WHERE i.status NOT IN ('void','draft') AND i.invoice_date BETWEEN $1 AND $2
       GROUP BY ii.description ORDER BY revenue DESC`,
      [start, end]
    ),
    columns: [
      { key: 'treatment', label: 'Treatment' },
      { key: 'quantity', label: 'Qty', format: 'number' },
      { key: 'revenue', label: 'Revenue', format: money },
      { key: 'invoices', label: 'Invoices', format: 'int' }
    ]
  },
  'cash-collection': {
    title: 'Cash collection summary',
    permission: 'reports.financial',
    run: ({ start, end }) => query(
      `SELECT to_char(payment_date, 'YYYY-MM-DD') AS date, sum(amount) AS cash,
              count(*)::int AS transactions
       FROM payments WHERE status='completed' AND method='Cash' AND payment_date::date BETWEEN $1 AND $2
       GROUP BY payment_date::date ORDER BY payment_date::date DESC`,
      [start, end]
    ),
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'cash', label: 'Cash', format: money },
      { key: 'transactions', label: 'Transactions', format: 'int' }
    ]
  },
  'treatment-history': {
    title: 'Treatment history',
    permission: 'reports.view',
    run: ({ start, end }) => query(
      `SELECT tp.plan_no, p.patient_no, p.full_name AS patient, i.treatment_name, i.tooth_number,
              i.status, i.completed_at::date AS completed_on, i.total
       FROM treatment_plan_items i JOIN treatment_plans tp ON tp.id = i.plan_id JOIN patients p ON p.id = tp.patient_id
       WHERE i.status IN ('in_progress','completed') AND COALESCE(i.completed_at::date, tp.created_at::date) BETWEEN $1 AND $2
       ORDER BY i.completed_at DESC NULLS LAST`,
      [start, end]
    ),
    columns: [
      { key: 'plan_no', label: 'Plan' },
      { key: 'patient_no', label: 'Patient ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'treatment_name', label: 'Treatment' },
      { key: 'tooth_number', label: 'Tooth' },
      { key: 'status', label: 'Status' },
      { key: 'completed_on', label: 'Completed' },
      { key: 'total', label: 'Value', format: money }
    ]
  },
  'pending-plans': {
    title: 'Pending treatment plans',
    permission: 'reports.view',
    run: () => query(
      `SELECT tp.plan_no, p.patient_no, p.full_name AS patient, u.full_name AS dentist,
              count(i.id)::int AS procedures,
              COALESCE(sum(i.total) FILTER (WHERE i.status IN ('proposed','accepted','in_progress')),0) AS pending_value,
              tp.status, tp.created_at::date AS created_on
       FROM treatment_plans tp
       JOIN patients p ON p.id = tp.patient_id
       JOIN users u ON u.id = tp.dentist_id
       JOIN treatment_plan_items i ON i.plan_id = tp.id
       WHERE tp.status IN ('proposed','accepted','partially_completed')
       GROUP BY tp.id, p.patient_no, p.full_name, u.full_name
       ORDER BY tp.created_at DESC`
    ),
    columns: [
      { key: 'plan_no', label: 'Plan' },
      { key: 'patient_no', label: 'Patient ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'dentist', label: 'Dentist' },
      { key: 'procedures', label: 'Procedures', format: 'int' },
      { key: 'pending_value', label: 'Pending value', format: money },
      { key: 'status', label: 'Status' },
      { key: 'created_on', label: 'Created' }
    ]
  },
  'completed-procedures': {
    title: 'Completed procedures',
    permission: 'reports.view',
    run: ({ start, end }) => query(
      `SELECT p.patient_no, p.full_name AS patient, i.treatment_name, i.tooth_number,
              i.total, i.completed_at::date AS completed_on
       FROM treatment_plan_items i JOIN treatment_plans tp ON tp.id = i.plan_id JOIN patients p ON p.id = tp.patient_id
       WHERE i.status = 'completed' AND i.completed_at::date BETWEEN $1 AND $2
       ORDER BY i.completed_at DESC`,
      [start, end]
    ),
    columns: [
      { key: 'patient_no', label: 'Patient ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'treatment_name', label: 'Treatment' },
      { key: 'tooth_number', label: 'Tooth' },
      { key: 'total', label: 'Value', format: money },
      { key: 'completed_on', label: 'Completed' }
    ]
  },
  'follow-ups': {
    title: 'Follow-up appointments',
    permission: 'reports.view',
    run: ({ start, end }) => query(
      `SELECT c.follow_up_date, p.patient_no, p.full_name AS patient, p.mobile,
              c.diagnosis, u.full_name AS dentist
       FROM consultations c JOIN patients p ON p.id = c.patient_id JOIN users u ON u.id = c.dentist_id
       WHERE c.follow_up_date BETWEEN $1 AND $2 AND c.status <> 'draft'
       ORDER BY c.follow_up_date`,
      [start, end]
    ),
    columns: [
      { key: 'follow_up_date', label: 'Follow-up date' },
      { key: 'patient_no', label: 'Patient ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'dentist', label: 'Dentist' },
      { key: 'diagnosis', label: 'Diagnosis' }
    ]
  },
  'inventory-stock': {
    title: 'Current stock',
    permission: 'reports.view',
    run: () => query(
      `SELECT i.item_code, i.name, i.category, i.brand, i.quantity, i.unit, i.min_stock,
              i.purchase_price, i.expiry_date, s.name AS supplier,
              (i.quantity <= i.min_stock) AS low_stock
       FROM inventory_items i LEFT JOIN suppliers s ON s.id = i.supplier_id
       WHERE i.is_active ORDER BY i.category, i.name`
    ),
    columns: [
      { key: 'item_code', label: 'Code' },
      { key: 'name', label: 'Item' },
      { key: 'category', label: 'Category' },
      { key: 'brand', label: 'Brand' },
      { key: 'quantity', label: 'Qty', format: 'number' },
      { key: 'unit', label: 'Unit' },
      { key: 'min_stock', label: 'Min', format: 'number' },
      { key: 'purchase_price', label: 'Price', format: money },
      { key: 'expiry_date', label: 'Expiry' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'low_stock', label: 'Low stock', format: 'bool' }
    ]
  },
  'low-stock': {
    title: 'Low-stock items',
    permission: 'reports.view',
    run: () => query(
      `SELECT i.item_code, i.name, i.category, i.quantity, i.min_stock, i.unit, s.name AS supplier
       FROM inventory_items i LEFT JOIN suppliers s ON s.id = i.supplier_id
       WHERE i.is_active AND i.quantity <= i.min_stock ORDER BY (i.quantity - i.min_stock)`
    ),
    columns: [
      { key: 'item_code', label: 'Code' },
      { key: 'name', label: 'Item' },
      { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Qty', format: 'number' },
      { key: 'min_stock', label: 'Min', format: 'number' },
      { key: 'unit', label: 'Unit' },
      { key: 'supplier', label: 'Supplier' }
    ]
  },
  'expiring-stock': {
    title: 'Expiring items',
    permission: 'reports.view',
    run: () => query(
      `SELECT i.item_code, i.name, i.batch_number, i.expiry_date, i.quantity, i.unit,
              (i.expiry_date - CURRENT_DATE) AS days_left
       FROM inventory_items i
       WHERE i.is_active AND i.expiry_date IS NOT NULL AND i.expiry_date <= (CURRENT_DATE + interval '60 days')
       ORDER BY i.expiry_date`
    ),
    columns: [
      { key: 'item_code', label: 'Code' },
      { key: 'name', label: 'Item' },
      { key: 'batch_number', label: 'Batch' },
      { key: 'expiry_date', label: 'Expiry' },
      { key: 'quantity', label: 'Qty', format: 'number' },
      { key: 'unit', label: 'Unit' },
      { key: 'days_left', label: 'Days left', format: 'int' }
    ]
  },
  'stock-movements': {
    title: 'Stock movements',
    permission: 'reports.view',
    run: ({ start, end }) => query(
      `SELECT m.created_at::date AS date, i.name AS item, m.movement_type, m.quantity_change,
              m.balance_after, m.reference, u.full_name AS performed_by
       FROM stock_movements m JOIN inventory_items i ON i.id = m.item_id LEFT JOIN users u ON u.id = m.performed_by
       WHERE m.created_at::date BETWEEN $1 AND $2 ORDER BY m.created_at DESC`,
      [start, end]
    ),
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'item', label: 'Item' },
      { key: 'movement_type', label: 'Type' },
      { key: 'quantity_change', label: 'Change', format: 'number' },
      { key: 'balance_after', label: 'Balance', format: 'number' },
      { key: 'reference', label: 'Reference' },
      { key: 'performed_by', label: 'By' }
    ]
  }
};

export const REPORT_LIST = Object.keys(REPORTS);

export function getReportDefinition(name) {
  return REPORTS[name] || null;
}

export async function runReport(name, params) {
  const def = REPORTS[name];
  if (!def) return null;
  const result = await def.run(params);
  return {
    name,
    title: def.title,
    columns: def.columns,
    rows: result.rows
  };
}
