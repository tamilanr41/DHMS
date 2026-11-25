-- 003 clinical: appointments, consultations, dental chart, treatment plans, prescriptions
-- btree_gist lets us express "no two active bookings overlap for one dentist" as a DB constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_no text NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  dentist_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  appointment_type text NOT NULL DEFAULT 'consultation',
  reason text,
  booking_source text NOT NULL DEFAULT 'reception',
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','confirmed','checked_in','waiting','in_consultation','completed','cancelled','no_show')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  CHECK (end_time > start_time)
);
CREATE INDEX appointments_date_idx ON appointments (appointment_date, start_time);
CREATE INDEX appointments_dentist_idx ON appointments (dentist_id, appointment_date);
CREATE INDEX appointments_patient_idx ON appointments (patient_id, appointment_date DESC);
CREATE INDEX appointments_status_idx ON appointments (status, appointment_date);
-- hard guard against overlapping active bookings for the same dentist
ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    dentist_id WITH =,
    appointment_date WITH =,
    tsrange('2000-01-01'::timestamp + start_time, '2000-01-01'::timestamp + end_time) WITH &&
  ) WHERE (status NOT IN ('cancelled','no_show','completed'));

CREATE TABLE appointment_status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointment_status_history_idx ON appointment_status_history (appointment_id, changed_at);

CREATE TABLE consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_no text NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  dentist_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  visit_at timestamptz NOT NULL DEFAULT now(),
  chief_complaint text,
  examination_findings text,
  diagnosis text,
  clinical_notes text,
  recommendations text,
  follow_up_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed','amended')),
  completed_at timestamptz,
  completed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'completed' OR (diagnosis IS NOT NULL AND length(btrim(diagnosis)) > 0))
);
CREATE INDEX consultations_patient_idx ON consultations (patient_id, visit_at DESC);
CREATE INDEX consultations_dentist_idx ON consultations (dentist_id, visit_at DESC);

CREATE TRIGGER consultations_updated_at BEFORE UPDATE ON consultations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE consultation_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE RESTRICT,
  note_type text NOT NULL DEFAULT 'note' CHECK (note_type IN ('note','amendment')),
  content text NOT NULL,
  author_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consultation_notes_idx ON consultation_notes (consultation_id, created_at);

CREATE TABLE tooth_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  applies_to text NOT NULL DEFAULT 'both' CHECK (applies_to IN ('both','permanent','primary')),
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE treatment_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  description text,
  default_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (default_price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX treatment_catalog_name_idx ON treatment_catalog (lower(name));

CREATE TRIGGER treatment_catalog_updated_at BEFORE UPDATE ON treatment_catalog
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_no text NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  consultation_id uuid REFERENCES consultations(id) ON DELETE SET NULL,
  dentist_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','accepted','partially_completed','completed','cancelled')),
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX treatment_plans_patient_idx ON treatment_plans (patient_id, created_at DESC);

CREATE TRIGGER treatment_plans_updated_at BEFORE UPDATE ON treatment_plans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE treatment_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  tooth_number text,
  treatment_id uuid REFERENCES treatment_catalog(id) ON DELETE SET NULL,
  treatment_name text NOT NULL,
  description text,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','accepted','in_progress','completed','cancelled')),
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX treatment_plan_items_plan_idx ON treatment_plan_items (plan_id);

CREATE TRIGGER treatment_plan_items_updated_at BEFORE UPDATE ON treatment_plan_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE dental_chart_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  tooth_number text NOT NULL,
  dentition text NOT NULL DEFAULT 'permanent' CHECK (dentition IN ('permanent','primary')),
  condition_code text NOT NULL REFERENCES tooth_conditions(code) ON DELETE RESTRICT,
  surface text,
  is_current boolean NOT NULL DEFAULT true,
  consultation_id uuid REFERENCES consultations(id) ON DELETE SET NULL,
  treatment_plan_item_id uuid REFERENCES treatment_plan_items(id) ON DELETE SET NULL,
  notes text,
  recorded_by uuid NOT NULL REFERENCES users(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  superseded_by uuid REFERENCES users(id)
);
CREATE INDEX dental_chart_patient_idx ON dental_chart_records (patient_id, tooth_number);
CREATE INDEX dental_chart_current_idx ON dental_chart_records (patient_id) WHERE is_current;

CREATE TABLE prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_no text NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  dentist_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  consultation_id uuid REFERENCES consultations(id) ON DELETE SET NULL,
  prescription_date date NOT NULL DEFAULT CURRENT_DATE,
  allergies_noted text,
  notes text,
  follow_up_date date,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prescriptions_patient_idx ON prescriptions (patient_id, prescription_date DESC);

CREATE TABLE prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_name text NOT NULL,
  dosage text,
  route text,
  frequency text,
  duration text,
  instructions text,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX prescription_items_prescription_idx ON prescription_items (prescription_id);
