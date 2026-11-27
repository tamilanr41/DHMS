-- 015_multi_tenant_comprehensive.sql
-- Comprehensive clinic tenant isolation for Model B Multi-Tenant SaaS

-- 1. Consultations
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS consultations_clinic_idx ON consultations (clinic_id);

-- 2. Prescriptions
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS prescriptions_clinic_idx ON prescriptions (clinic_id);

-- 3. Payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS payments_clinic_idx ON payments (clinic_id);

-- 4. Suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS suppliers_clinic_idx ON suppliers (clinic_id);

-- 5. Dental Laboratories
ALTER TABLE dental_laboratories ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS dental_laboratories_clinic_idx ON dental_laboratories (clinic_id);

-- 6. Insurance Claims
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS insurance_claims_clinic_idx ON insurance_claims (clinic_id);

-- 7. Patient Credits
ALTER TABLE patient_credits ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinic_tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS patient_credits_clinic_idx ON patient_credits (clinic_id);

-- Backfill existing rows with clinic_id from parent patient/invoice records if present
UPDATE consultations c SET clinic_id = p.clinic_id FROM patients p WHERE c.patient_id = p.id AND c.clinic_id IS NULL AND p.clinic_id IS NOT NULL;
UPDATE prescriptions pr SET clinic_id = p.clinic_id FROM patients p WHERE pr.patient_id = p.id AND pr.clinic_id IS NULL AND p.clinic_id IS NOT NULL;
UPDATE payments py SET clinic_id = i.clinic_id FROM invoices i WHERE py.invoice_id = i.id AND py.clinic_id IS NULL AND i.clinic_id IS NOT NULL;
