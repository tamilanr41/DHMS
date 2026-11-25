-- 010_reminder_and_backup_polish.sql
-- Allow 'opened' and 'prepared' statuses in appointment_reminders
ALTER TABLE appointment_reminders DROP CONSTRAINT IF EXISTS appointment_reminders_status_check;
ALTER TABLE appointment_reminders ADD CONSTRAINT appointment_reminders_status_check
  CHECK (status IN ('sent', 'opened', 'prepared', 'failed', 'cancelled'));

-- Allow 'message_opened' in patient_communications
ALTER TABLE patient_communications DROP CONSTRAINT IF EXISTS patient_communications_outcome_check;
ALTER TABLE patient_communications ADD CONSTRAINT patient_communications_outcome_check
  CHECK (outcome IN ('connected', 'no_answer', 'busy', 'wrong_number', 'callback_requested', 'message_sent', 'message_opened', 'other'));
