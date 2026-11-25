-- 011 patient photo data persistence
-- Store profile photo data (base64 data URI) directly in PostgreSQL
-- so photos are preserved in database backups, migrations and multi-machine setups.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS photo_data text;
