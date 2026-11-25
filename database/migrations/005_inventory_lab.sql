-- 005 inventory, suppliers, dental laboratory
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code text UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Consumables',
  brand text,
  unit text NOT NULL DEFAULT 'pcs',
  batch_number text,
  quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  purchase_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  expiry_date date,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  min_stock numeric(12,3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_items_name_idx ON inventory_items (lower(name));
CREATE INDEX inventory_items_expiry_idx ON inventory_items (expiry_date);

CREATE TRIGGER inventory_items_updated_at BEFORE UPDATE ON inventory_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('purchase','consumption','adjustment')),
  quantity_change numeric(12,3) NOT NULL CHECK (quantity_change <> 0),
  balance_after numeric(12,3) NOT NULL CHECK (balance_after >= 0),
  unit_cost numeric(12,2),
  reference text,
  notes text,
  performed_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_item_idx ON stock_movements (item_id, created_at DESC);

CREATE TABLE dental_laboratories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dental_lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  treatment_plan_item_id uuid REFERENCES treatment_plan_items(id) ON DELETE SET NULL,
  tooth_number text,
  laboratory_id uuid NOT NULL REFERENCES dental_laboratories(id) ON DELETE RESTRICT,
  work_type text NOT NULL,
  sent_date date,
  expected_date date,
  delivered_date date,
  charge numeric(12,2) NOT NULL DEFAULT 0 CHECK (charge >= 0),
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','sent_to_lab','in_progress','received','fitted','cancelled')),
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dental_lab_orders_patient_idx ON dental_lab_orders (patient_id, created_at DESC);
CREATE INDEX dental_lab_orders_status_idx ON dental_lab_orders (status);

CREATE TRIGGER dental_lab_orders_updated_at BEFORE UPDATE ON dental_lab_orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
