-- Adds Store Admin role and shared store membership for seller staff accounts.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'store_admin';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS store_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_store_id_fk'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_store_id_fk
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);

UPDATE users
SET role = 'store_admin'
WHERE role = 'seller'
  AND id IN (SELECT seller_id FROM stores);

UPDATE users
SET store_id = stores.id
FROM stores
WHERE users.id = stores.seller_id
  AND users.store_id IS NULL;

ALTER TABLE users
ALTER COLUMN role SET DEFAULT 'store_admin';
