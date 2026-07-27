-- Adds Meta Commerce Manager catalog configuration to stores.
-- Access token is stored plaintext for MVP; consider at-rest encryption later.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS meta_catalog_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS meta_access_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_currency VARCHAR(3) NOT NULL DEFAULT 'LKR',
  ADD COLUMN IF NOT EXISTS meta_last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_last_sync_error TEXT;
