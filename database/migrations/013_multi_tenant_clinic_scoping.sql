-- 013_multi_tenant_clinic_scoping.sql
-- Multi-Tenant Clinic Isolation and Scoped Schema

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
