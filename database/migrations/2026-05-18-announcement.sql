-- Storefront announcement bar text. Nullable / empty = bar hidden.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS announcement_text VARCHAR(280);
