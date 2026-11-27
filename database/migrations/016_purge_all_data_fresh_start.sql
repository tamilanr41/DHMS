-- 016_purge_all_data_fresh_start.sql
-- Factory Reset: Purge all clinics, users, patients, clinical, and billing data for a 100% fresh start

TRUNCATE TABLE
  audit_logs,
  appointment_status_history,
  appointments,
  appointment_reminders,
  consultation_notes,
  consultations,
  dental_chart_records,
  tooth_conditions,
  prescription_items,
  prescriptions,
  treatment_plan_items,
  treatment_plan_consents,
  treatment_plans,
  clinical_photos,
  documents,
  patient_communications,
  patient_medical_history,
  patient_credit_applications,
  patient_credits,
  insurance_claims,
  payments,
  refunds,
  invoice_items,
  invoice_adjustments,
  invoices,
  patients,
  dental_lab_orders,
  stock_movements,
  inventory_items,
  suppliers,
  dental_laboratories,
  clinic_devices,
  tamilan_payments,
  refresh_sessions,
  users,
  clinic_tenants
CASCADE;

-- Reset all transaction sequences back to 1
ALTER SEQUENCE IF EXISTS seq_patient RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_appointment RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_consultation RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_plan RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_prescription RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_invoice RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_payment RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_refund RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_lab_order RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_credit RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_claim RESTART WITH 1;
ALTER SEQUENCE IF EXISTS seq_adjustment RESTART WITH 1;
