-- Store the customer's email on orders so we can send a confirmation even
-- when the shopper is not logged in (guest checkout).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_orders_customer_email
  ON orders (customer_email)
  WHERE customer_email IS NOT NULL;
