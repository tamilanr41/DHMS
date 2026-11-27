import { query } from '../database/db.js';

export async function getClinic(clinicId = null) {
  if (clinicId) {
    try {
      const { rows } = await query('SELECT * FROM clinic_settings WHERE clinic_id = $1 LIMIT 1', [clinicId]);
      if (rows[0]) return mapClinic(rows[0]);

      // If not yet seeded in clinic_settings, pull registered details from clinic_tenants
      const { rows: tenantRows } = await query('SELECT * FROM clinic_tenants WHERE id = $1 LIMIT 1', [clinicId]);
      if (tenantRows[0]) {
        const t = tenantRows[0];
        return {
          id: 1,
          clinicId: t.id,
          clinicName: t.clinic_name || 'ZhanX DentalCare',
          logoPath: null,
          address: t.address || '',
          phone: t.mobile || t.phone || '',
          email: t.email || '',
          website: '',
          workingHours: {
            monday: { open: '09:00', close: '20:00', closed: false },
            tuesday: { open: '09:00', close: '20:00', closed: false },
            wednesday: { open: '09:00', close: '20:00', closed: false },
            thursday: { open: '09:00', close: '20:00', closed: false },
            friday: { open: '09:00', close: '20:00', closed: false },
            saturday: { open: '09:00', close: '18:00', closed: false },
            sunday: { open: '09:00', close: '13:00', closed: true }
          },
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          receiptFooter: 'Thank you for choosing our clinic.',
          prescriptionFooter: 'Take medications as directed. Keep out of reach of children.',
          dentistName: t.dentist_name || t.contact_person || '',
          dentistQualification: 'BDS, MDS',
          dentistRegistrationNo: '',
          dentistContact: t.mobile || '',
          dentistSignaturePath: null,
          appointmentSlotMinutes: 30,
          invoicePrefix: 'INV',
          patientPrefix: 'P',
          prescriptionPrefix: 'RX',
          sessionTimeoutMinutes: 60,
          labModuleEnabled: true,
          taxEnabled: false,
          taxPercent: 0,
          defaultPaymentMethods: ['Cash', 'UPI / GPay / PhonePe', 'Credit / Debit Card', 'Bank Transfer'],
          recallMonths: 6,
          toothNumbering: 'fdi',
          periodontalChartingEnabled: true,
          labWorkTypes: ['Crown & Bridge', 'Complete Denture', 'Removable Partial Denture', 'Orthodontic Appliance', 'Custom Tray / Night Guard'],
          backupPreferences: {},
          updatedAt: t.updated_at
        };
      }
    } catch (e) {
      // Fallback below
    }
  }

  const { rows } = await query('SELECT * FROM clinic_settings ORDER BY id ASC LIMIT 1');
  if (rows[0]) return mapClinic(rows[0]);
  return {
    id: 1,
    clinicName: 'ZhanX DentalCare',
    address: '',
    phone: '',
    email: '',
    website: '',
    dentistName: '',
    dentistQualification: '',
    dentistRegistrationNo: '',
    dentistContact: '',
    currency: 'INR',
    receiptFooter: 'Thank you for choosing our clinic.',
    prescriptionFooter: 'Take medications as directed. Keep out of reach of children.'
  };
}

export function mapClinic(r) {
  if (!r) return null;
  return {
    id: r.id,
    clinicId: r.clinic_id || null,
    clinicName: r.clinic_name,
    logoPath: r.logo_path,
    address: r.address,
    phone: r.phone,
    email: r.email,
    website: r.website,
    workingHours: r.working_hours,
    currency: r.currency,
    timezone: r.timezone,
    receiptFooter: r.receipt_footer,
    prescriptionFooter: r.prescription_footer,
    dentistName: r.dentist_name,
    dentistQualification: r.dentist_qualification,
    dentistRegistrationNo: r.dentist_registration_no,
    dentistContact: r.dentist_contact,
    dentistSignaturePath: r.dentist_signature_path,
    appointmentSlotMinutes: r.appointment_slot_minutes,
    invoicePrefix: r.invoice_prefix,
    patientPrefix: r.patient_prefix,
    prescriptionPrefix: r.prescription_prefix,
    sessionTimeoutMinutes: r.session_timeout_minutes,
    labModuleEnabled: r.lab_module_enabled,
    taxEnabled: r.tax_enabled,
    taxPercent: r.tax_percent,
    defaultPaymentMethods: r.default_payment_methods,
    recallMonths: r.recall_months,
    toothNumbering: r.tooth_numbering,
    periodontalChartingEnabled: r.periodontal_charting_enabled,
    labWorkTypes: r.lab_work_types,
    backupPreferences: r.backup_preferences,
    updatedAt: r.updated_at
  };
}
