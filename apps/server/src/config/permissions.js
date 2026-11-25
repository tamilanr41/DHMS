export const PERMISSIONS = [
  ['dashboard.view', 'dashboard', 'View dashboard'],
  ['patients.view', 'patients', 'View patient list and profiles'],
  ['patients.create', 'patients', 'Register new patients'],
  ['patients.edit', 'patients', 'Edit patient demographics'],
  ['patients.documents', 'patients', 'Upload and view patient documents'],
  ['patients.medical.view', 'patients', 'View medical history'],
  ['patients.medical.edit', 'patients', 'Record medical history'],
  ['patients.communications', 'patients', 'View and record patient communication log'],
  ['appointments.view', 'appointments', 'View appointments and schedules'],
  ['appointments.manage', 'appointments', 'Create, reschedule and cancel appointments'],
  ['reminders.manage', 'appointments', 'Send appointment reminders and manage message templates'],
  ['queue.view', 'queue', 'View waiting queue'],
  ['queue.manage', 'queue', 'Manage waiting queue and check-ins'],
  ['consultations.view', 'consultations', 'View consultations'],
  ['consultations.manage', 'consultations', 'Create and complete consultations'],
  ['consultations.amend', 'consultations', 'Amend finalized clinical records'],
  ['chart.view', 'chart', 'View dental chart'],
  ['chart.edit', 'chart', 'Record dental chart findings'],
  ['plans.view', 'plans', 'View treatment plans'],
  ['plans.manage', 'plans', 'Create and update treatment plans'],
  ['prescriptions.view', 'prescriptions', 'View and print prescriptions'],
  ['prescriptions.manage', 'prescriptions', 'Create prescriptions'],
  ['invoices.view', 'billing', 'View invoices'],
  ['invoices.manage', 'billing', 'Create, finalize and void invoices'],
  ['claims.view', 'billing', 'View insurance and TPA claims'],
  ['claims.manage', 'billing', 'Create and update insurance claims'],
  ['payments.view', 'billing', 'View payments'],
  ['payments.manage', 'billing', 'Collect payments'],
  ['refunds.manage', 'billing', 'Issue refunds and credit notes'],
  ['inventory.view', 'inventory', 'View inventory'],
  ['inventory.manage', 'inventory', 'Manage inventory and stock movements'],
  ['labs.view', 'labs', 'View laboratory orders'],
  ['labs.manage', 'labs', 'Manage laboratory orders'],
  ['reports.view', 'reports', 'View operational and clinical reports'],
  ['reports.financial', 'reports', 'View financial reports'],
  ['users.manage', 'admin', 'Manage users and roles'],
  ['settings.manage', 'admin', 'Manage clinic and application settings'],
  ['backups.manage', 'admin', 'Create and restore backups'],
  ['audit.view', 'admin', 'View audit logs']
];

const ALL = PERMISSIONS.map(([code]) => code);

const DENTIST = [
  'dashboard.view',
  'patients.view', 'patients.edit', 'patients.documents', 'patients.medical.view', 'patients.medical.edit', 'patients.communications',
  'appointments.view', 'appointments.manage', 'queue.view', 'queue.manage',
  'consultations.view', 'consultations.manage', 'consultations.amend',
  'chart.view', 'chart.edit', 'plans.view', 'plans.manage',
  'prescriptions.view', 'prescriptions.manage',
  'invoices.view', 'invoices.manage', 'payments.view',
  'claims.view',
  'inventory.view', 'labs.view', 'labs.manage',
  'reports.view', 'reports.financial',
  'reminders.manage'
];

const RECEPTIONIST = [
  'dashboard.view',
  'patients.view', 'patients.create', 'patients.edit', 'patients.documents', 'patients.communications',
  'appointments.view', 'appointments.manage', 'queue.view', 'queue.manage',
  'invoices.view', 'invoices.manage', 'payments.view', 'payments.manage',
  'claims.view', 'claims.manage',
  'inventory.view', 'labs.view',
  'reports.view',
  'reminders.manage'
];

const ASSISTANT = [
  'dashboard.view',
  'patients.view', 'patients.documents', 'patients.communications',
  'appointments.view', 'queue.view', 'queue.manage',
  'consultations.view', 'chart.view', 'plans.view',
  'inventory.view', 'inventory.manage', 'labs.view', 'labs.manage',
  'reports.view'
];

export const ROLES = [
  { code: 'admin', name: 'Administrator', description: 'Clinic administrator', permissions: ALL },
  { code: 'dentist', name: 'Dentist', description: 'Clinical dentist', permissions: DENTIST },
  { code: 'receptionist', name: 'Receptionist', description: 'Front desk and billing', permissions: RECEPTIONIST },
  { code: 'assistant', name: 'Dental Assistant', description: 'Chairside and support', permissions: ASSISTANT }
];
