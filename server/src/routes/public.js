import express from "express";
import { getClient, query } from "../config/db.js";
import { config } from "../config/env.js";
import {
  sendNewOrderAlertEmail,
  sendOrderConfirmationEmail
} from "../services/email.js";
import { refreshCustomerRisk } from "../utils/customerRisk.js";
import { attachOptionalShopper } from "./shoppers.js";
import {
  SUPPORTED_CURRENCIES,
  getCurrencyRates
} from "../utils/currencyRates.js";
import {
  buildCheckoutHash,
  checkoutUrl,
  verifyIpnHash
} from "../utils/payhere.js";

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
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
    (products.stock_quantity > 0) AS in_stock,
    (
      SELECT COALESCE(json_agg(pi.image_url ORDER BY pi.position), '[]'::json)
      FROM product_images pi
      WHERE pi.product_id = products.id
    ) AS gallery_images
  FROM products
  LEFT JOIN categories ON categories.id = products.category_id`;
}

// Public-facing sizes for a product: only active rows, in seller order, each
// with its own stock so the storefront can gate quantity per size.
async function fetchPublicSizes(productId) {
  const result = await query(
    `SELECT id, name AS label, stock_quantity
       FROM product_variants
      WHERE product_id = $1 AND is_active = true
      ORDER BY position ASC, name ASC`,
    [productId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    label: row.label,
    stock_quantity: Number(row.stock_quantity),
    in_stock: Number(row.stock_quantity) > 0
  }));
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toInteger(value, fallback = 1) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return Number.parseInt(value, 10);
}

function formatOrderNumber(sequenceValue) {
  return `KC-${String(sequenceValue).padStart(6, "0")}`;
}

function normalizeWhatsAppPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("0")) {
    return `94${digits.slice(1)}`;
  }

  return digits;
}

function buildWhatsAppLink(store, order, item) {
  const phone = normalizeWhatsAppPhone(store.whatsapp_phone || store.phone);

  if (!phone) {
    return null;
  }

  const message = [
    `Order ${order.order_number}`,
    `Store: ${store.name}`,
    `Product: ${item.product_name}`,
    `Quantity: ${item.quantity}`,
    `Total: Rs. ${Number(order.total_amount).toFixed(2)}`,
    `Customer: ${order.customer_name}`,
    `Phone: ${order.customer_phone}`,
    `Address: ${order.delivery_address}, ${order.delivery_city || ""}${
      order.delivery_district ? `, ${order.delivery_district}` : ""
    }`
  ].join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildTrackingWhatsAppLink(store, orderNumber) {
  const phone = normalizeWhatsAppPhone(store.whatsapp_phone || store.phone);

  if (!phone) {
    return null;
  }

  const message = `Hi, I want to ask about my KadeCloud order ${orderNumber}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

const ALLOWED_PAYMENT_METHODS = ["cod", "bank_transfer", "payhere"];
const MAX_CART_LINES = 50;

function normalizeOrderItems(body) {
  // New shape: items: [{ product_id, quantity }]
  if (Array.isArray(body.items)) {
    const cleaned = [];
    for (const raw of body.items) {
      if (!raw || typeof raw !== "object") continue;
      const productId = String(raw.product_id || "").trim();
      const qty = Number.parseInt(raw.quantity, 10);
      if (!productId) continue;
      cleaned.push({
        product_id: productId,
        product_variant_id: String(raw.product_variant_id || "").trim() || null,
        quantity: qty
      });
    }
    return cleaned;
  }
  // Legacy shape: product_id + quantity at the top level.
  if (body.product_id) {
    return [
      {
        product_id: String(body.product_id),
        product_variant_id:
          String(body.product_variant_id || "").trim() || null,
        quantity: toInteger(body.quantity, 1)
      }
    ];
  }
  return [];
}

function validateOrderBody(body) {
  const errors = [];
  const items = normalizeOrderItems(body);
  const customerName = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim().toLowerCase() || null;
  const address = String(body.address || "").trim();
  const city = String(body.city || "").trim();
  const district = String(body.district || "").trim();
  const paymentMethod = String(body.payment_method || "cod").trim();
  const paymentReference = String(body.payment_reference || "").trim() || null;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Email address is not valid");
  }

  if (!body.store_slug) {
    errors.push("Store slug is required");
  }

  if (items.length === 0) {
    errors.push("Cart must contain at least one item");
  } else if (items.length > MAX_CART_LINES) {
    errors.push(`Cart cannot exceed ${MAX_CART_LINES} items`);
  } else {
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        errors.push("Each item quantity must be a positive integer");
        break;
      }
    }
  }

  if (!customerName) errors.push("Customer name is required");
  if (!phone) errors.push("Phone number is required");
  if (!address) errors.push("Address is required");
  if (!city) errors.push("City is required");
  if (!district) errors.push("District is required");

  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    errors.push(
      `Payment method must be one of: ${ALLOWED_PAYMENT_METHODS.join(", ")}`
    );
  }

  if (paymentReference && paymentReference.length > 120) {
    errors.push("Payment reference must be 120 characters or fewer");
  }

  return {
    errors,
    values: {
      store_slug: String(body.store_slug || "").trim(),
      items,
      // Kept for the single-item legacy variant context (notes/labels).
      selected_variant: String(body.selected_variant || "").trim() || null,
      name: customerName,
      email,
      phone,
      address,
      city,
      district,
      notes: String(body.notes || "").trim() || null,
      payment_method: paymentMethod,
      payment_reference: paymentReference
    }
  };
}

async function getPublicStore(slug) {
  const result = await query(
    `SELECT
      id,
      name,
      slug,
      category,
      description,
      phone,
      whatsapp_phone,
      city,
      district,
      logo_url,
      favicon_url,
      logo_size,
      default_currency,
      storefront_card_aspect,
      storefront_products_per_row,
      announcement_text,
      bank_transfer_enabled,
      bank_account_name,
      bank_account_number,
      bank_name,
      bank_branch,
      bank_transfer_instructions,
      payhere_enabled
    FROM stores
    WHERE slug = $1 AND is_active = true
    LIMIT 1`,
    [slug]
  );

  const row = result.rows[0];
  if (!row) return null;

  // Redact bank details when the toggle is off.
  if (!row.bank_transfer_enabled) {
    row.bank_account_name = null;
    row.bank_account_number = null;
    row.bank_name = null;
    row.bank_branch = null;
    row.bank_transfer_instructions = null;
  }

  // Only expose PayHere if both the store toggle AND platform credentials are set.
  row.payhere_enabled = Boolean(row.payhere_enabled) && config.payhere.enabled;

  return row;
}

async function getPlatformDefaultCurrency() {
  const result = await query(
    "SELECT value FROM platform_settings WHERE key = 'default_currency' LIMIT 1"
  );
  return result.rowCount > 0 ? result.rows[0].value : "LKR";
}

function bareHost(rawHost) {
  return String(rawHost || "").trim().toLowerCase().split(":")[0];
}

function isPlatformHost(host) {
  const list = (process.env.PLATFORM_HOSTS || "localhost,127.0.0.1,0.0.0.0")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(host);
}

router.get(
  "/store-by-host",
  asyncHandler(async (req, res) => {
    const host = bareHost(req.query.host || "");

    if (!host) {
      return res.status(400).json({ message: "host query parameter is required" });
    }

    if (isPlatformHost(host)) {
      return res.status(404).json({ message: "Platform host, not a store" });
    }

    const columns = "id, slug, name, subdomain, custom_domain, admin_domain";

    // 1. Exact storefront custom domain match wins (case-insensitive).
    const customMatch = await query(
      `SELECT ${columns}
         FROM stores
        WHERE LOWER(custom_domain) = $1 AND is_active = true
        LIMIT 1`,
      [host]
    );

    if (customMatch.rowCount > 0) {
      return res.status(200).json({
        store: {
          ...customMatch.rows[0],
          matched: "custom_domain",
          surface: "storefront"
        }
      });
    }

    // 2. Exact admin domain match → serve the seller dashboard surface.
    const adminMatch = await query(
      `SELECT ${columns}
         FROM stores
        WHERE LOWER(admin_domain) = $1 AND is_active = true
        LIMIT 1`,
      [host]
    );

    if (adminMatch.rowCount > 0) {
      return res.status(200).json({
        store: {
          ...adminMatch.rows[0],
          matched: "admin_domain",
          surface: "admin"
        }
      });
    }

    // 3. Otherwise match on the leftmost label as a platform subdomain
    //    (storefront surface).
    const subdomain = host.split(".")[0];
    if (subdomain) {
      const subMatch = await query(
        `SELECT ${columns}
           FROM stores
          WHERE LOWER(subdomain) = $1 AND is_active = true
          LIMIT 1`,
        [subdomain]
      );

      if (subMatch.rowCount > 0) {
        return res.status(200).json({
          store: {
            ...subMatch.rows[0],
            matched: "subdomain",
            surface: "storefront"
          }
        });
      }
    }

    return res.status(404).json({ message: "No store matches this host" });
  })
);

router.get(
  "/currencies",
  asyncHandler(async (_req, res) => {
    const rates = await getCurrencyRates();
    const platformDefault = await getPlatformDefaultCurrency();
    return res.status(200).json({
      currencies: SUPPORTED_CURRENCIES,
      platform_default_currency: platformDefault,
      ...rates
    });
  })
);

router.get(
  "/track/:orderNumber",
  asyncHandler(async (req, res) => {
    const orderNumber = String(req.params.orderNumber || "").trim().toUpperCase();

    if (!orderNumber) {
      return res.status(400).json({
        message: "Order number is required"
      });
    }

    const orderResult = await query(
      `SELECT
        orders.id,
        orders.order_number,
        orders.status,
        orders.cod_status,
        orders.payment_method,
        orders.payment_reference,
        orders.total_amount,
        orders.created_at,
        orders.updated_at,
        stores.name AS store_name,
        stores.slug AS store_slug,
        stores.phone AS store_phone,
        stores.whatsapp_phone AS store_whatsapp_phone,
        stores.bank_transfer_enabled,
        stores.bank_account_name,
        stores.bank_account_number,
        stores.bank_name,
        stores.bank_branch,
        stores.bank_transfer_instructions
       FROM orders
       INNER JOIN stores ON stores.id = orders.store_id
       WHERE orders.order_number = $1 AND stores.is_active = true
       LIMIT 1`,
      [orderNumber]
    );

    if (orderResult.rowCount === 0) {
      return res.status(404).json({
        message: "Order was not found"
      });
    }

    const order = orderResult.rows[0];
    const timelineResult = await query(
      `SELECT id, status, note, created_at
       FROM delivery_updates
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [order.id]
    );

    const bankDetails =
      order.payment_method === "bank_transfer" && order.bank_transfer_enabled
        ? {
            bank_account_name: order.bank_account_name,
            bank_account_number: order.bank_account_number,
            bank_name: order.bank_name,
            bank_branch: order.bank_branch,
            bank_transfer_instructions: order.bank_transfer_instructions
          }
        : null;

    return res.status(200).json({
      order: {
        order_number: order.order_number,
        status: order.status,
        cod_status: order.cod_status,
        payment_method: order.payment_method,
        payment_reference: order.payment_reference,
        total_amount: order.total_amount,
        created_at: order.created_at,
        updated_at: order.updated_at
      },
      store: {
        name: order.store_name,
        slug: order.store_slug,
        phone: order.store_phone,
        whatsapp_phone: order.store_whatsapp_phone,
        bank_details: bankDetails
      },
      timeline: timelineResult.rows,
      contact_whatsapp_link: buildTrackingWhatsAppLink(
        {
          phone: order.store_phone,
          whatsapp_phone: order.store_whatsapp_phone
        },
        order.order_number
      )
    });
  })
);

router.get(
  "/stores/:slug",
  asyncHandler(async (req, res) => {
    const store = await getPublicStore(req.params.slug);

    if (!store) {
      return res.status(404).json({
        message: "Store was not found"
      });
    }

    return res.status(200).json({ store });
  })
);

router.get(
  "/stores/:slug/categories",
  asyncHandler(async (req, res) => {
    const store = await getPublicStore(req.params.slug);

    if (!store) {
      return res.status(404).json({
        message: "Store was not found"
      });
    }

    const result = await query(
      `SELECT
         c.id,
         c.name,
         c.slug,
         c.position,
         COUNT(p.id) FILTER (WHERE p.is_active = true) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       WHERE c.store_id = $1
       GROUP BY c.id
       HAVING COUNT(p.id) FILTER (WHERE p.is_active = true) > 0
       ORDER BY c.position ASC, c.name ASC`,
      [store.id]
    );

    return res.status(200).json({
      store,
      categories: result.rows.map((row) => ({
        ...row,
        product_count: Number(row.product_count || 0)
      }))
    });
  })
);

router.get(
  "/stores/:slug/products",
  asyncHandler(async (req, res) => {
    const store = await getPublicStore(req.params.slug);

    if (!store) {
      return res.status(404).json({
        message: "Store was not found"
      });
    }

    const params = [store.id];
    const where = ["products.store_id = $1", "products.is_active = true"];

    if (req.query.search) {
      params.push(`%${String(req.query.search).trim()}%`);
      where.push(`products.name ILIKE $${params.length}`);
    }

    if (req.query.category_id) {
      params.push(String(req.query.category_id).trim());
      where.push(`products.category_id = $${params.length}`);
    }

    // Filter on the effective (post-discount) price the shopper actually pays.
    const minPrice = Number.parseFloat(req.query.min_price);
    if (Number.isFinite(minPrice)) {
      params.push(minPrice);
      where.push(`COALESCE(products.discount_price, products.price) >= $${params.length}`);
    }

    const maxPrice = Number.parseFloat(req.query.max_price);
    if (Number.isFinite(maxPrice)) {
      params.push(maxPrice);
      where.push(`COALESCE(products.discount_price, products.price) <= $${params.length}`);
    }

    if (String(req.query.in_stock) === "true") {
      where.push("products.stock_quantity > 0");
    }

    // Size filter: products that have this size active and in stock.
    if (req.query.size) {
      params.push(String(req.query.size).trim());
      where.push(
        `EXISTS (
          SELECT 1 FROM product_variants pv
          WHERE pv.product_id = products.id
            AND pv.is_active = true
            AND pv.stock_quantity > 0
            AND LOWER(pv.name) = LOWER($${params.length})
        )`
      );
    }

    const sortOptions = {
      newest: "products.updated_at DESC",
      price_asc: "COALESCE(products.discount_price, products.price) ASC",
      price_desc: "COALESCE(products.discount_price, products.price) DESC",
      name: "products.name ASC"
    };
    const orderBy = sortOptions[req.query.sort] || sortOptions.newest;

    const result = await query(
      `${productSelectSql()}
       WHERE ${where.join(" AND ")}
       ORDER BY ${orderBy}`,
      params
    );

    // Distinct sizes across the store's active, in-stock products — powers the
    // storefront size filter. Ordered by the seller's position, then label.
    const sizesResult = await query(
      `SELECT pv.name AS label, MIN(pv.position) AS pos
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
        WHERE p.store_id = $1
          AND p.is_active = true
          AND pv.is_active = true
          AND pv.stock_quantity > 0
        GROUP BY pv.name
        ORDER BY pos ASC, label ASC`,
      [store.id]
    );

    return res.status(200).json({
      store,
      products: result.rows,
      available_sizes: sizesResult.rows.map((row) => row.label)
    });
  })
);

router.get(
  "/stores/:slug/products/:productId",
  asyncHandler(async (req, res) => {
    const store = await getPublicStore(req.params.slug);

    if (!store) {
      return res.status(404).json({
        message: "Store was not found"
      });
    }

    const result = await query(
      `${productSelectSql()}
       WHERE products.store_id = $1 AND products.id = $2 AND products.is_active = true
       LIMIT 1`,
      [store.id, req.params.productId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Product was not found"
      });
    }

    const imagesResult = await query(
      `SELECT image_url FROM product_images
       WHERE product_id = $1 ORDER BY position ASC`,
      [req.params.productId]
    );
    const sizes = await fetchPublicSizes(req.params.productId);

    return res.status(200).json({
      store,
      product: {
        ...result.rows[0],
        images: imagesResult.rows.map((row) => row.image_url),
        sizes
      }
    });
  })
);

router.post(
  "/orders",
  attachOptionalShopper,
  asyncHandler(async (req, res) => {
    const { errors, values } = validateOrderBody(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    const client = await getClient();

    try {
      await client.query("BEGIN");

      const storeResult = await client.query(
        `SELECT
          stores.id,
          stores.name,
          stores.slug,
          stores.phone,
          stores.whatsapp_phone,
          stores.default_currency,
          stores.bank_transfer_enabled,
          stores.bank_account_name,
          stores.bank_account_number,
          stores.bank_name,
          stores.bank_branch,
          stores.bank_transfer_instructions,
          stores.payhere_enabled,
          users.email AS seller_email
        FROM stores
        LEFT JOIN users ON users.id = stores.seller_id
        WHERE stores.slug = $1 AND stores.is_active = true
        LIMIT 1`,
        [values.store_slug]
      );

      if (storeResult.rowCount === 0) {
        throw createHttpError(404, "Store was not found");
      }

      const store = storeResult.rows[0];

      if (
        values.payment_method === "bank_transfer" &&
        !store.bank_transfer_enabled
      ) {
        throw createHttpError(
          400,
          "Bank transfer is not available for this store"
        );
      }

      const payhereAvailable =
        Boolean(store.payhere_enabled) && config.payhere.enabled;

      if (values.payment_method === "payhere" && !payhereAvailable) {
        throw createHttpError(
          400,
          "Online payment is not available for this store"
        );
      }

      // Aggregate duplicate lines the client may have sent, keyed by product
      // AND chosen size — the same product in two sizes stays two lines.
      const aggregated = new Map();
      for (const line of values.items) {
        const key = `${line.product_id}::${line.product_variant_id || ""}`;
        const existing = aggregated.get(key);
        if (existing) {
          existing.quantity += line.quantity;
        } else {
          aggregated.set(key, {
            product_id: line.product_id,
            product_variant_id: line.product_variant_id || null,
            quantity: line.quantity
          });
        }
      }

      const productIds = Array.from(
        new Set(Array.from(aggregated.values()).map((line) => line.product_id))
      );

      // Lock and load every product in one shot, ordered for deadlock safety.
      const productsResult = await client.query(
        `SELECT id, store_id, name, price, discount_price,
                stock_quantity, cod_available, is_active
           FROM products
          WHERE store_id = $1 AND id = ANY($2::uuid[])
          ORDER BY id
          FOR UPDATE`,
        [store.id, productIds]
      );

      if (productsResult.rowCount !== productIds.length) {
        throw createHttpError(
          404,
          "One or more products in your cart are no longer available"
        );
      }

      const productById = new Map(
        productsResult.rows.map((row) => [row.id, row])
      );

      // Lock the active sizes for those products so stock checks are race-safe.
      const variantsResult = await client.query(
        `SELECT id, product_id, name, stock_quantity
           FROM product_variants
          WHERE product_id = ANY($1::uuid[]) AND is_active = true
          ORDER BY id
          FOR UPDATE`,
        [productIds]
      );
      const variantById = new Map(
        variantsResult.rows.map((row) => [row.id, row])
      );
      const productHasSizes = new Set(
        variantsResult.rows.map((row) => row.product_id)
      );

      const lineItems = [];
      let subtotal = 0;

      for (const line of aggregated.values()) {
        const product = productById.get(line.product_id);
        const { quantity } = line;

        if (!product.is_active) {
          throw createHttpError(400, `${product.name} is no longer available`);
        }
        if (values.payment_method === "cod" && !product.cod_available) {
          throw createHttpError(
            400,
            `${product.name} cannot be paid by COD; remove it or switch payment`
          );
        }

        // Resolve the chosen size, if any, and enforce size selection for
        // products that have sizes.
        let variant = null;
        if (line.product_variant_id) {
          variant = variantById.get(line.product_variant_id);
          if (!variant || variant.product_id !== product.id) {
            throw createHttpError(
              400,
              `The selected size for ${product.name} is no longer available`
            );
          }
        } else if (productHasSizes.has(product.id)) {
          throw createHttpError(400, `Please choose a size for ${product.name}`);
        }

        const availableStock = variant
          ? Number(variant.stock_quantity)
          : Number(product.stock_quantity);
        const stockLabel = variant
          ? `${product.name} (${variant.name})`
          : product.name;

        if (availableStock <= 0) {
          throw createHttpError(400, `${stockLabel} is out of stock`);
        }
        if (quantity > availableStock) {
          throw createHttpError(
            400,
            `${stockLabel}: only ${availableStock} in stock`
          );
        }

        const unitPrice = Number(product.discount_price || product.price);
        const lineTotal = unitPrice * quantity;
        subtotal += lineTotal;
        lineItems.push({
          product,
          variant,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal
        });
      }

      const shopperId = req.shopper?.id || null;
      const customerResult = await client.query(
        `INSERT INTO customers (
          store_id,
          name,
          phone,
          address,
          city,
          district,
          shopper_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (store_id, phone)
        DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          district = EXCLUDED.district,
          shopper_id = COALESCE(EXCLUDED.shopper_id, customers.shopper_id)
        RETURNING id`,
        [
          store.id,
          values.name,
          values.phone,
          values.address,
          values.city,
          values.district,
          shopperId
        ]
      );

      const sequenceResult = await client.query(
        "SELECT nextval('kadecloud_order_number_seq') AS sequence_value"
      );
      const orderNumber = formatOrderNumber(
        sequenceResult.rows[0].sequence_value
      );

      const orderResult = await client.query(
        `INSERT INTO orders (
          store_id,
          customer_id,
          order_number,
          status,
          cod_status,
          delivery_status,
          payment_method,
          customer_name,
          customer_phone,
          customer_email,
          delivery_address,
          delivery_city,
          delivery_district,
          subtotal,
          delivery_fee,
          total_amount,
          notes,
          payment_reference
        )
        VALUES (
          $1,
          $2,
          $3,
          'new',
          'not_verified',
          'not_dispatched',
          $11,
          $4,
          $5,
          $13,
          $6,
          $7,
          $8,
          $9,
          0,
          $9,
          $10,
          $12
        )
        RETURNING
          id,
          order_number,
          status,
          cod_status,
          delivery_status,
          payment_method,
          customer_name,
          customer_phone,
          customer_email,
          delivery_address,
          delivery_city,
          delivery_district,
          subtotal,
          delivery_fee,
          total_amount,
          notes,
          seller_notes,
          stock_reduced_at,
          payment_reference,
          created_at`,
        [
          store.id,
          customerResult.rows[0].id,
          orderNumber,
          values.name,
          values.phone,
          values.address,
          values.city,
          values.district,
          subtotal,
          values.notes,
          values.payment_method,
          values.payment_reference,
          values.email  // $13
        ]
      );

      const insertedItems = [];
      for (const line of lineItems) {
        const itemResult = await client.query(
          `INSERT INTO order_items (
            order_id, product_id, product_variant_id, product_name,
            variant_name, unit_price, quantity, line_total
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, product_id, product_variant_id, product_name,
                    variant_name, unit_price, quantity, line_total`,
          [
            orderResult.rows[0].id,
            line.product.id,
            line.variant ? line.variant.id : null,
            line.product.name,
            line.variant ? line.variant.name : null,
            line.unit_price,
            line.quantity,
            line.line_total
          ]
        );
        insertedItems.push(itemResult.rows[0]);
      }

      await client.query(
        `UPDATE customers
        SET total_orders = total_orders + 1
        WHERE id = $1`,
        [customerResult.rows[0].id]
      );

      await refreshCustomerRisk(client, customerResult.rows[0].id);

      await client.query("COMMIT");

      const order = orderResult.rows[0];
      const firstItem = insertedItems[0];
      const currency = store.default_currency || "LKR";

      const bankDetails =
        order.payment_method === "bank_transfer" && store.bank_transfer_enabled
          ? {
              bank_account_name: store.bank_account_name,
              bank_account_number: store.bank_account_number,
              bank_name: store.bank_name,
              bank_branch: store.bank_branch,
              bank_transfer_instructions: store.bank_transfer_instructions
            }
          : null;

      // ── Fire transactional emails (non-blocking — never fail the response) ──
      const trackingUrl = `${config.publicBaseUrl}/track/${order.order_number}`;
      const adminOrderUrl = `${config.publicBaseUrl}/dashboard/orders/${order.id}`;

      // For PayHere orders we do NOT send a confirmation until the IPN arrives
      // (the shopper hasn't paid yet). For all other methods send immediately.
      const isPayhere = order.payment_method === "payhere";

      if (!isPayhere) {
        const buyerEmail = order.customer_email || req.shopper?.email || null;
        if (buyerEmail) {
          sendOrderConfirmationEmail({
            to: buyerEmail,
            order,
            items: insertedItems,
            store,
            currency,
            bankDetails,
            trackingUrl
          }).catch(() => {});
        }

        if (store.seller_email) {
          sendNewOrderAlertEmail({
            to: store.seller_email,
            order,
            items: insertedItems,
            store,
            currency,
            adminUrl: adminOrderUrl
          }).catch(() => {});
        }
      }

      // ── Build PayHere checkout params if needed ──
      let payhereParams = null;
      if (isPayhere && config.payhere.enabled) {
        const amount  = Number(order.total_amount).toFixed(2);
        const curr    = currency;
        const hash    = buildCheckoutHash({
          merchantId:     config.payhere.merchantId,
          merchantSecret: config.payhere.secret,
          orderId:        order.order_number,
          amount,
          currency:       curr
        });
        const returnBase = `${config.publicBaseUrl}/store/${values.store_slug}`;
        payhereParams = {
          checkout_url:    checkoutUrl(),
          merchant_id:     config.payhere.merchantId,
          return_url:      `${returnBase}/order-success`,
          cancel_url:      `${returnBase}/checkout`,
          notify_url:      `${config.publicBaseUrl}/api/public/payhere/notify`,
          order_id:        order.order_number,
          items:           insertedItems.map((i) => i.product_name).join(", ").slice(0, 255),
          currency:        curr,
          amount,
          first_name:      (values.name.split(" ")[0] || values.name).slice(0, 50),
          last_name:       (values.name.split(" ").slice(1).join(" ") || "").slice(0, 50) || ".",
          email:           (order.customer_email || "noreply@kadecloud.lk").slice(0, 254),
          phone:           values.phone.slice(0, 20),
          address:         values.address.slice(0, 255),
          city:            values.city.slice(0, 128),
          country:         "Sri Lanka",
          hash
        };
      }

      return res.status(201).json({
        message: "Order created",
        order,
        items: insertedItems,
        bank_details: bankDetails,
        payhere: payhereParams,
        whatsapp_link: firstItem
          ? buildWhatsAppLink(store, order, firstItem)
          : null
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

// ── PayHere IPN (server-to-server notification) ─────────────────────────────
// PayHere POSTs to this URL when a payment status changes.
// We verify the hash, then mark the order paid / failed and send emails.
router.post(
  "/payhere/notify",
  asyncHandler(async (req, res) => {
    // PayHere expects a 200 OK response; never let errors bubble to the client.
    try {
      if (!config.payhere.enabled) {
        return res.sendStatus(200);
      }

      const {
        merchant_id,
        order_id,          // our order_number
        payhere_amount,
        payhere_currency,
        status_code,
        md: receivedHash
      } = req.body;

      // Reject if essential fields are missing.
      if (!merchant_id || !order_id || !status_code || !receivedHash) {
        return res.sendStatus(200);
      }

      // Verify hash.
      const valid = verifyIpnHash({
        merchantId:       config.payhere.merchantId,
        merchantSecret:   config.payhere.secret,
        orderId:          order_id,
        payhereAmount:    payhere_amount,
        payhereCurrency:  payhere_currency,
        statusCode:       status_code,
        receivedHash
      });

      if (!valid) {
        // Log for debugging but always return 200 so PayHere stops retrying.
        console.error("[PayHere IPN] Hash mismatch for order", order_id);
        return res.sendStatus(200);
      }

      const statusNum = Number(status_code);
      // status_code 2 = success; anything negative = failed/cancelled.
      const newPaymentStatus =
        statusNum === 2 ? "paid" : statusNum < 0 ? "failed" : null;

      if (!newPaymentStatus) {
        // Status 0 (pending) — no action needed.
        return res.sendStatus(200);
      }

      // Load the order.
      const orderResult = await query(
        `SELECT
           orders.id,
           orders.order_number,
           orders.status,
           orders.payment_method,
           orders.payment_status,
           orders.customer_name,
           orders.customer_phone,
           orders.customer_email,
           orders.delivery_address,
           orders.delivery_city,
           orders.delivery_district,
           orders.subtotal,
           orders.delivery_fee,
           orders.total_amount,
           orders.notes,
           orders.seller_notes,
           orders.stock_reduced_at,
           orders.payment_reference,
           orders.created_at,
           stores.id              AS store_id,
           stores.name            AS store_name,
           stores.slug            AS store_slug,
           stores.default_currency,
           users.email            AS seller_email
         FROM orders
         INNER JOIN stores ON stores.id = orders.store_id
         LEFT  JOIN users  ON users.id  = stores.seller_id
         WHERE orders.order_number = $1
           AND orders.payment_method = 'payhere'
         LIMIT 1`,
        [order_id]
      );

      if (orderResult.rowCount === 0) {
        console.error("[PayHere IPN] Order not found:", order_id);
        return res.sendStatus(200);
      }

      const order = orderResult.rows[0];

      // Idempotency: already processed.
      if (order.payment_status === newPaymentStatus) {
        return res.sendStatus(200);
      }

      // Update payment_status.
      await query(
        `UPDATE orders SET payment_status = $1 WHERE id = $2`,
        [newPaymentStatus, order.id]
      );

      // On success, fire confirmation emails.
      if (newPaymentStatus === "paid") {
        const currency   = order.default_currency || "LKR";
        const trackingUrl = `${config.publicBaseUrl}/track/${order.order_number}`;
        const adminUrl    = `${config.publicBaseUrl}/dashboard/orders/${order.id}`;

        // Fetch items for the email.
        const itemsResult = await query(
          `SELECT id, product_id, product_name, unit_price, quantity, line_total
           FROM order_items WHERE order_id = $1`,
          [order.id]
        );
        const items = itemsResult.rows;

        const buyerEmail = order.customer_email || null;
        if (buyerEmail) {
          sendOrderConfirmationEmail({
            to: buyerEmail,
            order,
            items,
            store: { name: order.store_name },
            currency,
            bankDetails: null,
            trackingUrl
          }).catch(() => {});
        }

        if (order.seller_email) {
          sendNewOrderAlertEmail({
            to: order.seller_email,
            order,
            items,
            store: { name: order.store_name, slug: order.store_slug },
            currency,
            adminUrl
          }).catch(() => {});
        }
      }

      return res.sendStatus(200);
    } catch (err) {
      // Always 200 so PayHere doesn't retry forever.
      console.error("[PayHere IPN] Unexpected error:", err);
      return res.sendStatus(200);
    }
  })
);

export default router;
