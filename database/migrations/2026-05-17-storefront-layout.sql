-- Per-store storefront layout knobs: image aspect ratio + product card columns.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS storefront_card_aspect VARCHAR(8) NOT NULL DEFAULT '4:3',
  ADD COLUMN IF NOT EXISTS storefront_products_per_row INTEGER NOT NULL DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_products_per_row_range'
  ) THEN
    ALTER TABLE stores
      ADD CONSTRAINT stores_products_per_row_range
        CHECK (storefront_products_per_row BETWEEN 1 AND 6);
  END IF;
END $$;
