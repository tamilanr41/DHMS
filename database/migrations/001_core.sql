-- 001 core: roles, permissions, users, clinic settings, sessions, audit, backups
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  module text NOT NULL,
  description text
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id)
);
CREATE UNIQUE INDEX users_username_lower_idx ON users (lower(username));
CREATE INDEX users_role_idx ON users (role_id);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE clinic_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  clinic_name text NOT NULL DEFAULT 'ZhanX DentalCare',
  logo_path text,
  address text,
  phone text,
  email text,
  website text,
  working_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  currency text NOT NULL DEFAULT 'INR',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  receipt_footer text,
  prescription_footer text,
  dentist_name text,
  dentist_qualification text,
  dentist_registration_no text,
  dentist_contact text,
  dentist_signature_path text,
  appointment_slot_minutes integer NOT NULL DEFAULT 30 CHECK (appointment_slot_minutes BETWEEN 5 AND 240),
  invoice_prefix text NOT NULL DEFAULT 'INV',
  patient_prefix text NOT NULL DEFAULT 'P',
  prescription_prefix text NOT NULL DEFAULT 'RX',
  session_timeout_minutes integer NOT NULL DEFAULT 30 CHECK (session_timeout_minutes BETWEEN 5 AND 480),
  lab_module_enabled boolean NOT NULL DEFAULT true,
  tax_enabled boolean NOT NULL DEFAULT false,
  tax_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (tax_percent >= 0 AND tax_percent <= 100),
  default_payment_methods jsonb NOT NULL DEFAULT '["Cash","UPI","Card","Bank Transfer"]'::jsonb,
  backup_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);
INSERT INTO clinic_settings (id) VALUES (1);

CREATE TABLE refresh_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  ip text,
  user_agent text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_sessions_user_idx ON refresh_sessions (user_id);

CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  username text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);

CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();

CREATE TABLE backup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  size_bytes bigint,
  status text NOT NULL CHECK (status IN ('running','success','failed')),
  type text NOT NULL CHECK (type IN ('manual','scheduled','pre_restore')),
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_by uuid REFERENCES users(id)
);

CREATE SEQUENCE seq_patient;
CREATE SEQUENCE seq_appointment;
CREATE SEQUENCE seq_consultation;
CREATE SEQUENCE seq_plan;
CREATE SEQUENCE seq_prescription;
CREATE SEQUENCE seq_invoice;
CREATE SEQUENCE seq_payment;
CREATE SEQUENCE seq_refund;
CREATE SEQUENCE seq_lab_order;
