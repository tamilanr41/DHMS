import { query } from '../database/db.js';

export async function getClinic() {
  const { rows } = await query('SELECT * FROM clinic_settings WHERE id = 1');
  return mapClinic(rows[0]);
}

export function mapClinic(r) {
  if (!r) return null;
  return {
    id: r.id,
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
