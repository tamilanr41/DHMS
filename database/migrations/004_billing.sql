-- 004 billing: invoices, items, payments, refunds
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  consultation_id uuid REFERENCES consultations(id) ON DELETE SET NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  tax_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (tax_percent >= 0 AND tax_percent <= 100),
  tax_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  amount_paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  outstanding_balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (outstanding_balance >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued','partially_paid','paid','void')),
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  voided_at timestamptz,
  voided_by uuid REFERENCES users(id),
  void_reason text,
  CHECK (discount_total <= subtotal + tax_total)
);
CREATE INDEX invoices_patient_idx ON invoices (patient_id, invoice_date DESC);
CREATE INDEX invoices_status_idx ON invoices (status, invoice_date);
CREATE INDEX invoices_date_idx ON invoices (invoice_date);

CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES treatment_catalog(id) ON DELETE SET NULL,
  description text NOT NULL,
  tooth_number text,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  line_total numeric(12,2) NOT NULL CHECK (line_total >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  CHECK (discount <= quantity * unit_price)
);
CREATE INDEX invoice_items_invoice_idx ON invoice_items (invoice_id);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_no text NOT NULL UNIQUE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL,
  transaction_ref text,
  payment_date timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES users(id),
  notes text,
  idempotency_key text UNIQUE,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','void')),
  voided_at timestamptz,
  voided_by uuid REFERENCES users(id),
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_invoice_idx ON payments (invoice_id);
CREATE INDEX payments_patient_idx ON payments (patient_id, payment_date DESC);
CREATE INDEX payments_date_idx ON payments (payment_date);

CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_no text NOT NULL UNIQUE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  payment_id uuid REFERENCES payments(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL,
  reason text NOT NULL,
  refunded_by uuid NOT NULL REFERENCES users(id),
  refunded_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refunds_invoice_idx ON refunds (invoice_id);
CREATE INDEX refunds_date_idx ON refunds (refunded_at);

CREATE OR REPLACE FUNCTION financial_rows_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Financial records are append-only; use void/refund workflows';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION invoices_delete_draft_only() RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Finalized invoices cannot be deleted; use the void workflow';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_no_delete BEFORE DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION invoices_delete_draft_only();
CREATE TRIGGER payments_no_delete BEFORE DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION financial_rows_immutable();
CREATE TRIGGER refunds_no_delete BEFORE DELETE ON refunds
FOR EACH ROW EXECUTE FUNCTION financial_rows_immutable();
CREATE TRIGGER consultations_no_delete BEFORE DELETE ON consultations
FOR EACH ROW EXECUTE FUNCTION financial_rows_immutable();
