// Host formats accepted for store routing. Kept in sync with the CHECK
// constraints in database/migrations/2026-05-17-store-domains.sql.
//
// Subdomain: 1-63 chars, lowercase alphanumeric + hyphens, no leading or
// trailing hyphen (a single DNS label).
export const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// Custom domain: a dotted, lowercase FQDN such as shop.example.com.
export const CUSTOM_DOMAIN_REGEX =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

// Normalize and validate the two host fields from a request body. Only fields
// present on the body are treated as "provided" so callers can do partial
// updates (e.g. change the custom domain without touching the subdomain).
// An empty string clears the field (stored as NULL).
export function normalizeStoreDomains(body = {}) {
  const errors = [];

  const subdomainProvided = body.subdomain !== undefined;
  const subdomain = subdomainProvided
    ? String(body.subdomain || "").trim().toLowerCase() || null
    : null;

  const customDomainProvided = body.custom_domain !== undefined;
  const customDomain = customDomainProvided
    ? String(body.custom_domain || "").trim().toLowerCase() || null
    : null;

  const adminDomainProvided = body.admin_domain !== undefined;
  const adminDomain = adminDomainProvided
    ? String(body.admin_domain || "").trim().toLowerCase() || null
    : null;

  if (subdomain && !SUBDOMAIN_REGEX.test(subdomain)) {
    errors.push(
      "Subdomain must be 1-63 lowercase letters/digits/hyphens and cannot start or end with a hyphen"
    );
  }

  if (customDomain && !CUSTOM_DOMAIN_REGEX.test(customDomain)) {
    errors.push(
      "Storefront domain must be a valid lowercase domain (e.g. www.example.com)"
    );
  }

  if (adminDomain && !CUSTOM_DOMAIN_REGEX.test(adminDomain)) {
    errors.push(
      "Admin domain must be a valid lowercase domain (e.g. admin.example.com)"
    );
  }

  if (customDomain && adminDomain && customDomain === adminDomain) {
    errors.push("Storefront and admin domains must be different");
  }

  return {
    errors,
    values: {
      subdomain_provided: subdomainProvided,
      subdomain,
      custom_domain_provided: customDomainProvided,
      custom_domain: customDomain,
      admin_domain_provided: adminDomainProvided,
      admin_domain: adminDomain
    }
  };
}
