-- Product sizes reuse the existing product_variants table: one row per size,
-- with `name` holding the size label (S, M, L, …) and stock_quantity its stock.
-- Add a position column so sizes render in the order the seller entered them.

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON product_variants(product_id);
