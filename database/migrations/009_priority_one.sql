-- 009 priority one: clinical safety, patient money, insurance, communication,
-- appointment reminders, clinical photos and treatment consent.
--
-- Every addition is additive: existing tables, workflows and records are kept
-- intact so clinics can update without a data migration step.

/* ------------------------------------------------------------------ */
/* 1. Medication safety: allergy groups + interaction rules            */
/* ------------------------------------------------------------------ */

ALTER TABLE medicines ADD COLUMN IF NOT EXISTS allergen_group text;
CREATE INDEX IF NOT EXISTS medicines_allergen_group_idx ON medicines (allergen_group);

CREATE TABLE IF NOT EXISTS drug_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_a text NOT NULL,
  tag_b text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('major', 'moderate', 'minor')),
  title text NOT NULL,
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_a, tag_b)
);

INSERT INTO drug_interactions (tag_a, tag_b, severity, title, description) VALUES
  ('antacid', 'tetracycline', 'moderate', 'Tetracycline absorption reduced',
   'Antacids and calcium reduce the absorption of tetracyclines. Separate doses by at least 2 hours.'),
  ('antacid', 'fluoroquinolone', 'moderate', 'Fluoroquinolone absorption reduced',
   'Antacids reduce fluoroquinolone absorption. Separate doses by at least 2 hours.'),
  ('anticoagulant', 'nsaid', 'major', 'Increased bleeding risk',
   'NSAIDs with anticoagulants or antiplatelets increase the risk of gastrointestinal bleeding. Prefer paracetamol or consult the prescribing physician.'),
  ('anticoagulant', 'nitroimidazole', 'major', 'Increased INR / bleeding risk',
   'Metronidazole inhibits warfarin metabolism and can raise the INR. Monitor INR or choose an alternative antibiotic.'),
  ('benzodiazepine', 'opioid', 'major', 'Respiratory depression risk',
   'Opioids combined with benzodiazepines can cause profound sedation and respiratory depression. Avoid the combination where possible.'),
  ('cephalosporin', 'penicillin', 'moderate', 'Possible beta-lactam cross-reactivity',
   'Patients with penicillin allergy may react to cephalosporins. Confirm the nature of the allergy before prescribing.'),
  ('macrolide', 'statin', 'moderate', 'Statin toxicity risk',
   'Macrolides can raise statin levels and increase the risk of myopathy. Consider holding the statin during the antibiotic course.'),
  ('nsaid', 'nsaid', 'moderate', 'Duplicate NSAID therapy',
   'Two NSAIDs together increase gastrointestinal and renal risk without added pain relief. Use a single agent.'),
  ('nsaid', 'steroid', 'moderate', 'Gastrointestinal ulcer risk',
   'NSAIDs with corticosteroids increase the risk of gastric ulceration. Consider gastroprotection.'),
  ('paracetamol', 'paracetamol', 'moderate', 'Duplicate paracetamol therapy',
   'Paracetamol appears in multiple combination products. Total daily intake must not exceed 4 g in adults.')
ON CONFLICT (tag_a, tag_b) DO UPDATE
  SET severity = EXCLUDED.severity, title = EXCLUDED.title, description = EXCLUDED.description;

-- Best-effort allergy grouping for the seeded medicine master. Clinics can edit
-- or extend the master afterwards; matching also uses medicine-name keywords.
UPDATE medicines SET allergen_group = 'penicillin'
  WHERE allergen_group IS NULL AND (name ILIKE '%amoxicillin%' OR name ILIKE '%ampicillin%' OR name ILIKE '%penicillin%');
UPDATE medicines SET allergen_group = 'cephalosporin'
  WHERE allergen_group IS NULL AND (name ILIKE '%cephalexin%' OR name ILIKE '%cefixime%' OR name ILIKE '%cefuroxime%');
UPDATE medicines SET allergen_group = 'macrolide'
  WHERE allergen_group IS NULL AND (name ILIKE '%azithromycin%' OR name ILIKE '%erythromycin%' OR name ILIKE '%clarithromycin%');
UPDATE medicines SET allergen_group = 'tetracycline'
  WHERE allergen_group IS NULL AND name ILIKE '%cycline%';
UPDATE medicines SET allergen_group = 'nitroimidazole'
  WHERE allergen_group IS NULL AND (name ILIKE '%metronidazole%' OR name ILIKE '%ornidazole%' OR name ILIKE '%tinidazole%');
UPDATE medicines SET allergen_group = 'lincosamide'
  WHERE allergen_group IS NULL AND name ILIKE '%clindamycin%';
UPDATE medicines SET allergen_group = 'nsaid'
  WHERE allergen_group IS NULL AND (name ILIKE '%ibuprofen%' OR name ILIKE '%diclofenac%' OR name ILIKE '%aceclofenac%' OR name ILIKE '%naproxen%' OR name ILIKE '%ketorolac%' OR name ILIKE '%aspirin%');
UPDATE medicines SET allergen_group = 'paracetamol'
  WHERE allergen_group IS NULL AND (name ILIKE '%paracetamol%' OR name ILIKE '%acetaminophen%');
UPDATE medicines SET allergen_group = 'opioid'
  WHERE allergen_group IS NULL AND (name ILIKE '%tramadol%' OR name ILIKE '%codeine%' OR name ILIKE '%tapentadol%');
UPDATE medicines SET allergen_group = 'steroid'
  WHERE allergen_group IS NULL AND (name ILIKE '%prednisolone%' OR name ILIKE '%dexamethasone%' OR name ILIKE '%betamethasone%' OR name ILIKE '%triamcinolone%');
UPDATE medicines SET allergen_group = 'local_anaesthetic'
  WHERE allergen_group IS NULL AND (name ILIKE '%lignocaine%' OR name ILIKE '%lidocaine%' OR name ILIKE '%articaine%' OR name ILIKE '%bupivacaine%');

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS safety_flags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS safety_override_reason text;

/* ------------------------------------------------------------------ */
/* 2. Patient advance / credit and ledger                              */
/* ------------------------------------------------------------------ */

CREATE SEQUENCE IF NOT EXISTS seq_credit;

CREATE TABLE IF NOT EXISTS patient_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_no text NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  used_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (used_amount >= 0),
  method text NOT NULL,
  transaction_ref text,
  received_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'partially_used', 'used', 'void')),
  idempotency_key text UNIQUE,
  recorded_by uuid NOT NULL REFERENCES users(id),
  voided_at timestamptz,
  voided_by uuid REFERENCES users(id),
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (used_amount <= amount)
);
CREATE INDEX IF NOT EXISTS patient_credits_patient_idx ON patient_credits (patient_id, received_at DESC);
CREATE INDEX IF NOT EXISTS patient_credits_status_idx ON patient_credits (status);

CREATE TABLE IF NOT EXISTS patient_credit_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES patient_credits(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  applied_by uuid NOT NULL REFERENCES users(id),
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_applications_credit_idx ON patient_credit_applications (credit_id);
CREATE INDEX IF NOT EXISTS credit_applications_invoice_idx ON patient_credit_applications (invoice_id);

/* ------------------------------------------------------------------ */
/* 3. Insurance / TPA claims                                           */
/* ------------------------------------------------------------------ */

CREATE SEQUENCE IF NOT EXISTS seq_claim;

CREATE TABLE IF NOT EXISTS insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_no text NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  policy_no text,
  member_id text,
  pre_auth_no text,
  claim_amount numeric(12,2) NOT NULL CHECK (claim_amount > 0),
  approved_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (approved_amount >= 0),
  patient_copay numeric(12,2) NOT NULL DEFAULT 0 CHECK (patient_copay >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'partially_approved', 'rejected', 'settled')),
  submitted_at timestamptz,
  decided_at timestamptz,
  settled_at timestamptz,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (approved_amount <= claim_amount)
);
CREATE INDEX IF NOT EXISTS insurance_claims_patient_idx ON insurance_claims (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS insurance_claims_status_idx ON insurance_claims (status, created_at DESC);

CREATE TRIGGER insurance_claims_updated_at BEFORE UPDATE ON insurance_claims
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

/* ------------------------------------------------------------------ */
/* 4. Invoice write-off / credit note / debit note                     */
/* ------------------------------------------------------------------ */

CREATE SEQUENCE IF NOT EXISTS seq_adjustment;

CREATE TABLE IF NOT EXISTS invoice_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_no text NOT NULL UNIQUE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('write_off', 'credit_note', 'debit_note')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_adjustments_invoice_idx ON invoice_adjustments (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_adjustments_date_idx ON invoice_adjustments (created_at DESC);

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'void', 'written_off'));

CREATE TRIGGER invoice_adjustments_no_delete BEFORE DELETE ON invoice_adjustments
FOR EACH ROW EXECUTE FUNCTION financial_rows_immutable();

/* ------------------------------------------------------------------ */
/* 5. Patient communication log                                        */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS patient_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('phone', 'whatsapp', 'sms', 'email', 'in_person', 'other')),
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  purpose text NOT NULL DEFAULT 'general'
    CHECK (purpose IN ('appointment', 'confirmation', 'reminder', 'follow_up', 'recall', 'payment', 'clinical', 'general')),
  outcome text NOT NULL DEFAULT 'connected'
    CHECK (outcome IN ('connected', 'no_answer', 'busy', 'wrong_number', 'callback_requested', 'message_sent', 'other')),
  notes text,
  follow_up_date date,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patient_communications_patient_idx ON patient_communications (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS patient_communications_date_idx ON patient_communications (created_at DESC);

/* ------------------------------------------------------------------ */
/* 6. Appointment reminders and message templates                      */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email')),
  purpose text NOT NULL DEFAULT 'reminder',
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS message_templates_channel_idx ON message_templates (channel, is_active);

CREATE TRIGGER message_templates_updated_at BEFORE UPDATE ON message_templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  template_id uuid REFERENCES message_templates(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email')),
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'cancelled')),
  error text,
  sent_by uuid NOT NULL REFERENCES users(id),
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointment_reminders_appointment_idx ON appointment_reminders (appointment_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS appointment_reminders_patient_idx ON appointment_reminders (patient_id, sent_at DESC);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

INSERT INTO message_templates (name, channel, purpose, body) VALUES
  ('Appointment reminder', 'whatsapp', 'reminder',
   'Dear {{patient}}, this is a reminder of your dental appointment at {{clinic}} on {{date}} at {{time}} with {{dentist}}. Reply YES to confirm or call {{phone}} to reschedule.'),
  ('Appointment reminder (SMS)', 'sms', 'reminder',
   '{{clinic}}: {{patient}}, your dental appointment is on {{date}} at {{time}} with {{dentist}}. Call {{phone}} to reschedule.'),
  ('Appointment confirmation', 'whatsapp', 'confirmation',
   'Hello {{patient}}, your appointment at {{clinic}} on {{date}} at {{time}} is confirmed. Please arrive 10 minutes early. Call {{phone}} for any change.'),
  ('Follow-up reminder', 'whatsapp', 'follow_up',
   'Hello {{patient}}, it is time for your follow-up visit at {{clinic}}. Please call {{phone}} to book a convenient slot.'),
  ('Recall reminder', 'whatsapp', 'recall',
   'Hello {{patient}}, your routine dental check-up at {{clinic}} is due. Please call {{phone}} to schedule your appointment.'),
  ('Payment reminder', 'sms', 'payment',
   'Dear {{patient}}, a balance is pending on your dental account at {{clinic}}. Please contact {{phone}} to settle it. Thank you.')
ON CONFLICT (name) DO UPDATE SET
  channel = EXCLUDED.channel, purpose = EXCLUDED.purpose, body = EXCLUDED.body, is_active = true;

/* ------------------------------------------------------------------ */
/* 7. Clinical photos (before / after gallery)                         */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS clinical_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL UNIQUE REFERENCES documents(id) ON DELETE RESTRICT,
  tooth_number text,
  photo_type text NOT NULL DEFAULT 'intraoral'
    CHECK (photo_type IN ('before', 'after', 'progress', 'intraoral', 'xray')),
  taken_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinical_photos_patient_idx ON clinical_photos (patient_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS clinical_photos_type_idx ON clinical_photos (patient_id, photo_type);

/* ------------------------------------------------------------------ */
/* 8. Treatment plan phases, consent and signature                     */
/* ------------------------------------------------------------------ */

ALTER TABLE treatment_plan_items ADD COLUMN IF NOT EXISTS phase smallint NOT NULL DEFAULT 1
  CHECK (phase BETWEEN 1 AND 20);

CREATE TABLE IF NOT EXISTS treatment_plan_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES treatment_plans(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  consent_type text NOT NULL DEFAULT 'treatment'
    CHECK (consent_type IN ('treatment', 'photo', 'sedation', 'general')),
  title text NOT NULL,
  body text NOT NULL,
  signature_file text,
  signer_name text NOT NULL,
  witness_name text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_consents_plan_idx ON treatment_plan_consents (plan_id, signed_at DESC);

/* ------------------------------------------------------------------ */
/* 9. Permissions for the new modules                                  */
/* ------------------------------------------------------------------ */

INSERT INTO permissions (code, module, description) VALUES
  ('patients.communications', 'patients', 'View and record patient communication log'),
  ('claims.view', 'billing', 'View insurance and TPA claims'),
  ('claims.manage', 'billing', 'Create and update insurance claims'),
  ('reminders.manage', 'appointments', 'Send appointment reminders and manage message templates')
ON CONFLICT (code) DO UPDATE SET module = EXCLUDED.module, description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('patients.communications', 'claims.view', 'claims.manage', 'reminders.manage')
WHERE r.code IN ('admin', 'receptionist')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('patients.communications', 'claims.view', 'reminders.manage')
WHERE r.code = 'dentist'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('patients.communications')
WHERE r.code = 'assistant'
ON CONFLICT DO NOTHING;
