-- Gallery images per product (separate from products.image_url which remains the cover).

CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_images_position_non_negative CHECK (position >= 0),
  CONSTRAINT product_images_product_position_unique UNIQUE (product_id, position)
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
