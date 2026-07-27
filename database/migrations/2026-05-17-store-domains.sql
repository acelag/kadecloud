-- Host-based routing: each store can have a subdomain on the platform
-- (e.g. kade-fashion.kadecloud.com) and/or its own custom domain.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS subdomain VARCHAR(63),
  ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(253);

-- Uniqueness (case-insensitive) so two stores can't claim the same host.
CREATE UNIQUE INDEX IF NOT EXISTS stores_subdomain_unique_ci
  ON stores (LOWER(subdomain)) WHERE subdomain IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS stores_custom_domain_unique_ci
  ON stores (LOWER(custom_domain)) WHERE custom_domain IS NOT NULL;

-- Format checks. Subdomain: 1-63 chars, lowercase alphanumeric + hyphens,
-- no leading/trailing hyphens, no consecutive hyphens at the edges.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_subdomain_format'
  ) THEN
    ALTER TABLE stores
      ADD CONSTRAINT stores_subdomain_format
        CHECK (
          subdomain IS NULL
          OR subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
        );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_custom_domain_format'
  ) THEN
    ALTER TABLE stores
      ADD CONSTRAINT stores_custom_domain_format
        CHECK (
          custom_domain IS NULL
          OR custom_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'
        );
  END IF;
END $$;

-- Backfill the subdomain from the slug for stores that don't have one yet,
-- as long as the slug is a valid subdomain. Skip on conflict.
UPDATE stores
SET subdomain = LOWER(slug)
WHERE subdomain IS NULL
  AND slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
  AND NOT EXISTS (
    SELECT 1 FROM stores s2
    WHERE s2.id <> stores.id
      AND LOWER(s2.subdomain) = LOWER(stores.slug)
  );
