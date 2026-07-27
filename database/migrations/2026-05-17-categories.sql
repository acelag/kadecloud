-- Per-store categories with FK from products. Backfills existing free-text
-- products.category values, then drops the legacy column.

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT categories_store_slug_unique UNIQUE (store_id, slug),
  CONSTRAINT categories_store_name_unique UNIQUE (store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_categories_updated_at'
  ) THEN
    CREATE TRIGGER set_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Backfill: lift distinct (store_id, category) text values into categories,
-- then link products.category_id to the matching row. Wrapped in a guard so
-- it skips cleanly if the legacy column has already been dropped.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'category'
  ) THEN
    INSERT INTO categories (store_id, name, slug)
    SELECT
      store_id,
      trim(category) AS name,
      lower(regexp_replace(trim(category), '[^a-zA-Z0-9]+', '-', 'g')) AS slug
    FROM (
      SELECT DISTINCT store_id, trim(category) AS category
      FROM products
      WHERE category IS NOT NULL AND trim(category) <> ''
    ) AS distinct_categories
    ON CONFLICT (store_id, name) DO NOTHING;

    UPDATE products p
    SET category_id = c.id
    FROM categories c
    WHERE c.store_id = p.store_id
      AND c.name = trim(p.category)
      AND p.category_id IS NULL
      AND p.category IS NOT NULL
      AND trim(p.category) <> '';

    ALTER TABLE products DROP COLUMN IF EXISTS category;
  END IF;
END $$;
