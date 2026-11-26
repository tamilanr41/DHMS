-- 014 document file data persistence
-- Store clinical photos, x-rays and document binary data (base64 data URI) directly in PostgreSQL
-- so photos persist across cloud server restarts, redeployments and multi-machine setups.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS file_data text;
