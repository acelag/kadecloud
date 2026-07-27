import { Edit, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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

function ProductsListPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
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
        category_id: categoryId,
        status
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
  }, [search, categoryId, status]);

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

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
          <label className="relative block">
            <Search
              aria-hidden="true"
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Search by product name"
            />
          </label>

          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No products found. Add your first product to start building the
            storefront.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {products.map((product) => (
              <article
                key={product.id}
                className="grid gap-4 p-4 lg:grid-cols-[72px_1fr_150px_140px_150px] lg:items-center"
              >
                <div className="h-16 w-16 overflow-hidden rounded-md bg-slate-100">
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
                    <h3 className="font-bold text-slate-950">{product.name}</h3>
                    {isLowStock(product) ? (
                      <StatusBadge tone="warning">Low stock</StatusBadge>
                    ) : null}
                    <StatusBadge tone={product.is_active ? "success" : "neutral"}>
                      {product.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                    {product.cod_available ? (
                      <StatusBadge tone="info">COD</StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {product.sku || "No SKU"} · {product.category || "Uncategorized"}
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
                  <p className="text-xs text-slate-400">
                    Alert at {product.low_stock_threshold}
                  </p>
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
            ))}
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
