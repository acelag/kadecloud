-- Email verification for both store admins (users) and shoppers.
-- Google sign-in users are pre-verified (email already confirmed by Google).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified            BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verification_token  TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ;

ALTER TABLE shoppers
  ADD COLUMN IF NOT EXISTS email_verified            BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verification_token  TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ;

-- Shoppers that signed up via Google are already verified.
UPDATE shoppers SET email_verified = TRUE WHERE google_sub IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
  ON users (email_verification_token)
  WHERE email_verification_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shoppers_email_verification_token
  ON shoppers (email_verification_token)
  WHERE email_verification_token IS NOT NULL;
