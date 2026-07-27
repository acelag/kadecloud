import express from "express";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { syncAllProducts } from "../integrations/metaCatalog.js";
import { getUserStore, requireStoreAdmin } from "../utils/storeAccess.js";
import { invalidateCorsHost } from "../config/cors.js";

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

import { SUPPORTED_CURRENCIES } from "../utils/currencyRates.js";

const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code);
export const ALLOWED_CARD_ASPECTS = ["4:3", "1:1", "3:4", "16:9", "4:5"];

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  return value === true || value === "true" || value === "on" || value === 1;
}

function normalizeStoreBody(body) {
  const errors = [];
  const defaultCurrencyRaw = String(body.default_currency || "").trim().toUpperCase();
  const aspectRaw = String(body.storefront_card_aspect || "").trim();
  const perRowRaw = body.storefront_products_per_row;
  let perRow = null;

  if (perRowRaw !== undefined && perRowRaw !== null && perRowRaw !== "") {
    const parsed = Number.parseInt(perRowRaw, 10);
    perRow = Number.isInteger(parsed) ? parsed : NaN;
  }

  const bankTransferEnabledProvided = body.bank_transfer_enabled !== undefined;
  const bankTransferEnabled = bankTransferEnabledProvided
    ? toBoolean(body.bank_transfer_enabled, false)
    : null;

  const payhereEnabledProvided = body.payhere_enabled !== undefined;
  const payhereEnabled = payhereEnabledProvided
    ? toBoolean(body.payhere_enabled, false)
    : null;

  const posAspectRaw = String(body.pos_card_aspect || "").trim();
  const posPerRowRaw = body.pos_products_per_row;
  let posPerRow = null;
  if (posPerRowRaw !== undefined && posPerRowRaw !== null && posPerRowRaw !== "") {
    const parsed = Number.parseInt(posPerRowRaw, 10);
    posPerRow = Number.isInteger(parsed) ? parsed : NaN;
  }

  const subdomainProvided = body.subdomain !== undefined;
  const subdomain = subdomainProvided
    ? String(body.subdomain || "").trim().toLowerCase() || null
    : undefined;
  const customDomainProvided = body.custom_domain !== undefined;
  const customDomain = customDomainProvided
    ? String(body.custom_domain || "").trim().toLowerCase() || null
    : undefined;
  const adminDomainProvided = body.admin_domain !== undefined;
  const adminDomain = adminDomainProvided
    ? String(body.admin_domain || "").trim().toLowerCase() || null
    : undefined;

  const values = {
    name: String(body.name || "").trim(),
    phone: String(body.phone || "").trim() || null,
    whatsapp_phone: String(body.whatsapp_phone || "").trim() || null,
    description: String(body.description || "").trim() || null,
    address: String(body.address || "").trim() || null,
    city: String(body.city || "").trim() || null,
    district: String(body.district || "").trim() || null,
    logo_url: String(body.logo_url || "").trim() || null,
    favicon_url: String(body.favicon_url || "").trim() || null,
    default_currency: defaultCurrencyRaw || null,
    storefront_card_aspect: aspectRaw || null,
    storefront_products_per_row: perRow,
    bank_transfer_enabled: bankTransferEnabled,
    bank_account_name: String(body.bank_account_name || "").trim() || null,
    bank_account_number: String(body.bank_account_number || "").trim() || null,
    bank_name: String(body.bank_name || "").trim() || null,
    bank_branch: String(body.bank_branch || "").trim() || null,
    bank_transfer_instructions:
      String(body.bank_transfer_instructions || "").trim() || null,
    pos_card_aspect: posAspectRaw || null,
    pos_products_per_row: posPerRow,
    announcement_text_provided: body.announcement_text !== undefined,
    announcement_text:
      typeof body.announcement_text === "string"
        ? body.announcement_text.trim().slice(0, 280) || null
        : null,
    subdomain_provided: subdomainProvided,
    subdomain,
    custom_domain_provided: customDomainProvided,
    custom_domain: customDomain,
    admin_domain_provided: adminDomainProvided,
    admin_domain: adminDomain,
    payhere_enabled: payhereEnabled
  };

  if (bankTransferEnabled === true) {
    if (!values.bank_account_name) {
      errors.push("Bank account name is required when bank transfer is enabled");
    }
    if (!values.bank_account_number) {
      errors.push(
        "Bank account number is required when bank transfer is enabled"
      );
    }
    if (!values.bank_name) {
      errors.push("Bank name is required when bank transfer is enabled");
    }
  }

  if (!values.name) {
    errors.push("Store name is required");
  }

  if (values.logo_url && !/^https?:\/\/.+/i.test(values.logo_url)) {
    errors.push("Logo URL must start with http:// or https://");
  }

  if (
    values.default_currency &&
    !SUPPORTED_CURRENCY_CODES.includes(values.default_currency)
  ) {
    errors.push(
      `default_currency must be one of: ${SUPPORTED_CURRENCY_CODES.join(", ")}`
    );
  }

  if (
    values.storefront_card_aspect &&
    !ALLOWED_CARD_ASPECTS.includes(values.storefront_card_aspect)
  ) {
    errors.push(
      `storefront_card_aspect must be one of: ${ALLOWED_CARD_ASPECTS.join(", ")}`
    );
  }

  if (
    values.storefront_products_per_row !== null &&
    (Number.isNaN(values.storefront_products_per_row) ||
      values.storefront_products_per_row < 1 ||
      values.storefront_products_per_row > 6)
  ) {
    errors.push("storefront_products_per_row must be between 1 and 6");
  }

  if (
    values.pos_card_aspect &&
    !ALLOWED_CARD_ASPECTS.includes(values.pos_card_aspect)
  ) {
    errors.push(
      `pos_card_aspect must be one of: ${ALLOWED_CARD_ASPECTS.join(", ")}`
    );
  }

  if (
    values.pos_products_per_row !== null &&
    (Number.isNaN(values.pos_products_per_row) ||
      values.pos_products_per_row < 1 ||
      values.pos_products_per_row > 8)
  ) {
    errors.push("pos_products_per_row must be between 1 and 8");
  }

  if (
    values.subdomain &&
    !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(values.subdomain)
  ) {
    errors.push(
      "Subdomain must be 1-63 lowercase letters/digits/hyphens and cannot start or end with a hyphen"
    );
  }

  if (
    values.custom_domain &&
    !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(values.custom_domain)
  ) {
    errors.push("Storefront domain must be a valid lowercase domain (e.g. www.example.com)");
  }

  if (
    values.admin_domain &&
    !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(values.admin_domain)
  ) {
    errors.push("Admin domain must be a valid lowercase domain (e.g. admin.example.com)");
  }

  if (
    values.custom_domain &&
    values.admin_domain &&
    values.custom_domain === values.admin_domain
  ) {
    errors.push("Storefront and admin domains must be different");
  }

  return { errors, values };
}

function normalizeCatalogBody(body) {
  const errors = [];
  const values = {
    meta_catalog_id: String(body.meta_catalog_id || "").trim(),
    meta_access_token: String(body.meta_access_token || "").trim(),
    meta_currency: String(body.meta_currency || "LKR").trim().toUpperCase(),
    whatsapp_phone: String(body.whatsapp_phone || "").trim() || null
  };

  if (!values.meta_catalog_id) {
    errors.push("WhatsApp catalog ID is required");
  }

  if (!values.meta_access_token) {
    errors.push("Meta access token is required");
  }

  if (!/^[A-Z]{3}$/.test(values.meta_currency)) {
    errors.push("Currency must be a 3-letter code");
  }

  return { errors, values };
}

function storeSelectSql() {
  return `SELECT
    id,
    seller_id,
    name,
    slug,
    category,
    description,
    phone,
    whatsapp_phone,
    address,
    city,
    district,
    logo_url,
    favicon_url,
    is_active,
    meta_catalog_id,
    meta_currency,
    meta_last_sync_at,
    meta_last_sync_error,
    default_currency,
    storefront_card_aspect,
    storefront_products_per_row,
    pos_card_aspect,
    pos_products_per_row,
    subdomain,
    custom_domain,
    admin_domain,
    announcement_text,
    bank_transfer_enabled,
    bank_account_name,
    bank_account_number,
    bank_name,
    bank_branch,
    bank_transfer_instructions,
    payhere_enabled,
    (meta_catalog_id IS NOT NULL AND meta_access_token IS NOT NULL) AS meta_catalog_connected,
    created_at,
    updated_at
   FROM stores`;
}

router.use(requireAuth, requireStoreAdmin);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const userStore = await getUserStore(req.user.id);
    const result = await query(
      `${storeSelectSql()}
       WHERE id = $1
       LIMIT 1`,
      [userStore.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Store was not found"
      });
    }

    return res.status(200).json({
      store: result.rows[0]
    });
  })
);

router.put(
  "/me",
  asyncHandler(async (req, res) => {
    const { errors, values } = normalizeStoreBody(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    const userStore = await getUserStore(req.user.id);

    // Capture the current custom/admin domains before the update so we can
    // drop their cached CORS decisions if the seller changes or removes them.
    let previousCustomDomain = null;
    let previousAdminDomain = null;
    if (values.custom_domain_provided || values.admin_domain_provided) {
      const current = await query(
        "SELECT custom_domain, admin_domain FROM stores WHERE id = $1",
        [userStore.id]
      );
      previousCustomDomain = current.rows[0]?.custom_domain ?? null;
      previousAdminDomain = current.rows[0]?.admin_domain ?? null;
    }

    let result;
    try {
      result = await query(
      `UPDATE stores
       SET
        name = $1,
        phone = $2,
        whatsapp_phone = $3,
        description = $4,
        address = $5,
        city = $6,
        district = $7,
        logo_url = $8,
        favicon_url = $30,
        default_currency = COALESCE($9, default_currency),
        storefront_card_aspect = COALESCE($11, storefront_card_aspect),
        storefront_products_per_row = COALESCE($12, storefront_products_per_row),
        bank_transfer_enabled = COALESCE($13, bank_transfer_enabled),
        bank_account_name = COALESCE($14, bank_account_name),
        bank_account_number = COALESCE($15, bank_account_number),
        bank_name = COALESCE($16, bank_name),
        bank_branch = COALESCE($17, bank_branch),
        bank_transfer_instructions = COALESCE($18, bank_transfer_instructions),
        pos_card_aspect = COALESCE($19, pos_card_aspect),
        pos_products_per_row = COALESCE($20, pos_products_per_row),
        subdomain = CASE WHEN $21::boolean THEN $22::text ELSE subdomain END,
        custom_domain = CASE WHEN $23::boolean THEN $24::text ELSE custom_domain END,
        announcement_text = CASE WHEN $25::boolean THEN $26::text ELSE announcement_text END,
        payhere_enabled = COALESCE($27, payhere_enabled),
        admin_domain = CASE WHEN $28::boolean THEN $29::text ELSE admin_domain END
       WHERE id = $10
       RETURNING
        id,
        seller_id,
        name,
        slug,
        category,
        description,
        phone,
        whatsapp_phone,
        address,
        city,
        district,
        logo_url,
        favicon_url,
        is_active,
        meta_catalog_id,
        meta_currency,
        meta_last_sync_at,
        meta_last_sync_error,
        default_currency,
        storefront_card_aspect,
        storefront_products_per_row,
        pos_card_aspect,
        pos_products_per_row,
        subdomain,
        custom_domain,
        admin_domain,
        announcement_text,
        bank_transfer_enabled,
        bank_account_name,
        bank_account_number,
        bank_name,
        bank_branch,
        bank_transfer_instructions,
        payhere_enabled,
        (meta_catalog_id IS NOT NULL AND meta_access_token IS NOT NULL) AS meta_catalog_connected,
        created_at,
        updated_at`,
      [
        values.name,
        values.phone,
        values.whatsapp_phone,
        values.description,
        values.address,
        values.city,
        values.district,
        values.logo_url,
        values.default_currency,
        userStore.id,
        values.storefront_card_aspect,
        values.storefront_products_per_row,
        values.bank_transfer_enabled,
        values.bank_account_name,
        values.bank_account_number,
        values.bank_name,
        values.bank_branch,
        values.bank_transfer_instructions,
        values.pos_card_aspect,
        values.pos_products_per_row,
        values.subdomain_provided,
        values.subdomain ?? null,
        values.custom_domain_provided,
        values.custom_domain ?? null,
        values.announcement_text_provided,
        values.announcement_text ?? null,
        values.payhere_enabled,
        values.admin_domain_provided,
        values.admin_domain ?? null,
        values.favicon_url
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

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Store was not found"
      });
    }

    // Refresh the CORS cache so a domain change takes effect immediately
    // rather than waiting for the cache TTL to expire.
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

router.put(
  "/me/meta-catalog",
  asyncHandler(async (req, res) => {
    const { errors, values } = normalizeCatalogBody(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    const userStore = await getUserStore(req.user.id);
    const result = await query(
      `UPDATE stores
       SET
        meta_catalog_id = $1,
        meta_access_token = $2,
        meta_currency = $3,
        whatsapp_phone = COALESCE($4, whatsapp_phone),
        meta_last_sync_error = NULL
       WHERE id = $5
       RETURNING
        id,
        name,
        slug,
        phone,
        whatsapp_phone,
        meta_catalog_id,
        meta_currency,
        meta_last_sync_at,
        meta_last_sync_error,
        (meta_catalog_id IS NOT NULL AND meta_access_token IS NOT NULL) AS meta_catalog_connected`,
      [
        values.meta_catalog_id,
        values.meta_access_token,
        values.meta_currency,
        values.whatsapp_phone,
        userStore.id
      ]
    );

    return res.status(200).json({
      message: "WhatsApp catalog connected",
      store: result.rows[0]
    });
  })
);

router.delete(
  "/me/meta-catalog",
  asyncHandler(async (req, res) => {
    const userStore = await getUserStore(req.user.id);
    const result = await query(
      `UPDATE stores
       SET
        meta_catalog_id = NULL,
        meta_access_token = NULL,
        meta_last_sync_error = NULL
       WHERE id = $1
       RETURNING
        id,
        name,
        slug,
        phone,
        whatsapp_phone,
        meta_catalog_id,
        meta_currency,
        meta_last_sync_at,
        meta_last_sync_error,
        (meta_catalog_id IS NOT NULL AND meta_access_token IS NOT NULL) AS meta_catalog_connected`,
      [userStore.id]
    );

    return res.status(200).json({
      message: "WhatsApp catalog disconnected",
      store: result.rows[0]
    });
  })
);

router.post(
  "/me/sync-catalog",
  asyncHandler(async (req, res) => {
    const userStore = await getUserStore(req.user.id);
    const storeResult = await query(
      `SELECT
        id,
        name,
        slug,
        meta_catalog_id,
        meta_access_token,
        meta_currency
       FROM stores
       WHERE id = $1
       LIMIT 1`,
      [userStore.id]
    );

    if (storeResult.rowCount === 0) {
      return res.status(404).json({
        message: "Store was not found"
      });
    }

    const productsResult = await query(
      `SELECT
        products.*,
        categories.name AS category,
        COALESCE(
          json_agg(product_images.image_url ORDER BY product_images.position)
          FILTER (WHERE product_images.id IS NOT NULL),
          '[]'
        ) AS images
       FROM products
       LEFT JOIN categories ON categories.id = products.category_id
       LEFT JOIN product_images ON product_images.product_id = products.id
       WHERE products.store_id = $1
       GROUP BY products.id, categories.name
       ORDER BY products.updated_at DESC`,
      [userStore.id]
    );

    const result = await syncAllProducts(
      storeResult.rows[0],
      productsResult.rows
    );

    return res.status(200).json({
      message: "WhatsApp catalog sync completed",
      ...result
    });
  })
);

export default router;
