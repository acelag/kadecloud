-- PayHere online payment gateway support.
--
-- 1. Track per-order payment status independently of fulfilment status.
-- 2. Per-store toggle to enable/disable PayHere (merchant credentials are
--    platform-level, so no per-store keys are needed).

-- payment_status on orders:  pending → paid | failed
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- Index for fast IPN look-ups by order_number (PayHere sends it back).
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON orders (payment_status)
  WHERE payment_status <> 'pending';

-- Per-store PayHere toggle (off by default — seller opts in via settings).
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS payhere_enabled BOOLEAN NOT NULL DEFAULT FALSE;
