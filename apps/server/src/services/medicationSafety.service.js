import { query } from '../database/db.js';

/**
 * Medication safety checks.
 *
 * Two independent checks run on every prescription:
 *   1. Allergy match against the patient's current medical history.
 *   2. Drug-drug interaction match against medicines already in use, either
 *      recorded in the medical history or prescribed in the last 60 days.
 *
 * The checks are advisory but deliberately conservative: a `major` flag blocks
 * prescription creation unless the prescriber records an override reason.
 */

const SEVERITY_RANK = { major: 3, moderate: 2, minor: 1 };

// Keyword → interaction tag. The medicine master can override this with
// medicines.allergen_group, which is preferred when present.
const TAG_KEYWORDS = [
  ['penicillin', ['penicillin', 'amoxicillin', 'ampicillin', 'cloxacillin', 'augmentin', 'co-amoxiclav']],
  ['cephalosporin', ['cephalexin', 'cefixime', 'cefuroxime', 'ceftriaxone', 'cefadroxil', 'cephalosporin']],
  ['macrolide', ['azithromycin', 'erythromycin', 'clarithromycin', 'macrolide']],
  ['tetracycline', ['tetracycline', 'doxycycline', 'minocycline', 'cycline']],
  ['nitroimidazole', ['metronidazole', 'ornidazole', 'tinidazole', 'nitroimidazole']],
  ['lincosamide', ['clindamycin', 'lincomycin', 'lincosamide']],
  ['fluoroquinolone', ['ciprofloxacin', 'levofloxacin', 'ofloxacin', 'moxifloxacin', 'fluoroquinolone']],
  ['nsaid', ['ibuprofen', 'diclofenac', 'aceclofenac', 'naproxen', 'ketorolac', 'mefenamic', 'nimesulide', 'etoricoxib', 'aspirin', 'nsaid']],
  ['paracetamol', ['paracetamol', 'acetaminophen', 'dolo', 'crocin', 'calpol']],
  ['opioid', ['tramadol', 'codeine', 'tapentadol', 'morphine', 'fentanyl', 'opioid']],
  ['steroid', ['prednisolone', 'dexamethasone', 'betamethasone', 'triamcinolone', 'methylprednisolone', 'corticosteroid', 'steroid']],
  ['anticoagulant', ['warfarin', 'heparin', 'enoxaparin', 'rivaroxaban', 'apixaban', 'clopidogrel', 'anticoagulant', 'antiplatelet']],
  ['antacid', ['antacid', 'omeprazole', 'pantoprazole', 'ranitidine', 'famotidine', 'esomeprazole', 'aluminium', 'magnesium hydroxide']],
  ['statin', ['atorvastatin', 'rosuvastatin', 'simvastatin', 'statin']],
  ['benzodiazepine', ['alprazolam', 'diazepam', 'clonazepam', 'lorazepam', 'midazolam', 'benzodiazepine']],
  ['local_anaesthetic', ['lignocaine', 'lidocaine', 'articaine', 'bupivacaine', 'mepivacaine', 'prilocaine']]
];

const ALLERGY_ALIASES = {
  penicillin: ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'cloxacillin', 'co-amoxiclav', 'beta lactam', 'beta-lactam'],
  cephalosporin: ['cephalosporin', 'cephalexin', 'cefixime', 'cefuroxime'],
  macrolide: ['macrolide', 'azithromycin', 'erythromycin', 'clarithromycin'],
  tetracycline: ['tetracycline', 'doxycycline', 'minocycline'],
  nitroimidazole: ['metronidazole', 'ornidazole', 'tinidazole', 'nitroimidazole'],
  lincosamide: ['clindamycin', 'lincosamide'],
  fluoroquinolone: ['ciprofloxacin', 'levofloxacin', 'ofloxacin', 'fluoroquinolone'],
  nsaid: ['nsaid', 'ibuprofen', 'diclofenac', 'aceclofenac', 'naproxen', 'ketorolac', 'aspirin', 'mefenamic', 'nimesulide'],
  paracetamol: ['paracetamol', 'acetaminophen'],
  opioid: ['opioid', 'codeine', 'tramadol', 'morphine'],
  steroid: ['steroid', 'prednisolone', 'dexamethasone', 'corticosteroid'],
  local_anaesthetic: ['lignocaine', 'lidocaine', 'articaine', 'bupivacaine', 'local anaesthetic', 'local anesthetic', 'xylocaine'],
  sulfa: ['sulfa', 'sulphonamide', 'sulfonamide', 'cotrimoxazole'],
  latex: ['latex']
};

function normalize(value) {
  return String(value || '').toLowerCase();
}

function tagsForMedicine(name, allergenGroup) {
  const tags = new Set();
  if (allergenGroup) tags.add(normalize(allergenGroup));
  const lower = normalize(name);
  for (const [tag, keywords] of TAG_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) tags.add(tag);
  }
  return tags;
}

function allergyTokens(text) {
  return normalize(text)
    .split(/[,;\n/]+|\band\b/)
    .map((t) => t.replace(/\(.*?\)/g, '').trim())
    .filter((t) => t.length > 1 && !['none', 'nil', 'no', 'nka', 'not known', 'no known allergies'].includes(t));
}

function allergyFlags({ allergies, medicineName, tags, allergenGroup }) {
  const flags = [];
  const tokens = allergyTokens(allergies);
  if (!tokens.length) return flags;
  const lowerName = normalize(medicineName);
  const lowerGroup = normalize(allergenGroup);

  const direct = tokens.find((t) => lowerName.includes(t) || (lowerGroup && lowerGroup.includes(t)));
  if (direct) {
    flags.push({
      type: 'allergy',
      severity: 'major',
      title: 'Recorded allergy',
      detail: `Patient has a recorded allergy to "${direct}". ${medicineName} should be avoided.`,
      medicineName,
      withMedicine: null
    });
    return flags;
  }

  for (const tag of tags) {
    const aliases = ALLERGY_ALIASES[tag] || [tag];
    const match = tokens.find((t) => aliases.some((a) => t.includes(a) || a.includes(t)));
    if (match) {
      flags.push({
        type: 'allergy',
        severity: 'major',
        title: 'Possible cross-reactivity',
        detail: `Recorded allergy "${match}" may cross-react with ${medicineName}.`,
        medicineName,
        withMedicine: null
      });
      break;
    }
  }
  return flags;
}

function dedupe(flags) {
  const seen = new Set();
  return flags.filter((f) => {
    const key = [f.type, f.medicineName, f.withMedicine, f.title].map(normalize).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function findInteractions(pairs) {
  if (!pairs.length) return [];
  const { rows } = await query('SELECT * FROM drug_interactions WHERE is_active');
  const found = [];
  for (const pair of pairs) {
    for (const rule of rows) {
      const a = normalize(rule.tag_a);
      const b = normalize(rule.tag_b);
      const matches =
        (pair.a === a && pair.b === b) ||
        (pair.a === b && pair.b === a);
      if (matches) found.push({ rule, pair });
    }
  }
  return found;
}

export async function checkMedicationSafety({ patientId, items }) {
  const names = [...new Set(items.map((i) => String(i.medicineName || '').trim()).filter(Boolean))];
  if (!names.length) return { flags: [], hasMajor: false };

  const [historyRes, medicinesRes, recentRes] = await Promise.all([
    query(
      `SELECT allergies, medications FROM patient_medical_history
       WHERE patient_id = $1 AND is_current ORDER BY created_at DESC LIMIT 1`,
      [patientId]
    ),
    query('SELECT name, allergen_group FROM medicines WHERE is_active'),
    query(
      `SELECT DISTINCT pi.medicine_name
       FROM prescription_items pi
       JOIN prescriptions p ON p.id = pi.prescription_id
       WHERE p.patient_id = $1 AND p.prescription_date >= CURRENT_DATE - 60`,
      [patientId]
    )
  ]);

  const history = historyRes.rows[0] || {};
  const master = new Map();
  for (const m of medicinesRes.rows) {
    master.set(normalize(m.name), m.allergen_group);
  }

  const itemTags = items.map((item) => {
    const group = master.get(normalize(item.medicineName)) || null;
    return { name: item.medicineName, group, tags: tagsForMedicine(item.medicineName, group) };
  });

  const flags = [];

  // 1. Allergy checks
  for (const item of itemTags) {
    flags.push(
      ...allergyFlags({
        allergies: history.allergies,
        medicineName: item.name,
        tags: item.tags,
        allergenGroup: item.group
      })
    );
  }

  // 2. Interaction checks against medicines already in use
  const historyMedicines = String(history.medications || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const priorMedicines = [...new Set([...historyMedicines, ...recentRes.rows.map((r) => r.medicine_name)])];

  const existingTags = [];
  for (const name of priorMedicines) {
    const group = master.get(normalize(name)) || null;
    for (const tag of tagsForMedicine(name, group)) existingTags.push({ tag, name });
  }

  const pairs = [];
  for (const item of itemTags) {
    for (const tag of item.tags) {
      for (const existing of existingTags) {
        if (tag === existing.tag) continue; // duplicates handled below
        pairs.push({ a: tag, b: existing.tag, itemName: item.name, withName: existing.name });
      }
    }
  }

  // Duplicate therapy inside this prescription (two NSAIDs, two paracetamols, …)
  for (let i = 0; i < itemTags.length; i++) {
    for (let j = i + 1; j < itemTags.length; j++) {
      for (const tag of itemTags[i].tags) {
        if (itemTags[j].tags.has(tag)) {
          pairs.push({ a: tag, b: tag, itemName: itemTags[i].name, withName: itemTags[j].name });
        }
      }
    }
  }

  const interactions = await findInteractions(pairs);
  for (const { rule, pair } of interactions) {
    flags.push({
      type: 'interaction',
      severity: rule.severity,
      title: rule.title,
      detail: `${rule.description} (${pair.itemName} with ${pair.withName})`,
      medicineName: pair.itemName,
      withMedicine: pair.withName
    });
  }

  const finalFlags = dedupe(flags).sort(
    (a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
  );

  return {
    flags: finalFlags,
    hasMajor: finalFlags.some((f) => f.severity === 'major')
  };
}

export const MEDICATION_SAFETY_SEVERITIES = Object.keys(SEVERITY_RANK);
