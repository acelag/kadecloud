-- KadeCloud PostgreSQL schema
-- Initial database structure only. Backend integration and migrations will be added later.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM (
  'platform_admin',
  'store_admin',
  'seller'
);

CREATE TYPE order_status AS ENUM (
  'new',
  'pending_confirmation',
  'confirmed',
  'packed',
  'dispatched',
  'out_for_delivery',
  'delivered',
  'returned',
  'rejected',
  'cancelled'
);

CREATE TYPE cod_status AS ENUM (
  'not_verified',
  'phone_confirmed',
  'whatsapp_confirmed',
  'no_answer',
  'suspicious',
  'fake_order'
);

CREATE TYPE delivery_status AS ENUM (
  'not_dispatched',
  'dispatched',
  'in_transit',
  'delivered',
  'failed',
  'returned'
);

CREATE TYPE customer_risk_status AS ENUM (
  'new',
  'trusted',
  'medium_risk',
  'high_risk'
);

CREATE TYPE payment_method AS ENUM (
  'cod',
  'bank_transfer',
  'card'
);

CREATE TYPE inventory_log_type AS ENUM (
  'manual_adjustment',
  'order_confirmed',
  'order_cancelled',
  'return_received'
);

CREATE SEQUENCE kadecloud_order_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'store_admin',
  store_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  category VARCHAR(120),
  description TEXT,
  phone VARCHAR(30),
  whatsapp_phone VARCHAR(30),
  address TEXT,
  city VARCHAR(120),
  district VARCHAR(120),
  logo_url TEXT,
  meta_catalog_id VARCHAR(64),
  meta_access_token TEXT,
  meta_currency VARCHAR(3) NOT NULL DEFAULT 'LKR',
  meta_last_sync_at TIMESTAMPTZ,
  meta_last_sync_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stores_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

ALTER TABLE users
ADD CONSTRAINT users_store_id_fk
FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  sku VARCHAR(120),
  category VARCHAR(120),
  description TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_price NUMERIC(12, 2),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  cod_available BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_price_non_negative CHECK (price >= 0),
  CONSTRAINT products_discount_price_valid CHECK (
    discount_price IS NULL
    OR (discount_price >= 0 AND discount_price <= price)
  ),
  CONSTRAINT products_stock_non_negative CHECK (stock_quantity >= 0),
  CONSTRAINT products_low_stock_non_negative CHECK (low_stock_threshold >= 0),
  CONSTRAINT products_store_slug_unique UNIQUE (store_id, slug),
  CONSTRAINT products_store_sku_unique UNIQUE (store_id, sku)
);

CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  sku VARCHAR(120),
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_price_non_negative CHECK (price >= 0),
  CONSTRAINT product_variants_stock_non_negative CHECK (stock_quantity >= 0),
  CONSTRAINT product_variants_low_stock_non_negative CHECK (low_stock_threshold >= 0),
  CONSTRAINT product_variants_product_sku_unique UNIQUE (product_id, sku)
);

CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_images_position_non_negative CHECK (position >= 0),
  CONSTRAINT product_images_product_position_unique UNIQUE (product_id, position)
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(140) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address TEXT,
  city VARCHAR(120),
  district VARCHAR(120),
  risk_status customer_risk_status NOT NULL DEFAULT 'new',
  total_orders INTEGER NOT NULL DEFAULT 0,
  cancelled_orders INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customers_order_counts_non_negative CHECK (
    total_orders >= 0
    AND cancelled_orders >= 0
    AND cancelled_orders <= total_orders
  ),
  CONSTRAINT customers_store_phone_unique UNIQUE (store_id, phone)
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_number VARCHAR(40) NOT NULL,
  status order_status NOT NULL DEFAULT 'new',
  cod_status cod_status NOT NULL DEFAULT 'not_verified',
  delivery_status delivery_status NOT NULL DEFAULT 'not_dispatched',
  payment_method payment_method NOT NULL DEFAULT 'cod',
  customer_name VARCHAR(140) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_city VARCHAR(120),
  delivery_district VARCHAR(120),
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  seller_notes TEXT,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  stock_reduced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_amounts_non_negative CHECK (
    subtotal >= 0
    AND delivery_fee >= 0
    AND total_amount >= 0
  ),
  CONSTRAINT orders_store_order_number_unique UNIQUE (store_id, order_number)
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_name VARCHAR(180) NOT NULL,
  variant_name VARCHAR(160),
  unit_price NUMERIC(12, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  line_total NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_items_unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_items_line_total_non_negative CHECK (line_total >= 0)
);

CREATE TABLE inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  type inventory_log_type NOT NULL,
  adjustment_type VARCHAR(20),
  quantity_change INTEGER NOT NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reason VARCHAR(160),
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inventory_logs_stock_non_negative CHECK (
    stock_before >= 0
    AND stock_after >= 0
  )
);

CREATE TABLE delivery_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status order_status NOT NULL,
  note TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_store_id ON users(store_id);

CREATE INDEX idx_stores_seller_id ON stores(seller_id);
CREATE INDEX idx_stores_slug ON stores(slug);

CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_name ON products(name);

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_images_product_id ON product_images(product_id);

CREATE INDEX idx_customers_store_id ON customers(store_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_risk_status ON customers(risk_status);

CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_cod_status ON orders(cod_status);
CREATE INDEX idx_orders_delivery_status ON orders(delivery_status);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_product_variant_id ON order_items(product_variant_id);

CREATE INDEX idx_inventory_logs_store_id ON inventory_logs(store_id);
CREATE INDEX idx_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX idx_inventory_logs_product_variant_id ON inventory_logs(product_variant_id);
CREATE INDEX idx_inventory_logs_order_id ON inventory_logs(order_id);

CREATE INDEX idx_delivery_updates_order_id ON delivery_updates(order_id);
CREATE INDEX idx_delivery_updates_status ON delivery_updates(status);

CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_stores_updated_at
BEFORE UPDATE ON stores
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_product_variants_updated_at
BEFORE UPDATE ON product_variants
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
