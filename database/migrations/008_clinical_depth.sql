-- 008 clinical depth: vitals, periodontal charting, medicine master, prescription templates, recall settings
ALTER TABLE consultations ADD COLUMN vitals jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE periodontal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  tooth_number text NOT NULL,
  dentition text NOT NULL DEFAULT 'permanent' CHECK (dentition IN ('permanent','primary')),
  probing_depths jsonb NOT NULL DEFAULT '{}'::jsonb,
  recession jsonb NOT NULL DEFAULT '{}'::jsonb,
  mobility smallint NOT NULL DEFAULT 0 CHECK (mobility BETWEEN 0 AND 3),
  furcation text NOT NULL DEFAULT 'none' CHECK (furcation IN ('none','class_i','class_ii','class_iii')),
  bleeding_on_probing boolean NOT NULL DEFAULT false,
  suppuration boolean NOT NULL DEFAULT false,
  plaque boolean NOT NULL DEFAULT false,
  calculus boolean NOT NULL DEFAULT false,
  notes text,
  is_current boolean NOT NULL DEFAULT true,
  consultation_id uuid REFERENCES consultations(id) ON DELETE SET NULL,
  recorded_by uuid NOT NULL REFERENCES users(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  superseded_by uuid REFERENCES users(id)
);
CREATE INDEX periodontal_patient_idx ON periodontal_records (patient_id, tooth_number);
CREATE INDEX periodontal_current_idx ON periodontal_records (patient_id) WHERE is_current;

CREATE TABLE medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  form text,
  strength text,
  default_dosage text,
  default_route text NOT NULL DEFAULT 'oral',
  default_frequency text,
  default_duration text,
  default_instructions text,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX medicines_name_strength_idx ON medicines (lower(name), lower(coalesce(strength, '')));
CREATE INDEX medicines_name_idx ON medicines (lower(name));

CREATE TRIGGER medicines_updated_at BEFORE UPDATE ON medicines
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE prescription_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text,
  instructions text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prescription_templates_active_idx ON prescription_templates (is_active, category);

CREATE TRIGGER prescription_templates_updated_at BEFORE UPDATE ON prescription_templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Recall and chair-side defaults live with the rest of the clinic configuration.
ALTER TABLE clinic_settings ADD COLUMN recall_months integer NOT NULL DEFAULT 6 CHECK (recall_months BETWEEN 1 AND 60);
ALTER TABLE clinic_settings ADD COLUMN tooth_numbering text NOT NULL DEFAULT 'fdi' CHECK (tooth_numbering IN ('fdi','universal','palmer'));
ALTER TABLE clinic_settings ADD COLUMN periodontal_charting_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE clinic_settings ADD COLUMN lab_work_types jsonb NOT NULL DEFAULT
  '["Zirconia crown","PFM crown","E-max crown","Veneer","Bridge","Complete denture","Partial denture","Denture repair","Denture relining","Implant abutment","Custom abutment","Surgical guide","Clear aligner","Orthodontic retainer","Night guard","Sports mouth guard","Study model","Inlay / Onlay"]'::jsonb;
