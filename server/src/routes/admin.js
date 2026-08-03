import bcrypt from "bcrypt";
import express from "express";
import { getClient, query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { signToken } from "../utils/authToken.js";
import { createUniqueStoreSlug } from "../utils/slug.js";
import { getUserStore } from "../utils/storeAccess.js";
import { SUPPORTED_CURRENCIES } from "../utils/currencyRates.js";
import { normalizeStoreDomains } from "../utils/domains.js";
import { invalidateCorsHost } from "../config/cors.js";
import { config } from "../config/env.js";

const router = express.Router();
const saltRounds = 12;
const platformAdminRoles = ["seller", "store_admin"];
const storeAdminRoles = ["seller"];

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireAccountManager(req, _res, next) {
  if (
    !["platform_admin", "store_admin"].includes(req.user.role) ||
    req.user.impersonatedBy
  ) {
    return next(createHttpError(403, "Only admins can manage accounts"));
  }

  return next();
}

function requirePlatformAdmin(req, _res, next) {
  if (req.user.role !== "platform_admin" || req.user.impersonatedBy) {
    return next(createHttpError(403, "Platform admin access only"));
  }

  return next();
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function validateAccountBody(body, currentUser) {
  const errors = [];
  const allowedRoles =
    currentUser.role === "platform_admin" ? platformAdminRoles : storeAdminRoles;
  const values = {
    name: String(body.name || "").trim(),
    email: normalizeEmail(body.email),
    password: String(body.password || ""),
    role: String(body.role || "seller").trim(),
    store_id: String(body.store_id || "").trim() || null,
    businessName: String(body.businessName || "").trim(),
    businessCategory: String(body.businessCategory || "").trim() || null,
    phone: String(body.phone || "").trim() || null,
    address: String(body.address || "").trim() || null,
    city: String(body.city || "").trim() || null,
    district: String(body.district || "").trim() || null
  };

  if (!values.name) {
    errors.push("Name is required");
  }

  if (!values.email) {
    errors.push("Email is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.push("Email must be valid");
  }

  if (!values.password) {
    errors.push("Password is required");
  } else if (values.password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  if (!allowedRoles.includes(values.role)) {
    errors.push(
      currentUser.role === "platform_admin"
        ? "Role must be seller or store_admin"
        : "Store admins can only create seller accounts"
    );
  }

  if (values.role === "store_admin" && !values.businessName) {
    errors.push("Business name is required for store admin accounts");
  }

  if (currentUser.role === "platform_admin" && values.role === "seller" && !values.store_id) {
    errors.push("Store is required for seller accounts");
  }

  return { errors, values };
}

function accountSelectSql() {
  return `SELECT
    users.id,
    users.name,
    users.email,
    users.role,
    users.is_active,
    users.created_at,
    users.store_id AS user_store_id,
    stores.id AS store_id,
    stores.name AS store_name,
    stores.slug AS store_slug,
    stores.phone AS store_phone,
    stores.city AS store_city,
    stores.district AS store_district,
    stores.logo_url AS store_logo_url,
    stores.favicon_url AS store_favicon_url,
    stores.logo_size AS store_logo_size
   FROM users
   LEFT JOIN stores ON stores.id = users.store_id OR stores.seller_id = users.id`;
}

function toUserResponse(row, impersonator = null) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    impersonator,
    store: row.store_id
      ? {
          id: row.store_id,
          name: row.store_name,
          slug: row.store_slug,
          phone: row.store_phone,
          city: row.store_city,
          district: row.store_district,
          logo_url: row.store_logo_url,
          favicon_url: row.store_favicon_url,
          logo_size: row.store_logo_size
        }
      : null
  };
}

router.use(requireAuth, requireAccountManager);

router.get(
  "/stores",
  asyncHandler(async (req, res) => {
    if (req.user.role === "store_admin") {
      const store = await getUserStore(req.user.id);

      return res.status(200).json({
        stores: [
          {
            id: store.id,
            name: store.name,
            slug: store.slug,
            phone: null,
            city: null,
            district: null
          }
        ]
      });
    }

    const result = await query(
      `SELECT id, name, slug, phone, city, district, subdomain, custom_domain, admin_domain, is_active
       FROM stores
       ORDER BY created_at DESC`
    );

    return res.status(200).json({
      stores: result.rows,
      dns: {
        cnameTarget: config.dns.cnameTarget,
        apexIps: config.dns.apexIps
      }
    });
  })
);

router.put(
  "/stores/:id/domains",
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const { errors, values } = normalizeStoreDomains(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    // Read the current custom/admin domains first so we can drop their cached
    // CORS decisions if they're being changed or removed.
    const existing = await query(
      "SELECT custom_domain, admin_domain FROM stores WHERE id = $1",
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Store was not found" });
    }
    const previousCustomDomain = existing.rows[0].custom_domain;
    const previousAdminDomain = existing.rows[0].admin_domain;

    let result;
    try {
      result = await query(
        `UPDATE stores
         SET
          subdomain = CASE WHEN $2::boolean THEN $3::text ELSE subdomain END,
          custom_domain = CASE WHEN $4::boolean THEN $5::text ELSE custom_domain END,
          admin_domain = CASE WHEN $6::boolean THEN $7::text ELSE admin_domain END
         WHERE id = $1
         RETURNING id, name, slug, subdomain, custom_domain, admin_domain, is_active`,
        [
          req.params.id,
          values.subdomain_provided,
          values.subdomain ?? null,
          values.custom_domain_provided,
          values.custom_domain ?? null,
          values.admin_domain_provided,
          values.admin_domain ?? null
        ]
      );
    } catch (err) {
      if (err.code === "23505") {
        const which =
          err.constraint === "stores_subdomain_unique_ci"
            ? "Subdomain"
            : err.constraint === "stores_custom_domain_unique_ci"
              ? "Storefront domain"
              : err.constraint === "stores_admin_domain_unique_ci"
                ? "Admin domain"
                : "Domain";
        return res.status(409).json({
          message: `${which} is already in use by another store`
        });
      }
      throw err;
    }

    // Refresh the CORS cache so the change takes effect immediately.
    if (values.custom_domain_provided) {
      invalidateCorsHost(previousCustomDomain);
      invalidateCorsHost(result.rows[0].custom_domain);
    }
    if (values.admin_domain_provided) {
      invalidateCorsHost(previousAdminDomain);
      invalidateCorsHost(result.rows[0].admin_domain);
    }

    return res.status(200).json({
      store: result.rows[0]
    });
  })
);

router.get(
  "/accounts",
  asyncHandler(async (req, res) => {
    const params = [];
    let where = "";

    if (req.user.role === "store_admin") {
      const store = await getUserStore(req.user.id);
      params.push(store.id);
      where = "WHERE stores.id = $1 AND users.role IN ('store_admin', 'seller')";
    }

    const result = await query(
      `${accountSelectSql()}
       ${where}
       ORDER BY users.created_at DESC`
      ,
      params
    );

    return res.status(200).json({
      accounts: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        is_active: row.is_active,
        created_at: row.created_at,
        store: row.store_id
          ? {
              id: row.store_id,
              name: row.store_name,
              slug: row.store_slug,
              phone: row.store_phone,
              city: row.store_city,
              district: row.store_district
            }
          : null
      }))
    });
  })
);

router.post(
  "/accounts",
  asyncHandler(async (req, res) => {
    const { errors, values } = validateAccountBody(req.body, req.user);

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    const passwordHash = await bcrypt.hash(values.password, saltRounds);
    const client = await getClient();

    try {
      await client.query("BEGIN");
      let store = null;

      if (values.role === "seller") {
        if (req.user.role === "store_admin") {
          store = await getUserStore(req.user.id);
        } else {
          const storeResult = await client.query(
            `SELECT id, name, slug, phone, city, district
             FROM stores
             WHERE id = $1
             LIMIT 1`,
            [values.store_id]
          );

          if (storeResult.rowCount === 0) {
            throw createHttpError(404, "Store was not found");
          }

          store = storeResult.rows[0];
        }
      }

      const userResult = await client.query(
        `INSERT INTO users (name, email, password_hash, role, store_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, role, is_active, created_at`,
        [
          values.name,
          values.email,
          passwordHash,
          values.role,
          values.role === "seller" ? store.id : null
        ]
      );
      const user = userResult.rows[0];

      if (values.role === "store_admin") {
        const slug = await createUniqueStoreSlug(client, values.businessName);
        const storeResult = await client.query(
          `INSERT INTO stores (
            seller_id,
            name,
            slug,
            category,
            phone,
            address,
            city,
            district
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, name, slug, phone, city, district`,
          [
            user.id,
            values.businessName,
            slug,
            values.businessCategory,
            values.phone,
            values.address,
            values.city,
            values.district
          ]
        );
        store = storeResult.rows[0];
        await client.query("UPDATE users SET store_id = $1 WHERE id = $2", [
          store.id,
          user.id
        ]);
      }

      await client.query("COMMIT");

      return res.status(201).json({
        account: {
          ...user,
          store
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");

      if (err.code === "23505") {
        throw createHttpError(409, "Email or store slug already exists");
      }

      throw err;
    } finally {
      client.release();
    }
  })
);

router.post(
  "/accounts/:id/login-as",
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        message: "You are already logged in as this account"
      });
    }

    const result = await query(
      `${accountSelectSql()}
       WHERE users.id = $1 AND users.is_active = true
       LIMIT 1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Account was not found"
      });
    }

    const account = result.rows[0];

    if (!["store_admin", "seller"].includes(account.role)) {
      return res.status(400).json({
        message: "Super admins can only log in as store accounts"
      });
    }

    const token = signToken(account, { impersonatedBy: req.user.id });

    return res.status(200).json({
      token,
      user: toUserResponse(account, {
        id: req.user.id,
        role: req.user.role
      })
    });
  })
);

// Set a new password for a store account. Admins never see the old password
// (they can't — it's a one-way bcrypt hash); this simply overwrites it with a
// new one they can hand to the user. Scope matches login-as: store accounts
// only, and store admins are limited to sellers in their own store.
router.post(
  "/accounts/:id/password",
  asyncHandler(async (req, res) => {
    const password = String(req.body.password || "");

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }
    if (password.length < 8) {
      return res.status(400).json({
        message: "Validation failed",
        errors: ["Password must be at least 8 characters"]
      });
    }

    const result = await query(
      `SELECT id, role, store_id AS user_store_id
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Account was not found" });
    }

    const account = result.rows[0];

    if (!["store_admin", "seller"].includes(account.role)) {
      return res.status(400).json({
        message: "Passwords can only be set for store accounts"
      });
    }

    if (req.user.role === "store_admin") {
      const store = await getUserStore(req.user.id);
      if (account.role !== "seller" || account.user_store_id !== store.id) {
        return res.status(403).json({
          message: "You can only set passwords for sellers in your store"
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Overwrite the hash and void any outstanding reset link for this account.
    await query(
      `UPDATE users
         SET password_hash = $1,
             password_reset_token = NULL,
             password_reset_expires = NULL
       WHERE id = $2`,
      [passwordHash, account.id]
    );

    return res.status(200).json({ message: "Password updated" });
  })
);

router.get(
  "/settings",
  requirePlatformAdmin,
  asyncHandler(async (_req, res) => {
    const result = await query(
      "SELECT key, value, updated_at FROM platform_settings"
    );

    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = { value: row.value, updated_at: row.updated_at };
    }

    return res.status(200).json({
      settings,
      supported_currencies: SUPPORTED_CURRENCIES
    });
  })
);

router.put(
  "/settings",
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const defaultCurrency = String(req.body.default_currency || "")
      .trim()
      .toUpperCase();
    const supportedCodes = SUPPORTED_CURRENCIES.map((c) => c.code);

    if (!supportedCodes.includes(defaultCurrency)) {
      return res.status(400).json({
        message: "Validation failed",
        errors: [
          `default_currency must be one of: ${supportedCodes.join(", ")}`
        ]
      });
    }

    await query(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ('default_currency', $1, now())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [defaultCurrency]
    );

    return res.status(200).json({
      message: "Platform settings updated",
      settings: {
        default_currency: { value: defaultCurrency }
      }
    });
  })
);

export default router;
