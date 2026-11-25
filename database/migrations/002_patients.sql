-- 002 patients
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_no text NOT NULL UNIQUE,
  full_name text NOT NULL,
  dob date,
  gender text CHECK (gender IN ('male','female','other')),
  mobile text NOT NULL,
  email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  referred_by text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id)
);
CREATE INDEX patients_name_lower_idx ON patients (lower(full_name));
CREATE INDEX patients_mobile_idx ON patients (mobile);
CREATE INDEX patients_created_idx ON patients (created_at DESC);

CREATE TRIGGER patients_updated_at BEFORE UPDATE ON patients
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE patient_medical_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  conditions text,
  allergies text,
  medications text,
  surgical_history text,
  dental_history text,
  previous_treatments text,
  clinician_notes text,
  consent_confirmed boolean NOT NULL DEFAULT false,
  consent_confirmed_by uuid REFERENCES users(id),
  consent_confirmed_at timestamptz,
  is_current boolean NOT NULL DEFAULT true,
  recorded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX patient_medical_history_current_idx
  ON patient_medical_history (patient_id) WHERE is_current;
CREATE INDEX patient_medical_history_patient_idx ON patient_medical_history (patient_id, created_at DESC);

CREATE TRIGGER patient_medical_history_updated_at BEFORE UPDATE ON patient_medical_history
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  file_name text NOT NULL,
  stored_name text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  category text NOT NULL DEFAULT 'other',
  notes text,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_patient_idx ON documents (patient_id, created_at DESC);
