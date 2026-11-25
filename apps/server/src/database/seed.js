import { pool } from './db.js';
import { pathToFileURL } from 'node:url';
import { config } from '../config/env.js';
import { PERMISSIONS, ROLES } from '../config/permissions.js';
import { hashPassword } from '../utils/password.js';
import { runMigrations } from './migrate.js';

const TOOTH_CONDITIONS = [
  ['healthy', 'Healthy', '#16a34a', 'both', true],
  ['caries', 'Caries', '#dc2626', 'both', true],
  ['missing', 'Missing', '#475569', 'both', true],
  ['fractured', 'Fractured', '#f97316', 'both', true],
  ['restored', 'Restored', '#2563eb', 'both', true],
  ['crown', 'Crown', '#7c3aed', 'both', true],
  ['rct', 'Root Canal Treated', '#0891b2', 'permanent', true],
  ['extraction_required', 'Extraction Required', '#b91c1c', 'both', true],
  ['impacted', 'Impacted', '#a16207', 'both', true],
  ['sensitive', 'Sensitive', '#ca8a04', 'both', true],
  ['under_treatment', 'Under Treatment', '#0d9488', 'both', true],
  ['implant', 'Implant', '#0f766e', 'both', true],
  ['bridge', 'Bridge / Pontic', '#6d28d9', 'both', true],
  ['veneer', 'Veneer', '#c026d3', 'both', true],
  ['sealant', 'Sealant', '#0ea5e9', 'both', true],
  ['inlay', 'Inlay / Onlay', '#1d4ed8', 'both', true],
  ['post_core', 'Post & Core', '#7e22ce', 'both', true],
  ['gingivitis', 'Gingivitis', '#f43f5e', 'both', true],
  ['periodontitis', 'Periodontitis', '#be123c', 'both', true],
  ['abscess', 'Abscess', '#dc2626', 'both', true],
  ['attrition', 'Attrition / Wear', '#a8a29e', 'both', true],
  ['erosion', 'Erosion', '#d97706', 'both', true],
  ['abrasion', 'Abrasion', '#b45309', 'both', true],
  ['discoloured', 'Discoloured', '#a855f7', 'both', true],
  ['supernumerary', 'Supernumerary', '#0284c7', 'both', true],
  ['retained_root', 'Retained Root', '#78716c', 'both', true],
  ['trauma', 'Trauma', '#ea580c', 'both', true],
  ['space_maintainer', 'Space Maintainer', '#0891b2', 'primary', true],
  ['other', 'Other', '#64748b', 'both', true]
];

const TREATMENTS = [
  ['CONS', 'Consultation', 'General', 300],
  ['SCALING', 'Scaling & Polishing', 'Preventive', 1200],
  ['FILLING', 'Composite Filling', 'Restorative', 1500],
  ['RCT', 'Root Canal Treatment', 'Endodontics', 6000],
  ['RCT-M', 'Root Canal Treatment (Molar)', 'Endodontics', 7500],
  ['EXTR', 'Extraction', 'Surgery', 1000],
  ['SURG-EXTR', 'Surgical Extraction', 'Surgery', 3000],
  ['CROWN', 'Crown (Zirconia)', 'Prosthodontics', 8000],
  ['CROWN-PFM', 'Crown (PFM)', 'Prosthodontics', 5000],
  ['BRIDGE', 'Bridge (Per Unit)', 'Prosthodontics', 6000],
  ['DENTURE-C', 'Complete Denture', 'Prosthodontics', 15000],
  ['DENTURE-P', 'Partial Denture', 'Prosthodontics', 9000],
  ['IMPLANT', 'Dental Implant', 'Implantology', 25000],
  ['BRACE', 'Orthodontic Braces', 'Orthodontics', 35000],
  ['ALIGNER', 'Clear Aligner (Per Arch)', 'Orthodontics', 45000],
  ['WHITENING', 'Teeth Whitening', 'Cosmetic', 8000],
  ['VENEER', 'Veneer (Per Tooth)', 'Cosmetic', 9000],
  ['PULPOTOMY', 'Pulpotomy (Pediatric)', 'Pedodontics', 2500],
  ['FLUORIDE', 'Fluoride Application', 'Preventive', 800],
  ['SEALANT', 'Pit & Fissure Sealant', 'Preventive', 900],
  ['XRAY', 'Intraoral X-Ray', 'Diagnostics', 300],
  ['OPG', 'OPG X-Ray', 'Diagnostics', 800],
  ['CONS-FU', 'Follow-up Consultation', 'General', 200],
  ['EMERG', 'Emergency Dental Care', 'General', 500],
  ['MOUTH-ULCER', 'Mouth Ulcer Treatment', 'General', 500],
  ['TMJ-THERAPY', 'TMJ Therapy', 'General', 1500],
  ['XRAY-BW', 'Bitewing X-Ray', 'Diagnostics', 300],
  ['CBCT', 'CBCT Scan', 'Diagnostics', 3500],
  ['STUDY-MODEL', 'Study Models', 'Diagnostics', 800],
  ['DEEP-CLEAN', 'Deep Cleaning (Full Mouth)', 'Periodontics', 2500],
  ['QUAD-SCALING', 'Quadrant Scaling & Root Planing', 'Periodontics', 1800],
  ['CURETTAGE', 'Gingival Curettage', 'Periodontics', 1200],
  ['FLAP-SURG', 'Periodontal Flap Surgery', 'Periodontics', 6000],
  ['GINGIVECTOMY', 'Gingivectomy', 'Periodontics', 3500],
  ['FREINECTOMY', 'Frenectomy', 'Surgery', 2500],
  ['BIOPSY', 'Oral Biopsy', 'Surgery', 2000],
  ['SUTURE-REMOVAL', 'Suture Removal', 'Surgery', 300],
  ['SINUS-LIFT', 'Sinus Lift', 'Implantology', 20000],
  ['BONE-GRAFT', 'Bone Graft', 'Implantology', 12000],
  ['IMPLANT-ABUT', 'Implant Abutment & Crown', 'Implantology', 18000],
  ['ALL-ON-4', 'All-on-4 Implants (Per Arch)', 'Implantology', 180000],
  ['INLAY', 'Ceramic Inlay / Onlay', 'Restorative', 7000],
  ['POST-CORE', 'Post & Core Build-up', 'Restorative', 3000],
  ['COMPOSITE-VENEER', 'Composite Veneer', 'Cosmetic', 4000],
  ['WHITENING-HOME', 'Home Whitening Kit', 'Cosmetic', 5000],
  ['SSC', 'Stainless Steel Crown', 'Pedodontics', 2500],
  ['PULPECTOMY', 'Pulpectomy (Pediatric)', 'Pedodontics', 3000],
  ['HABIT-APPL', 'Habit Breaking Appliance', 'Pedodontics', 4500],
  ['SPACE-M', 'Space Maintainer', 'Pedodontics', 3500],
  ['RCT-RETREAT', 'Root Canal Retreatment', 'Endodontics', 8000],
  ['APICOECTOMY', 'Apicoectomy', 'Endodontics', 7000],
  ['HEMISECTION', 'Hemisection', 'Endodontics', 4000],
  ['DENTURE-REPAIR', 'Denture Repair', 'Prosthodontics', 1500],
  ['DENTURE-RELIGN', 'Denture Relining', 'Prosthodontics', 2500],
  ['NIGHT-GUARD', 'Night Guard / Occlusal Splint', 'Prosthodontics', 4500],
  ['SPORTS-GUARD', 'Sports Mouth Guard', 'Prosthodontics', 3500],
  ['IMPRESSION', 'Dental Impression', 'Prosthodontics', 500],
  ['SHADE-MATCH', 'Shade Matching', 'Prosthodontics', 300],
  ['ORTHO-RETAINER', 'Orthodontic Retainer', 'Orthodontics', 3500],
  ['ORTHO-REVIEW', 'Orthodontic Adjustment', 'Orthodontics', 800],
  ['ALIGNER-REFILL', 'Aligner Refinement', 'Orthodontics', 8000],
  ['DESENSITIZE', 'Desensitization Treatment', 'Preventive', 600]
];

// Chair-side medicine master. Values are starting points only: the dentist can
// change every field before signing the prescription.
const MEDICINES = [
  ['Amoxicillin', 'Capsule', '500 mg', '1 capsule', 'oral', '1-1-1', '5 days', 'After food', 'Antibiotic'],
  ['Amoxicillin + Clavulanic acid', 'Tablet', '625 mg', '1 tablet', 'oral', '1-0-1', '5 days', 'After food', 'Antibiotic'],
  ['Metronidazole', 'Tablet', '400 mg', '1 tablet', 'oral', '1-1-1', '5 days', 'After food; avoid alcohol', 'Antibiotic'],
  ['Azithromycin', 'Tablet', '500 mg', '1 tablet', 'oral', '1-0-0', '3 days', 'Before food', 'Antibiotic'],
  ['Clindamycin', 'Capsule', '300 mg', '1 capsule', 'oral', '1-1-1', '5 days', 'With a full glass of water', 'Antibiotic'],
  ['Doxycycline', 'Capsule', '100 mg', '1 capsule', 'oral', '1-0-1', '5 days', 'After food', 'Antibiotic'],
  ['Amoxicillin', 'Suspension', '250 mg/5 ml', '5 ml', 'oral', '1-1-1', '5 days', 'Shake well; after food', 'Antibiotic'],
  ['Ibuprofen', 'Tablet', '400 mg', '1 tablet', 'oral', '1-0-1', '3 days', 'After food', 'Analgesic'],
  ['Ibuprofen + Paracetamol', 'Tablet', '400/325 mg', '1 tablet', 'oral', '1-1-1', '3 days', 'After food', 'Analgesic'],
  ['Paracetamol', 'Tablet', '650 mg', '1 tablet', 'oral', '1-1-1', '3 days', 'Every 8 hours if pain', 'Analgesic'],
  ['Paracetamol', 'Suspension', '125 mg/5 ml', '5 ml', 'oral', '1-1-1', '3 days', 'Shake well; age-appropriate dose', 'Analgesic'],
  ['Diclofenac', 'Tablet', '50 mg', '1 tablet', 'oral', '1-0-1', '3 days', 'After food', 'Analgesic'],
  ['Aceclofenac + Paracetamol', 'Tablet', '100/325 mg', '1 tablet', 'oral', '1-0-1', '3 days', 'After food', 'Analgesic'],
  ['Tramadol', 'Tablet', '50 mg', '1 tablet', 'oral', '1-0-1', '2 days', 'Only for severe pain', 'Analgesic'],
  ['Chlorhexidine', 'Mouthwash', '0.12%', '10 ml', 'rinse', '1-0-1', '7 days', 'Rinse for 30 seconds; do not swallow', 'Mouthwash'],
  ['Chlorhexidine', 'Mouthwash', '0.2%', '10 ml', 'rinse', '1-0-1', '7 days', 'Rinse for 30 seconds; do not swallow', 'Mouthwash'],
  ['Povidone iodine', 'Mouthwash', '1%', '10 ml', 'rinse', '1-1-1', '5 days', 'Dilute as directed; do not swallow', 'Mouthwash'],
  ['Hydrogen peroxide', 'Mouthwash', '1.5%', '10 ml', 'rinse', '1-1-1', '5 days', 'Dilute 1:1 with warm water', 'Mouthwash'],
  ['Sodium fluoride', 'Mouthwash', '0.05%', '10 ml', 'rinse', '0-0-1', '30 days', 'Rinse at bedtime; do not swallow', 'Preventive'],
  ['Benzocaine', 'Gel', '20%', 'Thin layer', 'topical', '3-4 times daily', '5 days', 'Apply to the affected area', 'Topical'],
  ['Lignocaine', 'Gel', '2%', 'Thin layer', 'topical', '3-4 times daily', '5 days', 'Apply to the affected area', 'Topical'],
  ['Choline salicylate', 'Gel', '8.7%', 'Thin layer', 'topical', '3-4 times daily', '5 days', 'Massage gently into the gum', 'Topical'],
  ['Triamcinolone', 'Oral paste', '0.1%', 'Thin layer', 'topical', '2-3 times daily', '7 days', 'Apply after meals; do not rub in', 'Topical'],
  ['Potassium nitrate', 'Toothpaste', '5%', 'Pea-sized', 'topical', '1-0-1', '30 days', 'Brush gently; leave on for 2 minutes', 'Preventive'],
  ['Dexpanthenol', 'Mouth gel', '5%', 'Thin layer', 'topical', '3-4 times daily', '7 days', 'Apply to the affected area', 'Topical']
];

const PRESCRIPTION_TEMPLATES = [
  {
    name: 'Post-extraction care',
    category: 'Surgery',
    instructions: 'Bite on the gauze for 30 minutes. Avoid rinsing, spitting, smoking and hot food for 24 hours. Apply ice packs for 10 minutes at a time. Contact the clinic if bleeding continues or pain worsens.',
    items: [
      { medicineName: 'Ibuprofen', dosage: '400 mg', route: 'oral', frequency: '1-0-1', duration: '3 days', instructions: 'After food' },
      { medicineName: 'Paracetamol', dosage: '650 mg', route: 'oral', frequency: '1-1-1', duration: '3 days', instructions: 'Every 8 hours if pain persists' },
      { medicineName: 'Chlorhexidine', dosage: '0.12%', route: 'rinse', frequency: '1-0-1', duration: '7 days', instructions: 'Start 24 hours after extraction; do not swallow' }
    ]
  },
  {
    name: 'Post-root canal treatment',
    category: 'Endodontics',
    instructions: 'Avoid chewing on the treated tooth until the permanent crown is fitted. Mild tenderness for 2-3 days is expected. Return immediately if swelling or severe pain develops.',
    items: [
      { medicineName: 'Ibuprofen', dosage: '400 mg', route: 'oral', frequency: '1-0-1', duration: '3 days', instructions: 'After food' },
      { medicineName: 'Amoxicillin', dosage: '500 mg', route: 'oral', frequency: '1-1-1', duration: '5 days', instructions: 'Complete the full course' }
    ]
  },
  {
    name: 'Acute dental infection',
    category: 'Infection control',
    instructions: 'Complete the full antibiotic course even if symptoms improve. Return for review if swelling increases, fever develops or swallowing becomes difficult.',
    items: [
      { medicineName: 'Amoxicillin + Clavulanic acid', dosage: '625 mg', route: 'oral', frequency: '1-0-1', duration: '5 days', instructions: 'After food' },
      { medicineName: 'Metronidazole', dosage: '400 mg', route: 'oral', frequency: '1-1-1', duration: '5 days', instructions: 'Avoid alcohol' },
      { medicineName: 'Paracetamol', dosage: '650 mg', route: 'oral', frequency: '1-1-1', duration: '3 days', instructions: 'For pain and fever' }
    ]
  },
  {
    name: 'Scaling & gum care',
    category: 'Periodontics',
    instructions: 'Use a soft toothbrush and interdental brush twice daily. Warm salt-water rinses may be used from the second day. Avoid tobacco and very hot or spicy food for 48 hours.',
    items: [
      { medicineName: 'Chlorhexidine', dosage: '0.12%', route: 'rinse', frequency: '1-0-1', duration: '7 days', instructions: 'Do not swallow' },
      { medicineName: 'Potassium nitrate', dosage: '5%', route: 'topical', frequency: '1-0-1', duration: '30 days', instructions: 'Use as toothpaste if teeth are sensitive' }
    ]
  },
  {
    name: 'Orthodontic soreness',
    category: 'Orthodontics',
    instructions: 'Eat soft food on the day of adjustment. Use orthodontic wax on any sharp bracket. Maintain oral hygiene after every meal and keep the next adjustment appointment.',
    items: [
      { medicineName: 'Paracetamol', dosage: '650 mg', route: 'oral', frequency: '1-1-1', duration: '2 days', instructions: 'Only if needed for soreness' },
      { medicineName: 'Benzocaine', dosage: '20%', route: 'topical', frequency: '3-4 times daily', duration: '5 days', instructions: 'Apply sparingly to sore areas' }
    ]
  },
  {
    name: 'Mouth ulcer & soft tissue',
    category: 'Oral medicine',
    instructions: 'Avoid spicy, acidic and very hot food. Maintain hydration and oral hygiene. Return for review if the ulcer does not heal within two weeks.',
    items: [
      { medicineName: 'Triamcinolone', dosage: '0.1%', route: 'topical', frequency: '2-3 times daily', duration: '7 days', instructions: 'Apply after meals' },
      { medicineName: 'Chlorhexidine', dosage: '0.12%', route: 'rinse', frequency: '1-0-1', duration: '7 days', instructions: 'Do not swallow' }
    ]
  },
  {
    name: 'Pediatric infection',
    category: 'Pedodontics',
    instructions: 'Give the medicine with food using the measuring spoon provided. Complete the full course. Keep the child hydrated and return if swelling or fever persists.',
    items: [
      { medicineName: 'Amoxicillin', dosage: '250 mg/5 ml', route: 'oral', frequency: '1-1-1', duration: '5 days', instructions: 'Shake well; after food' },
      { medicineName: 'Paracetamol', dosage: '125 mg/5 ml', route: 'oral', frequency: '1-1-1', duration: '3 days', instructions: 'Age-appropriate dose if pain or fever' }
    ]
  }
];

async function upsertRolesAndPermissions(client) {
  for (const [code, module, description] of PERMISSIONS) {
    await client.query(
      `INSERT INTO permissions (code, module, description) VALUES ($1,$2,$3)
       ON CONFLICT (code) DO UPDATE SET module = EXCLUDED.module, description = EXCLUDED.description`,
      [code, module, description]
    );
  }

  for (const role of ROLES) {
    const { rows } = await client.query(
      `INSERT INTO roles (code, name, description) VALUES ($1,$2,$3)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
       RETURNING id`,
      [role.code, role.name, role.description]
    );
    const roleId = rows[0].id;
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1, id FROM permissions WHERE code = ANY($2::text[])`,
      [roleId, role.permissions]
    );
  }
}

async function upsertToothConditions(client) {
  for (const [code, label, color, appliesTo, isSystem] of TOOTH_CONDITIONS) {
    await client.query(
      `INSERT INTO tooth_conditions (code, label, color, applies_to, is_system)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, color = EXCLUDED.color, applies_to = EXCLUDED.applies_to`,
      [code, label, color, appliesTo, isSystem]
    );
  }
}

async function upsertTreatmentCatalog(client) {
  for (const [code, name, category, price] of TREATMENTS) {
    await client.query(
      `INSERT INTO treatment_catalog (code, name, category, default_price)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, default_price = EXCLUDED.default_price`,
      [code, name, category, price]
    );
  }
}

async function upsertMedicines(client) {
  for (const [name, form, strength, dosage, route, frequency, duration, instructions, category] of MEDICINES) {
    await client.query(
      `INSERT INTO medicines (name, form, strength, default_dosage, default_route, default_frequency, default_duration, default_instructions, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [name, form, strength, dosage, route, frequency, duration, instructions, category]
    );
  }
}

async function upsertPrescriptionTemplates(client) {
  for (const template of PRESCRIPTION_TEMPLATES) {
    await client.query(
      `INSERT INTO prescription_templates (name, category, instructions, items)
       VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (name) DO NOTHING`,
      [template.name, template.category, template.instructions, JSON.stringify(template.items)]
    );
  }
}

async function ensureAdmin(client) {
  const { rows } = await client.query(`SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE code = 'admin') LIMIT 1`);
  if (rows.length) return null;

  const username = process.env.ADMIN_USERNAME || 'admin';
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD || cryptoRandomPassword();
  const hash = await hashPassword(password);

  await client.query(
    `INSERT INTO users (username, password_hash, full_name, role_id, must_change_password)
     VALUES ($1,$2,$3,(SELECT id FROM roles WHERE code='admin'),$4)`,
    [username, hash, 'Clinic Administrator', generated]
  );
  return { username, password, generated };
}

function cryptoRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function seedReferenceData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await upsertRolesAndPermissions(client);
    await upsertToothConditions(client);
    await upsertTreatmentCatalog(client);
    await upsertMedicines(client);
    await upsertPrescriptionTemplates(client);
    await client.query(
      `INSERT INTO suppliers (name, phone) SELECT 'Default Supplier', NULL
       WHERE NOT EXISTS (SELECT 1 FROM suppliers)`
    );
    await client.query(
      `INSERT INTO dental_laboratories (name) SELECT 'Default Dental Lab'
       WHERE NOT EXISTS (SELECT 1 FROM dental_laboratories)`
    );
    const admin = await ensureAdmin(client);
    await client.query('COMMIT');
    return admin;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedDemoData() {
  const bcryptHash = await hashPassword('Demo@12345');
  const { rows: roleRows } = await pool.query('SELECT id, code FROM roles');
  const roleId = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const users = [
      ['dr.arjun', 'Dr. Arjun Mehta', 'dentist'],
      ['priya.front', 'Priya Sharma', 'receptionist'],
      ['kavya.assist', 'Kavya Nair', 'assistant']
    ];
    for (const [username, fullName, role] of users) {
      await client.query(
        `INSERT INTO users (username, password_hash, full_name, role_id)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [username, bcryptHash, fullName, roleId[role]]
      );
    }

    const { rows: existing } = await client.query('SELECT count(*)::int AS c FROM patients');
    if (existing[0].c === 0) {
      const names = [
        ['Rahul Verma', 'male', '1988-04-12', '9845012345'],
        ['Sneha Iyer', 'female', '1995-11-02', '9845023456'],
        ['Mohammed Ashiq', 'male', '1979-06-25', '9845034567'],
        ['Lakshmi Menon', 'female', '2016-02-18', '9845045678'],
        ['Vikram Reddy', 'male', '1992-09-30', '9845056789']
      ];
      for (const [name, gender, dob, mobile] of names) {
        const { rows: pid } = await client.query(
          `INSERT INTO patients (patient_no, full_name, gender, dob, mobile)
           VALUES ('P' || lpad(nextval('seq_patient')::text, 6, '0'), $1,$2,$3,$4) RETURNING id`,
          [name, gender, dob, mobile]
        );
        await client.query(
          `INSERT INTO patient_medical_history (patient_id, conditions, allergies, consent_confirmed, consent_confirmed_by, consent_confirmed_at, recorded_by)
           VALUES ($1, 'None reported', 'None known', true, (SELECT id FROM users WHERE role_id=$2 LIMIT 1), now(), (SELECT id FROM users WHERE role_id=$2 LIMIT 1))`,
          [pid[0].id, roleId.dentist]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function runSeed({ demo = false } = {}) {
  await runMigrations({ silent: true });
  const admin = await seedReferenceData();
  if (demo) await seedDemoData();
  return admin;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const demo = process.argv.includes('--demo');
  runSeed({ demo })
    .then((admin) => {
      if (admin) {
        console.log(`[seed] administrator created: ${admin.username} / ${admin.password}`);
        if (admin.generated) console.log('[seed] password is generated - change it on first login');
      } else {
        console.log('[seed] administrator already exists');
      }
      if (demo) console.log('[seed] demo users (password Demo@12345): dr.arjun, priya.front, kavya.assist');
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
