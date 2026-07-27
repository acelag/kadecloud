-- Per-store logo display size (small | medium | large). Controls how large the
-- store's logo renders in the storefront header and the admin sidebar.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS logo_size VARCHAR(10) NOT NULL DEFAULT 'medium';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_logo_size_check'
  ) THEN
    ALTER TABLE stores
      ADD CONSTRAINT stores_logo_size_check
        CHECK (logo_size IN ('small', 'medium', 'large'));
  END IF;
END $$;
