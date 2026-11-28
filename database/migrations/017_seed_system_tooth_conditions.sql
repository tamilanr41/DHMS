-- 017_seed_system_tooth_conditions.sql
-- Restore essential system clinical tooth conditions master data

INSERT INTO tooth_conditions (code, label, color, applies_to, is_system, is_active)
VALUES
  ('healthy', 'Healthy', '#16a34a', 'both', true, true),
  ('caries', 'Caries / Decay', '#dc2626', 'both', true, true),
  ('missing', 'Missing', '#475569', 'both', true, true),
  ('fractured', 'Fractured / Broken', '#f97316', 'both', true, true),
  ('restored', 'Restored / Filling', '#2563eb', 'both', true, true),
  ('crown', 'Crown (Cap)', '#7c3aed', 'both', true, true),
  ('rct', 'Root Canal Treated', '#0891b2', 'permanent', true, true),
  ('extraction_required', 'Extraction Required', '#b91c1c', 'both', true, true),
  ('impacted', 'Impacted', '#a16207', 'both', true, true),
  ('sensitive', 'Sensitive', '#ca8a04', 'both', true, true),
  ('under_treatment', 'Under Treatment', '#0d9488', 'both', true, true),
  ('implant', 'Dental Implant', '#0f766e', 'both', true, true),
  ('bridge', 'Bridge / Pontic', '#6d28d9', 'both', true, true),
  ('veneer', 'Aesthetic Veneer', '#c026d3', 'both', true, true),
  ('sealant', 'Pit & Fissure Sealant', '#0ea5e9', 'both', true, true),
  ('inlay', 'Inlay / Onlay', '#1d4ed8', 'both', true, true),
  ('post_core', 'Post & Core', '#7e22ce', 'both', true, true),
  ('gingivitis', 'Gingivitis', '#f43f5e', 'both', true, true),
  ('periodontitis', 'Periodontitis', '#be123c', 'both', true, true),
  ('abscess', 'Periapical Abscess', '#dc2626', 'both', true, true),
  ('attrition', 'Attrition / Wear', '#a8a29e', 'both', true, true),
  ('erosion', 'Erosion', '#d97706', 'both', true, true),
  ('abrasion', 'Abrasion', '#b45309', 'both', true, true),
  ('discoloured', 'Discoloured', '#a855f7', 'both', true, true),
  ('supernumerary', 'Supernumerary', '#0284c7', 'both', true, true),
  ('retained_root', 'Retained Root', '#78716c', 'both', true, true),
  ('trauma', 'Dental Trauma', '#ea580c', 'both', true, true),
  ('space_maintainer', 'Space Maintainer', '#0891b2', 'primary', true, true),
  ('other', 'Other Finding', '#64748b', 'both', true, true)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  applies_to = EXCLUDED.applies_to,
  is_system = EXCLUDED.is_system,
  is_active = EXCLUDED.is_active;
