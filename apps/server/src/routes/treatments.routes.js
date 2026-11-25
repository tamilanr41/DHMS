import { Router } from 'express';
import { z } from 'zod';
import { query } from '../database/db.js';
import { validate } from '../utils/validate.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticate, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { requireId } from '../middleware/error.js';
import { logAudit } from '../services/audit.service.js';

const router = Router();
router.use(authenticate);

router.get('/', requireAnyPermission('plans.view', 'plans.manage', 'invoices.view', 'settings.manage'), asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (req.query.includeInactive !== 'true') where = 'WHERE is_active';
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where += `${where ? ' AND' : 'WHERE'} (name ILIKE $1 OR category ILIKE $1 OR code ILIKE $1)`;
  }
  const { rows } = await query(
    `SELECT * FROM treatment_catalog ${where} ORDER BY category, name`,
    params
  );
  res.json({ data: rows.map(mapTreatment) });
}));

const treatmentSchema = z.object({
  code: z.string().trim().max(20).nullable().optional(),
  name: z.string().trim().min(2, 'Name is required').max(150),
  category: z.string().trim().min(1).max(60),
  description: z.string().trim().max(1000).nullable().optional(),
  defaultPrice: z.coerce.number().min(0, 'Price cannot be negative'),
  isActive: z.boolean().optional()
});

router.post('/', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const body = validate(treatmentSchema, req.body);
  const { rows } = await query(
    `INSERT INTO treatment_catalog (code, name, category, description, default_price, is_active)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [body.code || null, body.name, body.category, body.description || null, body.defaultPrice, body.isActive ?? true]
  );
  await logAudit(null, req, { action: 'treatment.created', entityType: 'treatment_catalog', entityId: rows[0].id, details: body });
  res.status(201).json({ data: mapTreatment(rows[0]) });
}));

router.patch('/:id', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Treatment');
  const body = validate(treatmentSchema.partial(), req.body);
  const { rows } = await query(
    `UPDATE treatment_catalog SET
       code = COALESCE($2, code), name = COALESCE($3, name), category = COALESCE($4, category),
       description = COALESCE($5, description), default_price = COALESCE($6, default_price),
       is_active = COALESCE($7, is_active)
     WHERE id = $1 RETURNING *`,
    [id, body.code ?? null, body.name ?? null, body.category ?? null, body.description ?? null, body.defaultPrice ?? null, body.isActive ?? null]
  );
  if (!rows[0]) throw ApiError.notFound('Treatment not found');
  await logAudit(null, req, { action: 'treatment.updated', entityType: 'treatment_catalog', entityId: id, details: body });
  res.json({ data: mapTreatment(rows[0]) });
}));

function mapTreatment(r) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    category: r.category,
    description: r.description,
    defaultPrice: r.default_price,
    isActive: r.is_active
  };
}

export default router;
