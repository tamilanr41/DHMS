import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../database/db.js';
import { validate, round2 } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();
router.use(authenticate);

const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(150),
  contactPerson: z.string().trim().max(150).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(150).nullable().optional().or(z.literal('')),
  address: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional()
});

const suppliers = Router();
suppliers.use(authenticate);

suppliers.get('/', requirePermission('inventory.view'), asyncHandler(async (req, res) => {
  const clinicId = req.user?.clinicId || null;
  const { rows } = await query(
    'SELECT * FROM suppliers WHERE ($1::uuid IS NULL OR clinic_id = $1) ORDER BY is_active DESC, name',
    [clinicId]
  );
  res.json({ data: rows.map((s) => ({ id: s.id, name: s.name, contactPerson: s.contact_person, phone: s.phone, email: s.email, address: s.address, isActive: s.is_active })) });
}));

suppliers.post('/', requirePermission('inventory.manage'), asyncHandler(async (req, res) => {
  const body = validate(supplierSchema, req.body);
  const clinicId = req.user?.clinicId || null;
  const { rows } = await query(
    `INSERT INTO suppliers (name, contact_person, phone, email, address, clinic_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [body.name, body.contactPerson || null, body.phone || null, body.email || null, body.address || null, clinicId]
  );
  await logAudit(null, req, { action: 'supplier.created', entityType: 'supplier', entityId: rows[0].id, details: body });
  res.status(201).json({ data: rows[0] });
}));

suppliers.patch('/:id', requirePermission('inventory.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Supplier');
  const body = validate(supplierSchema.partial(), req.body);
  const clinicWhere = req.user?.clinicId ? ' AND clinic_id = $8' : '';
  const params = [id, body.name ?? null, body.contactPerson ?? null, body.phone ?? null, body.email ?? null, body.address ?? null, body.isActive ?? null];
  if (req.user?.clinicId) params.push(req.user.clinicId);
  const { rows } = await query(
    `UPDATE suppliers SET name = COALESCE($2,name), contact_person = COALESCE($3,contact_person),
       phone = COALESCE($4,phone), email = COALESCE($5,email), address = COALESCE($6,address),
       is_active = COALESCE($7,is_active) WHERE id = $1${clinicWhere} RETURNING *`,
    params
  );
  if (!rows[0]) throw ApiError.notFound('Supplier not found');
  res.json({ data: rows[0] });
}));

const itemSchema = z.object({
  itemCode: z.string().trim().max(50).nullable().optional(),
  name: z.string().trim().min(2, 'Item name is required').max(150),
  category: z.string().trim().min(1).max(60),
  brand: z.string().trim().max(100).nullable().optional(),
  unit: z.string().trim().min(1).max(20),
  batchNumber: z.string().trim().max(60).nullable().optional(),
  purchasePrice: z.coerce.number().min(0),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
  supplierId: z.string().uuid().nullable().optional(),
  minStock: z.coerce.number().min(0).default(0),
  isActive: z.boolean().optional()
});

router.get('/items', requirePermission('inventory.view'), asyncHandler(async (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (req.user?.clinicId) {
    params.push(req.user.clinicId);
    where.push(`i.clinic_id = $${params.length}`);
  }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(i.name ILIKE $${params.length} OR i.category ILIKE $${params.length} OR i.item_code ILIKE $${params.length} OR i.brand ILIKE $${params.length})`);
  }
  if (req.query.lowStock === 'true') where.push('i.quantity <= i.min_stock');
  if (req.query.expiring === 'true') where.push(`i.expiry_date IS NOT NULL AND i.expiry_date <= (CURRENT_DATE + interval '60 days')`);
  if (req.query.includeInactive !== 'true') where.push('i.is_active');
  const { rows } = await query(
    `SELECT i.*, s.name AS supplier_name,
            (i.quantity <= i.min_stock) AS is_low_stock,
            (i.expiry_date IS NOT NULL AND i.expiry_date <= (CURRENT_DATE + interval '60 days')) AS is_expiring
     FROM inventory_items i LEFT JOIN suppliers s ON s.id = i.supplier_id
     WHERE ${where.join(' AND ')}
     ORDER BY i.name`,
    params
  );
  res.json({ data: rows.map(mapItem) });
}));

router.post('/items', requirePermission('inventory.manage'), asyncHandler(async (req, res) => {
  const body = validate(itemSchema, req.body);
  const clinicId = req.user?.clinicId || null;
  const item = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO inventory_items (item_code, name, category, brand, unit, batch_number, purchase_price, expiry_date, supplier_id, min_stock, clinic_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [body.itemCode || null, body.name, body.category, body.brand || null, body.unit, body.batchNumber || null, body.purchasePrice, body.expiryDate || null, body.supplierId || null, body.minStock, clinicId]
    );
    return rows[0];
  });
    return rows[0];
  });
  await logAudit(null, req, { action: 'inventory.item_created', entityType: 'inventory_item', entityId: item.id, details: { name: item.name } });
  res.status(201).json({ data: mapItem(item) });
}));

router.patch('/items/:id', requirePermission('inventory.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Item');
  const body = validate(itemSchema.partial(), req.body);
  const { rows } = await query(
    `UPDATE inventory_items SET
       item_code = COALESCE($2,item_code), name = COALESCE($3,name), category = COALESCE($4,category),
       brand = COALESCE($5,brand), unit = COALESCE($6,unit), batch_number = COALESCE($7,batch_number),
       purchase_price = COALESCE($8,purchase_price), expiry_date = COALESCE($9::date,expiry_date),
       supplier_id = COALESCE($10,supplier_id), min_stock = COALESCE($11,min_stock), is_active = COALESCE($12,is_active)
     WHERE id = $1 RETURNING *`,
    [id, body.itemCode ?? null, body.name ?? null, body.category ?? null, body.brand ?? null, body.unit ?? null,
      body.batchNumber ?? null, body.purchasePrice ?? null, body.expiryDate || null, body.supplierId ?? null, body.minStock ?? null, body.isActive ?? null]
  );
  if (!rows[0]) throw ApiError.notFound('Item not found');
  await logAudit(null, req, { action: 'inventory.item_updated', entityType: 'inventory_item', entityId: id, details: body });
  res.json({ data: mapItem(rows[0]) });
}));

const movementSchema = z.object({
  type: z.enum(['purchase', 'consumption', 'adjustment']),
  quantity: z.coerce.number().refine((v) => v !== 0, 'Quantity cannot be zero'),
  unitCost: z.coerce.number().min(0).optional(),
  reference: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional()
});

router.post('/items/:id/movements', requirePermission('inventory.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Item');
  const body = validate(movementSchema, req.body);

  const movement = await withTransaction(async (client) => {
    const { rows: itemRows } = await client.query('SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE', [id]);
    const item = itemRows[0];
    if (!item) throw ApiError.notFound('Item not found');

    let change;
    if (body.type === 'purchase') change = round2(Math.abs(body.quantity));
    else if (body.type === 'consumption') change = round2(-Math.abs(body.quantity));
    else change = round2(body.quantity);

    const balance = round2(Number(item.quantity) + change);
    if (balance < 0) throw ApiError.unprocessable('Stock cannot go below zero');
    if (body.type === 'adjustment' && !body.notes) throw ApiError.unprocessable('Adjustments require a note explaining the correction');

    await client.query('UPDATE inventory_items SET quantity = $2 WHERE id = $1', [id, balance.toFixed(3)]);
    const { rows } = await client.query(
      `INSERT INTO stock_movements (item_id, movement_type, quantity_change, balance_after, unit_cost, reference, notes, performed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, body.type, change.toFixed(3), balance.toFixed(3), body.unitCost ?? null, body.reference || null, body.notes || null, req.user.id]
    );
    return rows[0];
  });

  await logAudit(null, req, {
    action: 'inventory.stock_moved',
    entityType: 'stock_movement',
    entityId: movement.id,
    details: { itemId: id, type: body.type, change: movement.quantity_change, balance: movement.balance_after }
  });
  res.status(201).json({ data: movement });
}));

router.get('/items/:id/movements', requirePermission('inventory.view'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Item');
  const { rows } = await query(
    `SELECT m.*, u.full_name AS performed_by_name FROM stock_movements m
     LEFT JOIN users u ON u.id = m.performed_by
     WHERE m.item_id = $1 ORDER BY m.created_at DESC LIMIT 200`,
    [id]
  );
  res.json({ data: rows });
}));

router.get('/alerts', requirePermission('inventory.view'), asyncHandler(async (req, res) => {
  const lowStock = await query(
    `SELECT id, name, quantity, min_stock, unit FROM inventory_items
     WHERE is_active AND quantity <= min_stock ORDER BY (quantity - min_stock), name`
  );
  const expiring = await query(
    `SELECT id, name, batch_number, expiry_date, quantity, unit FROM inventory_items
     WHERE is_active AND expiry_date IS NOT NULL AND expiry_date <= (CURRENT_DATE + interval '60 days')
     ORDER BY expiry_date`
  );
  res.json({ data: { lowStock: lowStock.rows, expiring: expiring.rows } });
}));

function mapItem(r) {
  return {
    id: r.id,
    itemCode: r.item_code,
    name: r.name,
    category: r.category,
    brand: r.brand,
    unit: r.unit,
    batchNumber: r.batch_number,
    quantity: r.quantity,
    purchasePrice: r.purchase_price,
    expiryDate: r.expiry_date,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    minStock: r.min_stock,
    isLowStock: r.is_low_stock,
    isExpiring: r.is_expiring,
    isActive: r.is_active,
    updatedAt: r.updated_at
  };
}

router.suppliers = suppliers;
export default router;
