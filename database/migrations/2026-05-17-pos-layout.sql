-- Per-store POS tile layout + per-order cash-given amount for change calculation.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS pos_card_aspect VARCHAR(8) NOT NULL DEFAULT '1:1',
  ADD COLUMN IF NOT EXISTS pos_products_per_row INTEGER NOT NULL DEFAULT 4;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_pos_products_per_row_range'
  ) THEN
    ALTER TABLE stores
      ADD CONSTRAINT stores_pos_products_per_row_range
        CHECK (pos_products_per_row BETWEEN 1 AND 8);
  END IF;
END $$;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cash_given NUMERIC(12,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_cash_given_non_negative'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_cash_given_non_negative
        CHECK (cash_given IS NULL OR cash_given >= 0);
  END IF;
END $$;
