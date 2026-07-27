-- Per-store favicon (browser tab icon). Shown on the store's storefront tab
-- and in the store admin dashboard, separate from the storefront logo.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS favicon_url TEXT;
