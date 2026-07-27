-- Storefront display currency: per-store base + platform-wide default + admin settings.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3) NOT NULL DEFAULT 'LKR';

UPDATE stores
SET default_currency = meta_currency
WHERE meta_currency IS NOT NULL
  AND default_currency = 'LKR'
  AND meta_currency <> 'LKR';

CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (key, value)
VALUES ('default_currency', 'LKR')
ON CONFLICT (key) DO NOTHING;
