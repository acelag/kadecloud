import cors from "cors";
import { config } from "./env.js";
import { query } from "./db.js";
import { logger } from "./logger.js";

// Each static entry can be:
//   - an exact origin like https://shop.example.com
//   - a wildcard subdomain like https://*.example.com
// If no entries are configured, fall back to common dev hosts so the repo
// still runs out of the box. In production we require an explicit list
// (enforced in env.js).
//
// On top of the static list, any active store's `custom_domain` is allowed
// dynamically: a seller can point their own domain at the platform without
// a redeploy or config change. Those lookups are cached (see below) so we
// don't query Postgres on every CORS preflight.
const defaults = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://*.localtest.me:5173",
  "http://*.localtest.me:5174"
];

const allowed = config.corsOrigins.length > 0 ? config.corsOrigins : defaults;

function matches(origin, pattern) {
  if (pattern === origin) return true;
  // Wildcard subdomain: split protocol and host parts.
  const match = pattern.match(/^(https?:\/\/)\*\.(.+)$/);
  if (!match) return false;
  const [, scheme, suffix] = match;
  return (
    origin.startsWith(scheme) &&
    // Either exact suffix or a leftmost-label.suffix host.
    (origin === `${scheme}${suffix}` || origin.endsWith(`.${suffix}`))
  );
}

// Extract the bare host (no scheme, no port) from an http(s) origin.
// Returns null for anything that isn't a valid http/https origin so we never
// run a DB lookup on garbage (e.g. `null`, `file://`, chrome-extension://).
function customDomainHost(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  // The DB CHECK constraint only stores dotted FQDNs; skip bare labels.
  return host.includes(".") ? host : null;
}

// TTL cache of host -> boolean so repeated preflights from the same origin
// (and floods of unknown origins from bots) don't each hit Postgres.
// Negative results expire faster than positive ones so a newly added custom
// domain starts working within ~1 minute without a restart.
const POSITIVE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const domainCache = new Map();

function cacheGet(host) {
  const entry = domainCache.get(host);
  if (!entry) return undefined;
  if (entry.expires <= Date.now()) {
    domainCache.delete(host);
    return undefined;
  }
  return entry.allowed;
}

function cacheSet(host, isAllowed) {
  // Simple size cap: when full, drop the oldest insertion. Map preserves
  // insertion order, so the first key is the oldest.
  if (domainCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = domainCache.keys().next().value;
    if (oldest !== undefined) domainCache.delete(oldest);
  }
  domainCache.set(host, {
    allowed: isAllowed,
    expires: Date.now() + (isAllowed ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS)
  });
}

async function isCustomDomainAllowed(origin) {
  const host = customDomainHost(origin);
  if (!host) return false;

  const cached = cacheGet(host);
  if (cached !== undefined) return cached;

  let isAllowed = false;
  try {
    // A store's storefront (custom_domain) and admin (admin_domain) hosts both
    // call the API cross-origin, so either one is a valid CORS origin.
    const { rows } = await query(
      `SELECT 1 FROM stores
         WHERE (LOWER(custom_domain) = $1 OR LOWER(admin_domain) = $1)
           AND is_active = true
         LIMIT 1`,
      [host]
    );
    isAllowed = rows.length > 0;
  } catch (err) {
    // On a DB error, fail closed for this request but don't cache the miss,
    // so a transient outage doesn't lock out a valid domain for 60s.
    logger.error({ err, host }, "CORS custom-domain lookup failed");
    return false;
  }

  cacheSet(host, isAllowed);
  return isAllowed;
}

// Clear cached decisions for a host after its custom_domain changes, so an
// updated store takes effect immediately instead of waiting for TTL expiry.
export function invalidateCorsHost(host) {
  if (!host) return;
  domainCache.delete(String(host).trim().toLowerCase());
}

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Same-origin, server-to-server and curl have no Origin header — allow.
    if (!origin) return callback(null, true);
    if (allowed.some((pattern) => matches(origin, pattern))) {
      return callback(null, true);
    }
    // Not in the static list — check whether it's a live store custom domain.
    // Disallow without throwing: the browser blocks the response based on the
    // missing Access-Control-Allow-Origin header, while curl/server-to-server
    // requests are unaffected. This keeps logs quiet on bot scans.
    isCustomDomainAllowed(origin)
      .then((ok) => callback(null, ok))
      .catch(() => callback(null, false));
  },
  credentials: true,
  maxAge: 86400
});

export const allowedOrigins = allowed;
