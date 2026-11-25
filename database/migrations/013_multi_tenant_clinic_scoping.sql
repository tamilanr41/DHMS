-- 013_multi_tenant_clinic_scoping.sql
-- Multi-Tenant Clinic Isolation, Scoped Admin Credentials, and Purging Demo/Dummy Records

-- Temporarily drop delete prevention triggers for purge
DROP TRIGGER IF EXISTS invoices_no_delete ON invoices;
DROP TRIGGER IF EXISTS payments_no_delete ON payments;
DROP TRIGGER IF EXISTS refunds_no_delete ON refunds;
DROP TRIGGER IF EXISTS consultations_no_delete ON consultations;
DROP TRIGGER IF EXISTS invoice_adjustments_no_delete ON invoice_adjustments;

-- 1. Add clinic_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS users_clinic_idx ON users (clinic_id);

-- Drop old global unique index on username to allow different clinics to have their own admin/doctors
DROP INDEX IF EXISTS users_username_lower_idx;
CREATE UNIQUE INDEX IF NOT EXISTS users_clinic_username_idx 
  ON users (COALESCE(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(username));

-- 2. Add clinic_id to patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS patients_clinic_idx ON patients (clinic_id);

-- 3. Add clinic_id to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS appointments_clinic_idx ON appointments (clinic_id);

-- 4. Add clinic_id to treatment plans
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS treatment_plans_clinic_idx ON treatment_plans (clinic_id);

-- 5. Add clinic_id to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS invoices_clinic_idx ON invoices (clinic_id);

-- 6. Add clinic_id to inventory items
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS inventory_items_clinic_idx ON inventory_items (clinic_id);

-- 7. Add clinic_id to dental lab orders
ALTER TABLE dental_lab_orders ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS dental_lab_orders_clinic_idx ON dental_lab_orders (clinic_id);

-- 8. Add clinic_id to clinic_settings
ALTER TABLE clinic_settings DROP CONSTRAINT IF EXISTS clinic_settings_id_check;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS clinic_settings_clinic_idx ON clinic_settings (clinic_id);

-- 9. Clean out all dummy / demo clinical records for a 100% fresh start
TRUNCATE TABLE 
  appointment_reminders,
  appointment_status_history,
  appointments,
  consultation_notes,
  consultations,
  dental_chart_records,
  periodontal_records,
  treatment_plan_consents,
  treatment_plan_items,
  treatment_plans,
  invoice_adjustments,
  invoice_items,
  refunds,
  payments,
  patient_credits,
  patient_credit_applications,
  patient_communications,
  insurance_claims,
  documents,
  clinical_photos,
  patients,
  stock_movements,
  inventory_items,
  dental_lab_orders,
  refresh_sessions
CASCADE;

DELETE FROM users WHERE username IN ('example', 'dr.arjun', 'priya.front', 'kavya.assist');

-- Recreate triggers
CREATE TRIGGER invoices_no_delete BEFORE DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION invoices_delete_draft_only();

CREATE TRIGGER payments_no_delete BEFORE DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION financial_rows_immutable();

CREATE TRIGGER refunds_no_delete BEFORE DELETE ON refunds
FOR EACH ROW EXECUTE FUNCTION financial_rows_immutable();

CREATE TRIGGER consultations_no_delete BEFORE DELETE ON consultations
FOR EACH ROW EXECUTE FUNCTION financial_rows_immutable();

CREATE TRIGGER invoice_adjustments_no_delete BEFORE DELETE ON invoice_adjustments
FOR EACH ROW EXECUTE FUNCTION financial_rows_immutable();
