-- 007 patient profile enrichment
-- Registration now captures a fuller patient profile: photo, identity proof,
-- extended contact details, emergency contact relation, insurance and consent.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS photo_file text,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS alternate_mobile text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS id_proof_type text,
  ADD COLUMN IF NOT EXISTS id_proof_number text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation text,
  ADD COLUMN IF NOT EXISTS insurance_provider text,
  ADD COLUMN IF NOT EXISTS insurance_policy_no text,
  ADD COLUMN IF NOT EXISTS data_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_consent_at timestamptz;

CREATE INDEX IF NOT EXISTS patients_id_proof_number_idx ON patients (id_proof_number);
