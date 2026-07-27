const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

export function getStoredToken() {
  return localStorage.getItem("kadecloud_token");
}

export function getStoredUser() {
  const user = localStorage.getItem("kadecloud_user");

  if (!user) {
    return null;
  }

  try {
    return JSON.parse(user);
  } catch (_err) {
    localStorage.removeItem("kadecloud_user");
    return null;
  }
}

export function getStoredAdminSession() {
  const session = localStorage.getItem("kadecloud_admin_session");

  if (!session) {
    return null;
  }

  try {
    return JSON.parse(session);
  } catch (_err) {
    localStorage.removeItem("kadecloud_admin_session");
    return null;
  }
}

export function storeToken(token) {
  localStorage.setItem("kadecloud_token", token);
}

export function storeUser(user) {
  localStorage.setItem("kadecloud_user", JSON.stringify(user));
}

export function clearStoredToken() {
  localStorage.removeItem("kadecloud_token");
  localStorage.removeItem("kadecloud_user");
  localStorage.removeItem("kadecloud_admin_session");
}

export function storeAdminSession(session) {
  localStorage.setItem("kadecloud_admin_session", JSON.stringify(session));
}

export function clearStoredAdminSession() {
  localStorage.removeItem("kadecloud_admin_session");
}

function getStoredShopperToken() {
  return localStorage.getItem("kadecloud_shopper_token");
}

export async function apiRequest(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };

  // Shopper endpoints always use the shopper token. Public endpoints can
  // optionally use it too (so /api/public/orders links the order to the
  // signed-in shopper).
  const wantShopper =
    options.useShopperToken === true ||
    path.startsWith("/shoppers") ||
    (options.useShopperToken !== false && path.startsWith("/public"));

  if (wantShopper) {
    const shopperToken = getStoredShopperToken();
    if (shopperToken) {
      headers.Authorization = `Bearer ${shopperToken}`;
    }
  } else if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    error.errors = data.errors || [];
    throw error;
  }

  return data;
}

export const authApi = {
  register(payload) {
    return apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  login(payload) {
    return apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  me() {
    return apiRequest("/auth/me");
  },
  forgotPassword(email) {
    return apiRequest("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  },
  resetPassword(token, password) {
    return apiRequest("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password })
    });
  },
  verifyEmail(token) {
    return apiRequest(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  },
  resendVerification() {
    return apiRequest("/auth/resend-verification", { method: "POST" });
  }
};

function buildQueryString(params) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export const productsApi = {
  list(filters = {}) {
    return apiRequest(`/products${buildQueryString(filters)}`);
  },
  create(payload) {
    return apiRequest("/products", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  get(id) {
    return apiRequest(`/products/${id}`);
  },
  update(id, payload) {
    return apiRequest(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  remove(id) {
    return apiRequest(`/products/${id}`, {
      method: "DELETE"
    });
  }
};

export const uploadsApi = {
  productImage(payload) {
    return apiRequest("/uploads/product-image", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  logo(payload) {
    return apiRequest("/uploads/logo", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  favicon(payload) {
    return apiRequest("/uploads/favicon", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};

export const ordersApi = {
  list() {
    return apiRequest("/orders");
  },
  get(id) {
    return apiRequest(`/orders/${id}`);
  },
  updateStatus(id, status) {
    return apiRequest(`/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });
  },
  updateCodStatus(id, cod_status) {
    return apiRequest(`/orders/${id}/cod-status`, {
      method: "PUT",
      body: JSON.stringify({ cod_status })
    });
  },
  updateNotes(id, seller_notes) {
    return apiRequest(`/orders/${id}/notes`, {
      method: "PUT",
      body: JSON.stringify({ seller_notes })
    });
  }
};

export const customersApi = {
  list() {
    return apiRequest("/customers");
  },
  get(id) {
    return apiRequest(`/customers/${id}`);
  }
};

export const inventoryApi = {
  list() {
    return apiRequest("/inventory");
  },
  adjust(payload) {
    return apiRequest("/inventory/adjust", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  logs() {
    return apiRequest("/inventory/logs");
  }
};

export const adminApi = {
  listStores() {
    return apiRequest("/admin/stores");
  },
  updateStoreDomains(storeId, payload) {
    return apiRequest(`/admin/stores/${storeId}/domains`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  listAccounts() {
    return apiRequest("/admin/accounts");
  },
  createAccount(payload) {
    return apiRequest("/admin/accounts", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  loginAs(accountId) {
    return apiRequest(`/admin/accounts/${accountId}/login-as`, {
      method: "POST"
    });
  },
  getSettings() {
    return apiRequest("/admin/settings");
  },
  updateSettings(payload) {
    return apiRequest("/admin/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }
};

export const currenciesApi = {
  list() {
    return apiRequest("/public/currencies");
  }
};

export const posApi = {
  createSale(payload) {
    return apiRequest("/pos/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};

export const shoppersApi = {
  google(idToken) {
    return apiRequest("/shoppers/auth/google", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken })
    });
  },
  register(payload) {
    return apiRequest("/shoppers/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  login(payload) {
    return apiRequest("/shoppers/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  me() {
    return apiRequest("/shoppers/me");
  },
  update(payload) {
    return apiRequest("/shoppers/me", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  orders(storeSlug) {
    const qs = storeSlug
      ? `?store_slug=${encodeURIComponent(storeSlug)}`
      : "";
    return apiRequest(`/shoppers/me/orders${qs}`);
  },
  forgotPassword(email, storeSlug = "") {
    return apiRequest("/shoppers/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email, store_slug: storeSlug })
    });
  },
  resetPassword(token, password) {
    return apiRequest("/shoppers/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password })
    });
  },
  verifyEmail(token) {
    return apiRequest(
      `/shoppers/auth/verify-email?token=${encodeURIComponent(token)}`
    );
  },
  resendVerification(storeSlug = "") {
    return apiRequest("/shoppers/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ store_slug: storeSlug })
    });
  }
};

export const categoriesApi = {
  list() {
    return apiRequest("/categories");
  },
  create(payload) {
    return apiRequest("/categories", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  update(id, payload) {
    return apiRequest(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  remove(id) {
    return apiRequest(`/categories/${id}`, {
      method: "DELETE"
    });
  }
};

export const publicCategoriesApi = {
  list(slug) {
    return apiRequest(`/public/stores/${slug}/categories`);
  }
};

export const storesApi = {
  me() {
    return apiRequest("/stores/me");
  },
  update(payload) {
    return apiRequest("/stores/me", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  connectCatalog(payload) {
    return apiRequest("/stores/me/meta-catalog", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  getMine() {
    return apiRequest("/stores/me");
  },
  updateMine(payload) {
    return apiRequest("/stores/me", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  syncCatalog() {
    return apiRequest("/stores/me/sync-catalog", { method: "POST" });
  },
  disconnectCatalog() {
    return apiRequest("/stores/me/meta-catalog", { method: "DELETE" });
  }
};

export const publicStoreApi = {
  resolveByHost(host) {
    return apiRequest(
      `/public/store-by-host?host=${encodeURIComponent(host)}`
    );
  },
  getStore(slug) {
    return apiRequest(`/public/stores/${slug}`);
  },
  listProducts(slug, filters = {}) {
    return apiRequest(
      `/public/stores/${slug}/products${buildQueryString(filters)}`
    );
  },
  getProduct(slug, productId) {
    return apiRequest(`/public/stores/${slug}/products/${productId}`);
  }
};

export const publicOrdersApi = {
  create(payload) {
    return apiRequest("/public/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  track(orderNumber) {
    return apiRequest(`/public/track/${encodeURIComponent(orderNumber)}`);
  }
};
