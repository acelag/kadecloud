import { Edit, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { categoriesApi, productsApi } from "../api/client.js";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";

function formatMoney(value) {
  return `LKR ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function isLowStock(product) {
  return (
    Number(product.low_stock_threshold) > 0 &&
    Number(product.stock_quantity) <= Number(product.low_stock_threshold)
  );
}

function StatCard({ title, value, valueClass = "text-slate-950" }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className={`mt-3 text-3xl font-bold tracking-normal ${valueClass}`}>
        {value}
      </p>
    </article>
  );
}

function StatusPill({ active }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "low_stock", label: "Low stock" }
];

function ProductsListPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let isMounted = true;
    categoriesApi
      .list()
      .then((data) => {
        if (isMounted) setCategories(data.categories || []);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError("");

    try {
      const data = await productsApi.list({
        search,
        category_id: categoryId
      });
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message || "Unable to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadProducts();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [search, categoryId]);

  const stats = useMemo(() => {
    const counts = {
      all: products.length,
      active: 0,
      inactive: 0,
      low_stock: 0
    };
    let outOfStock = 0;
    for (const product of products) {
      if (product.is_active) counts.active += 1;
      else counts.inactive += 1;
      if (isLowStock(product)) counts.low_stock += 1;
      if (Number(product.stock_quantity) === 0) outOfStock += 1;
    }
    return { counts, outOfStock };
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (statusFilter === "active") return product.is_active;
      if (statusFilter === "inactive") return !product.is_active;
      if (statusFilter === "low_stock") return isLowStock(product);
      return true;
    });
  }, [products, statusFilter]);

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      await productsApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      await loadProducts();
    } catch (err) {
      setError(err.message || "Unable to delete product");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Products
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
            Manage products
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Add products, track stock, and control storefront availability.
          </p>
        </div>
        <Link
          to="/dashboard/products/new"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          <Plus aria-hidden="true" size={18} />
          Add product
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total products" value={stats.counts.all} />
        <StatCard
          title="Active"
          value={stats.counts.active}
          valueClass="text-emerald-600"
        />
        <StatCard
          title="Low stock"
          value={stats.counts.low_stock}
          valueClass="text-amber-600"
        />
        <StatCard
          title="Out of stock"
          value={stats.outOfStock}
          valueClass="text-rose-600"
        />
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:flex-1">
            <Search
              aria-hidden="true"
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder="Search by product name"
            />
          </div>

          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 lg:w-56"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.key;
            const count = stats.counts[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.label}
                <span
                  className={`text-xs font-bold ${
                    isActive ? "text-indigo-100" : "text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            {products.length === 0
              ? "No products found. Add your first product to start building the storefront."
              : "No products match your search or filter."}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredProducts.map((product) => {
              const outOfStock = Number(product.stock_quantity) === 0;
              const low = isLowStock(product);
              return (
                <article
                  key={product.id}
                  className="grid gap-4 p-4 lg:grid-cols-[56px_minmax(0,1fr)_150px_130px_120px_96px] lg:items-center"
                >
                  <div className="h-14 w-14 overflow-hidden rounded-md bg-slate-100">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
                        IMG
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-950">
                        {product.name}
                      </h3>
                      {product.cod_available ? (
                        <StatusBadge tone="info">COD</StatusBadge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {product.sku || "No SKU"} ·{" "}
                      {product.category || "Uncategorized"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">Price</p>
                    <p className="font-semibold text-slate-950">
                      {formatMoney(product.discount_price || product.price)}
                    </p>
                    {product.discount_price ? (
                      <p className="text-xs text-slate-400 line-through">
                        {formatMoney(product.price)}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">Stock</p>
                    <p className="font-semibold text-slate-950">
                      {product.stock_quantity}
                    </p>
                    {outOfStock ? (
                      <p className="text-xs font-medium text-rose-600">
                        Out of stock
                      </p>
                    ) : low ? (
                      <p className="text-xs font-medium text-amber-600">
                        Low · alert at {product.low_stock_threshold}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Alert at {product.low_stock_threshold}
                      </p>
                    )}
                  </div>

                  <div className="lg:flex lg:justify-start">
                    <StatusPill active={product.is_active} />
                  </div>

                  <div className="flex gap-2 lg:justify-end">
                    <Link
                      to={`/dashboard/products/${product.id}/edit`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                      aria-label={`Edit ${product.name}`}
                    >
                      <Edit aria-hidden="true" size={17} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(product)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-rose-200 text-rose-700 transition hover:bg-rose-50"
                      aria-label={`Delete ${product.name}`}
                    >
                      <Trash2 aria-hidden="true" size={17} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-950">Delete product</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Delete {deleteTarget.name}? This removes it from your store
              products.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="h-10 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ProductsListPage;
