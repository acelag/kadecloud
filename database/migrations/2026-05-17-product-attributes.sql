-- Flexible per-product attributes: ordered list of {label, value} pairs.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '[]'::jsonb;
