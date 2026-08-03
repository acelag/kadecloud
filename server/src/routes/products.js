import express from "express";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  syncProductInBackground,
  syncProductDeleteInBackground
} from "../integrations/metaCatalog.js";
import { createSlug } from "../utils/slug.js";
import { getUserStore, requireStoreUser } from "../utils/storeAccess.js";

const router = express.Router();

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

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return Number(value);
}

function toInteger(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return Number.parseInt(value, 10);
}

function toBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return value === true || value === "true";
}

const MAX_GALLERY_IMAGES = 10;

function normalizeImages(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const cleaned = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const trimmed = entry.trim();

    if (trimmed) {
      cleaned.push(trimmed);
    }
  }

  return cleaned;
}

const MAX_SIZES = 30;
const MAX_SIZE_LABEL = 60;

// Sizes are stored as product_variants rows (name = size label). Normalize the
// incoming [{label, quantity}] list: trim labels, dedupe case-insensitively,
// clamp quantities to non-negative integers. Returns null when the caller did
// not send a `sizes` field at all (so we leave existing sizes untouched), or an
// array (possibly empty, meaning "this product has no sizes").
function normalizeSizes(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const cleaned = [];
  const seen = new Set();

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const label = String(entry.label ?? entry.name ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const qty = Number.parseInt(entry.quantity ?? entry.stock_quantity ?? 0, 10);
    cleaned.push({
      label: label.slice(0, MAX_SIZE_LABEL),
      quantity: Number.isInteger(qty) && qty > 0 ? qty : 0
    });
  }

  return cleaned.slice(0, MAX_SIZES);
}

const MAX_ATTRIBUTES = 30;
const MAX_ATTRIBUTE_LABEL = 100;
const MAX_ATTRIBUTE_VALUE = 500;

function normalizeAttributes(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const cleaned = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const label = String(entry.label || "").trim();
    const val = String(entry.value || "").trim();
    if (!label || !val) continue;
    cleaned.push({
      label: label.slice(0, MAX_ATTRIBUTE_LABEL),
      value: val.slice(0, MAX_ATTRIBUTE_VALUE)
    });
  }

  return cleaned.slice(0, MAX_ATTRIBUTES);
}

function validateProductBody(body) {
  const errors = [];
  const price = toNumber(body.price);
  const discountPrice =
    body.discount_price === undefined || body.discount_price === null || body.discount_price === ""
      ? null
      : toNumber(body.discount_price);
  const stockQuantity = toInteger(body.stock_quantity);
  const lowStockThreshold = toInteger(body.low_stock_threshold);
  const name = String(body.name || "").trim();
  const images = normalizeImages(body.images);
  const attributes = normalizeAttributes(body.attributes);
  const sizes = normalizeSizes(body.sizes);

  if (!name) {
    errors.push("Product name is required");
  }

  if (!Number.isFinite(price) || price < 0) {
    errors.push("Price must be a valid non-negative number");
  }

  if (
    discountPrice !== null &&
    (!Number.isFinite(discountPrice) ||
      discountPrice < 0 ||
      discountPrice > price)
  ) {
    errors.push("Discount price must be between 0 and the product price");
  }

  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    errors.push("Stock quantity must be a non-negative integer");
  }

  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
    errors.push("Low stock threshold must be a non-negative integer");
  }

  if (images && images.length > MAX_GALLERY_IMAGES) {
    errors.push(`Gallery is limited to ${MAX_GALLERY_IMAGES} images`);
  }

  const categoryIdRaw = body.category_id;
  const category_id =
    typeof categoryIdRaw === "string" && categoryIdRaw.trim()
      ? categoryIdRaw.trim()
      : null;

  return {
    errors,
    values: {
      name,
      sku: String(body.sku || "").trim() || null,
      category_id,
      description: String(body.description || "").trim() || null,
      price,
      discount_price: discountPrice,
      stock_quantity: stockQuantity,
      low_stock_threshold: lowStockThreshold,
      image_url: String(body.image_url || "").trim() || null,
      cod_available: toBoolean(body.cod_available, true),
      is_active: toBoolean(body.is_active, true),
      images,
      attributes,
      sizes
    }
  };
}

async function assertCategoryBelongsToStore(storeId, categoryId) {
  if (!categoryId) return;
  const result = await query(
    "SELECT id FROM categories WHERE store_id = $1 AND id = $2 LIMIT 1",
    [storeId, categoryId]
  );
  if (result.rowCount === 0) {
    throw createHttpError(400, "Selected category does not belong to this store");
  }
}

async function fetchProductImages(productId) {
  const result = await query(
    `SELECT image_url FROM product_images
     WHERE product_id = $1 ORDER BY position ASC`,
    [productId]
  );

  return result.rows.map((row) => row.image_url);
}

async function replaceProductImages(productId, images) {
  await query("DELETE FROM product_images WHERE product_id = $1", [productId]);

  if (!images || images.length === 0) {
    return [];
  }

  const values = [];
  const placeholders = [];

  images.forEach((url, index) => {
    values.push(productId, url, index);
    const base = index * 3;
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
  });

  await query(
    `INSERT INTO product_images (product_id, image_url, position)
     VALUES ${placeholders.join(", ")}`,
    values
  );

  return images;
}

// Return a product's sizes for the admin editor: id + label + quantity, in the
// seller-defined order. Only active rows (soft-removed sizes stay hidden).
async function fetchProductSizes(productId) {
  const result = await query(
    `SELECT id, name AS label, stock_quantity AS quantity
       FROM product_variants
      WHERE product_id = $1 AND is_active = true
      ORDER BY position ASC, name ASC`,
    [productId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    label: row.label,
    quantity: Number(row.quantity)
  }));
}

// Reconcile a product's size rows with the submitted list. We match by label
// (case-insensitive) and UPDATE in place so variant ids survive edits — this
// matters because order_items reference product_variants with ON DELETE
// RESTRICT. Sizes dropped from the list are deleted when unreferenced, or
// soft-removed (is_active = false) when an order still points at them.
async function syncProductSizes(productId, sizes, price) {
  const existing = await query(
    "SELECT id, name FROM product_variants WHERE product_id = $1",
    [productId]
  );
  const byLabel = new Map(
    existing.rows.map((row) => [row.name.toLowerCase(), row])
  );
  const keptIds = new Set();

  for (let index = 0; index < sizes.length; index += 1) {
    const size = sizes[index];
    const match = byLabel.get(size.label.toLowerCase());

    if (match) {
      await query(
        `UPDATE product_variants
            SET name = $1, price = $2, stock_quantity = $3,
                position = $4, is_active = true
          WHERE id = $5`,
        [size.label, price, size.quantity, index, match.id]
      );
      keptIds.add(match.id);
    } else {
      const inserted = await query(
        `INSERT INTO product_variants
            (product_id, name, price, stock_quantity, position)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [productId, size.label, price, size.quantity, index]
      );
      keptIds.add(inserted.rows[0].id);
    }
  }

  for (const row of existing.rows) {
    if (keptIds.has(row.id)) continue;

    const referenced = await query(
      "SELECT 1 FROM order_items WHERE product_variant_id = $1 LIMIT 1",
      [row.id]
    );

    if (referenced.rowCount > 0) {
      await query(
        "UPDATE product_variants SET is_active = false, stock_quantity = 0 WHERE id = $1",
        [row.id]
      );
    } else {
      await query("DELETE FROM product_variants WHERE id = $1", [row.id]);
    }
  }
}

// When a product has sizes, its own stock_quantity mirrors the sum of the size
// stocks so storefront in-stock checks, low-stock counts, and dashboards keep
// working off the single products.stock_quantity column.
function stockFromSizes(sizes) {
  return sizes.reduce((sum, size) => sum + size.quantity, 0);
}

async function createUniqueProductSlug(storeId, name, excludedProductId = null) {
  const baseSlug = createSlug(name).slice(0, 130);
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const params = [storeId, slug];
    let sql = "SELECT id FROM products WHERE store_id = $1 AND slug = $2";

    if (excludedProductId) {
      params.push(excludedProductId);
      sql += " AND id <> $3";
    }

    sql += " LIMIT 1";

    const existingProduct = await query(sql, params);

    if (existingProduct.rowCount === 0) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function productSelectSql() {
  return `SELECT
    products.id,
    products.store_id,
    products.name,
    products.slug,
    products.sku,
    products.category_id,
    categories.name AS category,
    categories.slug AS category_slug,
    products.description,
    products.price,
    products.discount_price,
    products.stock_quantity,
    products.low_stock_threshold,
    products.image_url,
    products.cod_available,
    products.is_active,
    products.attributes,
    products.created_at,
    products.updated_at,
    (products.low_stock_threshold > 0 AND products.stock_quantity <= products.low_stock_threshold) AS is_low_stock
  FROM products
  LEFT JOIN categories ON categories.id = products.category_id`;
}

router.use(requireAuth, requireStoreUser);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const store = await getUserStore(req.user.id);
    const params = [store.id];
    const where = ["products.store_id = $1"];

    if (req.query.search) {
      params.push(`%${String(req.query.search).trim()}%`);
      where.push(`products.name ILIKE $${params.length}`);
    }

    if (req.query.category_id) {
      params.push(String(req.query.category_id).trim());
      where.push(`products.category_id = $${params.length}`);
    }

    if (req.query.status === "active") {
      where.push("products.is_active = true");
    }

    if (req.query.status === "inactive") {
      where.push("products.is_active = false");
    }

    const result = await query(
      `${productSelectSql()}
       WHERE ${where.join(" AND ")}
       ORDER BY products.updated_at DESC`,
      params
    );

    res.status(200).json({
      products: result.rows
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { errors, values } = validateProductBody(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    const store = await getUserStore(req.user.id);
    await assertCategoryBelongsToStore(store.id, values.category_id);
    const slug = await createUniqueProductSlug(store.id, values.name);

    const hasSizes = Array.isArray(values.sizes) && values.sizes.length > 0;
    const stockQuantity = hasSizes
      ? stockFromSizes(values.sizes)
      : values.stock_quantity;

    try {
      const insertResult = await query(
        `INSERT INTO products (
          store_id,
          name,
          slug,
          sku,
          category_id,
          description,
          price,
          discount_price,
          stock_quantity,
          low_stock_threshold,
          image_url,
          cod_available,
          is_active,
          attributes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
        RETURNING id`,
        [
          store.id,
          values.name,
          slug,
          values.sku,
          values.category_id,
          values.description,
          values.price,
          values.discount_price,
          stockQuantity,
          values.low_stock_threshold,
          values.image_url,
          values.cod_available,
          values.is_active,
          JSON.stringify(values.attributes || [])
        ]
      );

      if (values.sizes !== null) {
        await syncProductSizes(insertResult.rows[0].id, values.sizes, values.price);
      }

      const reload = await query(
        `${productSelectSql()} WHERE products.id = $1`,
        [insertResult.rows[0].id]
      );
      const createdProduct = reload.rows[0];
      const images = values.images
        ? await replaceProductImages(createdProduct.id, values.images)
        : [];
      const sizes = await fetchProductSizes(createdProduct.id);
      const productWithImages = { ...createdProduct, images, sizes };

      syncProductInBackground(store, productWithImages);

      res.status(201).json({
        product: productWithImages
      });
    } catch (err) {
      if (err.code === "23505") {
        throw createHttpError(409, "A product with this SKU already exists");
      }

      throw err;
    }
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const store = await getUserStore(req.user.id);
    const result = await query(
      `${productSelectSql()} WHERE products.store_id = $1 AND products.id = $2`,
      [store.id, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Product was not found"
      });
    }

    const images = await fetchProductImages(req.params.id);
    const sizes = await fetchProductSizes(req.params.id);

    res.status(200).json({
      product: { ...result.rows[0], images, sizes }
    });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { errors, values } = validateProductBody(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    const store = await getUserStore(req.user.id);
    await assertCategoryBelongsToStore(store.id, values.category_id);
    const existingProduct = await query(
      "SELECT id FROM products WHERE store_id = $1 AND id = $2",
      [store.id, req.params.id]
    );

    if (existingProduct.rowCount === 0) {
      return res.status(404).json({
        message: "Product was not found"
      });
    }

    const slug = await createUniqueProductSlug(
      store.id,
      values.name,
      req.params.id
    );

    const hasSizes = Array.isArray(values.sizes) && values.sizes.length > 0;
    const stockQuantity = hasSizes
      ? stockFromSizes(values.sizes)
      : values.stock_quantity;

    try {
      // Sync sizes first so stock aggregation below reflects them.
      if (values.sizes !== null) {
        await syncProductSizes(req.params.id, values.sizes, values.price);
      }

      const updateResult = await query(
        `UPDATE products
        SET
          name = $1,
          slug = $2,
          sku = $3,
          category_id = $4,
          description = $5,
          price = $6,
          discount_price = $7,
          stock_quantity = $8,
          low_stock_threshold = $9,
          image_url = $10,
          cod_available = $11,
          is_active = $12,
          attributes = COALESCE($15::jsonb, attributes)
        WHERE store_id = $13 AND id = $14
        RETURNING id`,
        [
          values.name,
          slug,
          values.sku,
          values.category_id,
          values.description,
          values.price,
          values.discount_price,
          stockQuantity,
          values.low_stock_threshold,
          values.image_url,
          values.cod_available,
          values.is_active,
          store.id,
          req.params.id,
          values.attributes === null ? null : JSON.stringify(values.attributes)
        ]
      );

      const reload = await query(
        `${productSelectSql()} WHERE products.id = $1`,
        [updateResult.rows[0].id]
      );
      const updatedProduct = reload.rows[0];
      const images = values.images
        ? await replaceProductImages(updatedProduct.id, values.images)
        : await fetchProductImages(updatedProduct.id);
      const sizes = await fetchProductSizes(updatedProduct.id);
      const productWithImages = { ...updatedProduct, images, sizes };

      syncProductInBackground(store, productWithImages);

      res.status(200).json({
        product: productWithImages
      });
    } catch (err) {
      if (err.code === "23505") {
        throw createHttpError(409, "A product with this SKU already exists");
      }

      throw err;
    }
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const store = await getUserStore(req.user.id);

    try {
      const result = await query(
        "DELETE FROM products WHERE store_id = $1 AND id = $2 RETURNING id",
        [store.id, req.params.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          message: "Product was not found"
        });
      }

      syncProductDeleteInBackground(store, req.params.id);

      return res.status(200).json({
        message: "Product deleted"
      });
    } catch (err) {
      if (err.code === "23503") {
        throw createHttpError(
          409,
          "This product is linked to orders and cannot be deleted"
        );
      }

      throw err;
    }
  })
);

export default router;
