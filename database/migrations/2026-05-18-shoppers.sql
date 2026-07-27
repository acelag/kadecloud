-- Cross-store shopper accounts: one row per real person.
-- Google login (google_sub) and/or email+password.
-- Per-store `customers` rows can be linked back to a shopper.

CREATE TABLE IF NOT EXISTS shoppers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(140),
  picture_url TEXT,
  google_sub VARCHAR(64),
  password_hash TEXT,
  phone VARCHAR(30),
  address TEXT,
  city VARCHAR(120),
  district VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shoppers_email_lower_unique
  ON shoppers (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS shoppers_google_sub_unique
  ON shoppers (google_sub) WHERE google_sub IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_shoppers_updated_at'
  ) THEN
    CREATE TRIGGER set_shoppers_updated_at
    BEFORE UPDATE ON shoppers
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS shopper_id UUID REFERENCES shoppers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_shopper_id ON customers(shopper_id);
