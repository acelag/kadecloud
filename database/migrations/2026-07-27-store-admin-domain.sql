-- Per-store admin host. A store can serve its seller dashboard on a dedicated
-- hostname (e.g. admin.kadefashion.lk) that is separate from its storefront
-- custom_domain (e.g. www.kadefashion.lk). The host resolver uses this to
-- decide which surface (storefront vs admin) to serve.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS admin_domain VARCHAR(253);

-- Case-insensitive uniqueness so two stores can't claim the same admin host.
CREATE UNIQUE INDEX IF NOT EXISTS stores_admin_domain_unique_ci
  ON stores (LOWER(admin_domain)) WHERE admin_domain IS NOT NULL;

-- Same FQDN format check used for custom_domain.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_admin_domain_format'
  ) THEN
    ALTER TABLE stores
      ADD CONSTRAINT stores_admin_domain_format
        CHECK (
          admin_domain IS NULL
          OR admin_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$'
        );
  END IF;
END $$;
