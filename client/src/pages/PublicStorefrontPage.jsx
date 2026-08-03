import { Search, Store, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { publicCategoriesApi, publicStoreApi } from "../api/client.js";
import AnnouncementBar from "../components/storefront/AnnouncementBar.jsx";
import CartIconLink from "../components/storefront/CartIconLink.jsx";
import CurrencySelector from "../components/storefront/CurrencySelector.jsx";
import HoverCarousel from "../components/storefront/HoverCarousel.jsx";
import ShopperHeaderMenu from "../components/storefront/ShopperHeaderMenu.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useCurrency } from "../context/CurrencyContext.jsx";
import { setFavicon } from "../utils/favicon.js";

// Static class lookups so Tailwind JIT picks them up at build time.
const STOREFRONT_LOGO_HEIGHT = {
  small: "h-8",
  medium: "h-10",
  large: "h-14"
};
const PRODUCT_GRID_COLUMNS = {
  1: "sm:grid-cols-1 lg:grid-cols-1",
  2: "sm:grid-cols-2 lg:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  5: "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
};

function PublicStorefrontPage({ slug: slugProp } = {}) {
  const params = useParams();
  const slug = slugProp || params.slug;
  const isHostStorefront = Boolean(slugProp);
  const storeBase = isHostStorefront ? "" : `/store/${slug}`;
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [size, setSize] = useState("");
  const [availableSizes, setAvailableSizes] = useState([]);
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasActiveFilters =
    Boolean(categoryId) ||
    Boolean(minPrice) ||
    Boolean(maxPrice) ||
    Boolean(size) ||
    inStockOnly ||
    sort !== "newest";

  function clearFilters() {
    setCategoryId("");
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    setSize("");
    setSort("newest");
  }
  const { formatFromSource, setStoreCurrency } = useCurrency();
  const { setActiveStoreSlug } = useCart();
  const storeBaseCurrency = store?.default_currency || "LKR";
  const productsPerRow = Number(store?.storefront_products_per_row) || 3;

  // Make the cart context aware of which store the shopper is browsing so
  // it loads the right cart from localStorage.
  useEffect(() => {
    setActiveStoreSlug(slug || null);
  }, [slug, setActiveStoreSlug]);
  const productGridClass =
    PRODUCT_GRID_COLUMNS[productsPerRow] || PRODUCT_GRID_COLUMNS[3];
  const cardAspect = String(store?.storefront_card_aspect || "4:3").replace(
    ":",
    " / "
  );

  useEffect(() => {
    setStoreCurrency(store?.default_currency || null);
    return () => setStoreCurrency(null);
  }, [store?.default_currency, setStoreCurrency]);

  // Brand the storefront browser tab with the store's favicon, when set.
  useEffect(() => {
    setFavicon(store?.favicon_url);
  }, [store?.favicon_url]);

  useEffect(() => {
    let isMounted = true;
    publicCategoriesApi
      .list(slug)
      .then((data) => {
        if (isMounted) setCategories(data.categories || []);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [slug]);

  useEffect(() => {
    let isMounted = true;

    async function loadStorefront() {
      setLoading(true);
      setError("");

      try {
        const data = await publicStoreApi.listProducts(slug, {
          search,
          category_id: categoryId,
          min_price: minPrice,
          max_price: maxPrice,
          in_stock: inStockOnly ? "true" : "",
          size,
          sort
        });

        if (isMounted) {
          setStore(data.store);
          setProducts(data.products || []);
          setAvailableSizes(data.available_sizes || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load storefront");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(loadStorefront, 200);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [slug, search, categoryId, minPrice, maxPrice, inStockOnly, size, sort]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {store?.logo_url ? (
              <img
                src={store.logo_url}
                alt={store?.name || ""}
                className={`${STOREFRONT_LOGO_HEIGHT[store?.logo_size] || STOREFRONT_LOGO_HEIGHT.medium} w-auto max-w-[220px] shrink-0 rounded-md object-contain`}
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <Store aria-hidden="true" size={20} />
              </div>
            )}
            <h1 className="truncate text-lg font-bold text-slate-950 sm:text-xl">
              {store?.name || "Storefront"}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <CurrencySelector />
            {store?.phone ? (
              <a
                href={`tel:${store.phone}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Phone aria-hidden="true" size={17} />
                <span className="hidden sm:inline">{store.phone}</span>
              </a>
            ) : null}
            <CartIconLink storeBase={storeBase} />
            <ShopperHeaderMenu storeBase={storeBase} />
          </div>
        </div>
      </header>

      <AnnouncementBar text={store?.announcement_text} />

      {store?.description ? (
        <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            {store.description}
          </p>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* Filter panel */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  Filters
                </h2>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold text-emerald-700 transition hover:text-emerald-800"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>

              {categories.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Category
                  </p>
                  <div className="mt-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => setCategoryId("")}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold transition ${
                        categoryId === ""
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                      }`}
                    >
                      All products
                    </button>
                    {categories.map((category) => {
                      const isActive = categoryId === category.id;
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() =>
                            setCategoryId(isActive ? "" : category.id)
                          }
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                          }`}
                        >
                          <span className="truncate">{category.name}</span>
                          {typeof category.product_count === "number" ? (
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold ${
                                isActive
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {category.product_count}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Price ({storeBaseCurrency})
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={minPrice}
                    onChange={(event) => setMinPrice(event.target.value)}
                    placeholder="Min"
                    className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                    placeholder="Max"
                    className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              {availableSizes.length > 0 ? (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Size
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableSizes.map((label) => {
                      const active = size === label;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setSize(active ? "" : label)}
                          className={`inline-flex h-9 min-w-[2.5rem] items-center justify-center rounded-md border px-2.5 text-sm font-semibold transition ${
                            active
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 border-t border-slate-100 pt-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(event) => setInStockOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                  />
                  In stock only
                </label>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Sort by
                </p>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-slate-300 px-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name">Name (A–Z)</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Results */}
          <div>
            <label className="relative block">
              <Search
                aria-hidden="true"
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Search products"
              />
            </label>

            {error ? (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
                Loading products...
              </div>
            ) : products.length === 0 ? (
              <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
                No products match these filters.
              </div>
            ) : (
              <div className={`mt-6 grid gap-4 ${productGridClass}`}>
                {products.map((product) => (
                  <Link
                    key={product.id}
                    to={`${storeBase}/product/${product.id}`}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <HoverCarousel
                      images={[
                        product.image_url,
                        ...(Array.isArray(product.gallery_images)
                          ? product.gallery_images
                          : [])
                      ].filter(Boolean)}
                      alt={product.name}
                      style={{ aspectRatio: cardAspect }}
                    />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-bold text-slate-950">
                            {product.name}
                          </h2>
                          <p className="mt-1 text-sm text-slate-500">
                            {product.category || "Uncategorized"}
                          </p>
                        </div>
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${
                            product.in_stock
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {product.in_stock ? "In stock" : "Out"}
                        </span>
                      </div>
                      <p className="mt-4 text-lg font-bold text-slate-950">
                        {formatFromSource(
                          product.discount_price || product.price,
                          storeBaseCurrency
                        )}
                      </p>
                      {product.discount_price ? (
                        <p className="text-sm text-slate-400 line-through">
                          {formatFromSource(product.price, storeBaseCurrency)}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default PublicStorefrontPage;
