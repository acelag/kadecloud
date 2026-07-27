-- Store-wide bank transfer details + per-order payment reference.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS bank_transfer_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(64),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(120),
  ADD COLUMN IF NOT EXISTS bank_transfer_instructions TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(120);
