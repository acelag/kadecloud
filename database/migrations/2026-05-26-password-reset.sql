-- Password reset tokens for both store admins (users) and shoppers.
-- The raw token is sent in the email; only the SHA-256 hash is stored so
-- a database breach can't be used to immediately take over accounts.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_token  TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;

ALTER TABLE shoppers
  ADD COLUMN IF NOT EXISTS password_reset_token  TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;

-- Partial index so the lookup (token hash → row) is fast even on large tables.
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token
  ON users (password_reset_token)
  WHERE password_reset_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shoppers_password_reset_token
  ON shoppers (password_reset_token)
  WHERE password_reset_token IS NOT NULL;
