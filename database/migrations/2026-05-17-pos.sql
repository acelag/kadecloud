-- POS support: cash payment method, in-store order channel, walk-in friendly nullables.

ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'cash';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS channel VARCHAR(16) NOT NULL DEFAULT 'online';

ALTER TABLE orders
  ALTER COLUMN customer_name DROP NOT NULL,
  ALTER COLUMN customer_phone DROP NOT NULL,
  ALTER COLUMN delivery_address DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
