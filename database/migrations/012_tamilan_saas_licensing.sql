-- 012_tamilan_saas_licensing.sql
-- Tamilan Super Admin: Multi-Clinic Licensing, Device/Seat Lock, Module Permissions, and Fee Collection

CREATE TABLE IF NOT EXISTS clinic_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_code text UNIQUE NOT NULL,
  clinic_name text NOT NULL,
  doctor_name text NOT NULL,
  mobile text NOT NULL,
  email text,
  city text,
  address text,
  requested_modules jsonb NOT NULL DEFAULT '["appointments", "queue", "chart", "plans", "prescriptions", "billing"]'::jsonb,
  active_modules jsonb NOT NULL DEFAULT '["appointments", "queue", "chart", "plans", "prescriptions", "billing"]'::jsonb,
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'suspended', 'expired')),
  max_systems integer NOT NULL DEFAULT 1 CHECK (max_systems >= 1),
  plan_name text DEFAULT 'Standard 1-System Care',
  amount_paid numeric(12, 2) NOT NULL DEFAULT 0,
  activated_at timestamptz,
  valid_until timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinic_tenants_status_idx ON clinic_tenants (status);
CREATE INDEX IF NOT EXISTS clinic_tenants_mobile_idx ON clinic_tenants (mobile);

-- Clinic Authorized Systems / Devices (Hardware / Browser Fingerprint Lock)
CREATE TABLE IF NOT EXISTS clinic_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinic_tenants(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  device_name text,
  os_platform text,
  browser_info text,
  ip_address text,
  is_authorized boolean NOT NULL DEFAULT true,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_clinic_device UNIQUE (clinic_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS clinic_devices_clinic_idx ON clinic_devices (clinic_id);
CREATE INDEX IF NOT EXISTS clinic_devices_fingerprint_idx ON clinic_devices (device_fingerprint);

-- Tamilan Payment Collection & Fee Records
CREATE TABLE IF NOT EXISTS tamilan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinic_tenants(id) ON DELETE CASCADE,
  receipt_no text UNIQUE NOT NULL,
  amount numeric(12, 2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'UPI',
  transaction_ref text,
  months_granted integer NOT NULL DEFAULT 1,
  systems_granted integer NOT NULL DEFAULT 1,
  payment_date timestamptz NOT NULL DEFAULT now(),
  recorded_by text DEFAULT 'Tamilan Master Admin',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tamilan_payments_clinic_idx ON tamilan_payments (clinic_id);

-- Insert primary clinic record if empty for backwards compatibility
INSERT INTO clinic_tenants (
  id, clinic_code, clinic_name, doctor_name, mobile, email, city, status, max_systems, plan_name, amount_paid, activated_at, valid_until
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'CLN-TAM-01',
  'ZhanX DentalCare Flagship',
  'Dr. Sarah Jenkins',
  '9876543210',
  'clinic@zhanxstudio.com',
  'Chennai',
  'active',
  3,
  'Master Unlimited Multi-Chair',
  25000.00,
  now(),
  now() + interval '365 days'
) ON CONFLICT (clinic_code) DO NOTHING;
