import { query } from "../config/db.js";

const GRAPH_API_VERSION = "v20.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const BATCH_LIMIT = 4500;

function getPublicBaseUrl() {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.CLIENT_BASE_URL ||
    "http://localhost:5173"
  );
}

function toMinorUnits(value) {
  return Math.round(Number(value || 0) * 100);
}

function buildProductData(store, product) {
  const price = toMinorUnits(product.discount_price || product.price);
  const inStock = Number(product.stock_quantity) > 0;
  const baseUrl = getPublicBaseUrl();
  const gallery = Array.isArray(product.images) ? product.images : [];
  const primaryImage =
    product.image_url || gallery[0] || `${baseUrl}/placeholder.png`;
  const additionalImages = gallery
    .filter((url) => url && url !== primaryImage)
    .slice(0, 10);

  const data = {
    availability: inStock ? "in stock" : "out of stock",
    brand: store.name,
    category: product.category || "General",
    condition: "new",
    description: product.description || product.name,
    image_url: primaryImage,
    name: product.name,
    price: String(price),
    currency: store.meta_currency || "LKR",
    url: `${baseUrl}/store/${store.slug}/product/${product.id}`
  };

  if (additionalImages.length > 0) {
    data.additional_image_urls = additionalImages;
  }

  return data;
}

function buildRequest(store, product) {
  if (!product.is_active || product.is_active === false) {
    return { method: "DELETE", retailer_id: product.id };
  }

  return {
    method: "UPDATE",
    retailer_id: product.id,
    data: buildProductData(store, product)
  };
}

export function isCatalogConfigured(store) {
  return Boolean(store && store.meta_catalog_id && store.meta_access_token);
}

async function callBatch(store, requests) {
  const url = `${GRAPH_API_BASE}/${encodeURIComponent(
    store.meta_catalog_id
  )}/items_batch`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: store.meta_access_token,
      item_type: "PRODUCT_ITEM",
      allow_upsert: true,
      requests
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const message =
      data.error?.error_user_msg ||
      data.error?.message ||
      `Meta API error ${response.status}`;
    const error = new Error(message);
    error.metaError = data.error;
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

async function recordSyncResult(storeId, error) {
  if (error) {
    await query(
      "UPDATE stores SET meta_last_sync_error = $1 WHERE id = $2",
      [String(error.message || error).slice(0, 500), storeId]
    );
  } else {
    await query(
      "UPDATE stores SET meta_last_sync_at = now(), meta_last_sync_error = NULL WHERE id = $1",
      [storeId]
    );
  }
}

export function syncProductInBackground(store, product) {
  if (!isCatalogConfigured(store)) {
    return;
  }

  callBatch(store, [buildRequest(store, product)])
    .then(() => recordSyncResult(store.id, null))
    .catch((err) => {
      console.error("Meta catalog sync failed:", err.message);
      return recordSyncResult(store.id, err).catch(() => {});
    });
}

export function syncProductDeleteInBackground(store, productId) {
  if (!isCatalogConfigured(store)) {
    return;
  }

  callBatch(store, [{ method: "DELETE", retailer_id: productId }])
    .then(() => recordSyncResult(store.id, null))
    .catch((err) => {
      console.error("Meta catalog delete-sync failed:", err.message);
      return recordSyncResult(store.id, err).catch(() => {});
    });
}

export async function syncAllProducts(store, products) {
  if (!isCatalogConfigured(store)) {
    const error = new Error("WhatsApp catalog is not connected");
    error.statusCode = 400;
    throw error;
  }

  const requests = products.map((product) => buildRequest(store, product));

  if (requests.length === 0) {
    await recordSyncResult(store.id, null);
    return { synced: 0, batches: 0 };
  }

  let batches = 0;

  try {
    for (let i = 0; i < requests.length; i += BATCH_LIMIT) {
      const chunk = requests.slice(i, i + BATCH_LIMIT);
      await callBatch(store, chunk);
      batches += 1;
    }

    await recordSyncResult(store.id, null);
    return { synced: requests.length, batches };
  } catch (err) {
    await recordSyncResult(store.id, err);
    throw err;
  }
}
