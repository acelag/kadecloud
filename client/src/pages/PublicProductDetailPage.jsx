import { ArrowLeft, Minus, Plus, Phone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { publicStoreApi } from "../api/client.js";
import AnnouncementBar from "../components/storefront/AnnouncementBar.jsx";
import CartIconLink from "../components/storefront/CartIconLink.jsx";
import CurrencySelector from "../components/storefront/CurrencySelector.jsx";
import ShopperHeaderMenu from "../components/storefront/ShopperHeaderMenu.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useCurrency } from "../context/CurrencyContext.jsx";

function PublicProductDetailPage({ slug: slugProp } = {}) {
  const params = useParams();
  const slug = slugProp || params.slug;
  const productId = params.productId;
  const isHostStorefront = Boolean(slugProp);
  const storeBase = isHostStorefront ? "" : `/store/${slug}`;
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSizeId, setSelectedSizeId] = useState(null);
  const [activeImage, setActiveImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { formatFromSource, setStoreCurrency } = useCurrency();
  const storeBaseCurrency = store?.default_currency || "LKR";

  useEffect(() => {
    setStoreCurrency(store?.default_currency || null);
    return () => setStoreCurrency(null);
  }, [store?.default_currency, setStoreCurrency]);

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      setLoading(true);
      setError("");

      try {
        const data = await publicStoreApi.getProduct(slug, productId);

        if (isMounted) {
          setStore(data.store);
          setProduct(data.product);
          setQuantity(data.product.stock_quantity > 0 ? 1 : 0);
          const firstImage =
            data.product.image_url ||
            (Array.isArray(data.product.images) && data.product.images[0]) ||
            "";
          setActiveImage(firstImage);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load product");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [slug, productId]);

  const sizes = Array.isArray(product?.sizes) ? product.sizes : [];
  const hasSizes = sizes.length > 0;
  const selectedSize = hasSizes
    ? sizes.find((size) => size.id === selectedSizeId) || null
    : null;
  const maxQuantity = hasSizes
    ? Number(selectedSize?.stock_quantity || 0)
    : Number(product?.stock_quantity || 0);
  const isInStock = hasSizes
    ? sizes.some((size) => size.in_stock)
    : maxQuantity > 0;

  // Picking a size (or changing it) resets the quantity to a valid 1.
  useEffect(() => {
    if (!hasSizes) return;
    setQuantity(selectedSize && selectedSize.stock_quantity > 0 ? 1 : 0);
  }, [selectedSizeId, hasSizes, selectedSize]);

  const galleryImages = useMemo(() => {
    const list = [];
    const seen = new Set();
    const candidates = [
      product?.image_url,
      ...(Array.isArray(product?.images) ? product.images : [])
    ];

    for (const url of candidates) {
      if (url && !seen.has(url)) {
        seen.add(url);
        list.push(url);
      }
    }

    return list;
  }, [product]);

  function decreaseQuantity() {
    setQuantity((current) => Math.max(1, current - 1));
  }

  function increaseQuantity() {
    setQuantity((current) => Math.min(maxQuantity, current + 1));
  }

  const { addItem, setActiveStoreSlug, items: cartItems } = useCart();
  const [addedFlash, setAddedFlash] = useState(false);

  useEffect(() => {
    setActiveStoreSlug(slug || null);
  }, [slug, setActiveStoreSlug]);

  const inCart =
    cartItems.find(
      (line) =>
        line.product_id === product?.id &&
        (line.product_variant_id || null) === (selectedSizeId || null)
    ) || null;

  // Products with sizes require a size choice before either action is allowed.
  const needsSize = hasSizes && !selectedSize;
  const canPurchase = Boolean(product) && isInStock && !needsSize && quantity > 0;
  const stockLabel = !isInStock
    ? "Out of stock"
    : hasSizes && !selectedSize
      ? "In stock"
      : `${maxQuantity} in stock`;

  function variantForCart() {
    if (!selectedSize) return null;
    return {
      id: selectedSize.id,
      name: selectedSize.label,
      stock_quantity: selectedSize.stock_quantity
    };
  }

  function handleAddToCart() {
    if (!canPurchase) return;
    addItem(product, quantity, variantForCart());
    setAddedFlash(true);
    window.clearTimeout(handleAddToCart._timer);
    handleAddToCart._timer = window.setTimeout(
      () => setAddedFlash(false),
      1800
    );
  }

  function handleBuyNow() {
    if (!canPurchase) return;
    addItem(product, quantity, variantForCart());
    navigate(`${storeBase}/checkout`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
        <section className="mx-auto max-w-6xl rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading product...
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
        <section className="mx-auto max-w-6xl rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <AnnouncementBar text={store?.announcement_text} />
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={storeBase || "/"}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            {store?.name || "Storefront"}
          </Link>
          <div className="flex items-center gap-2">
            <CurrencySelector />
            <CartIconLink storeBase={storeBase} />
            <ShopperHeaderMenu storeBase={storeBase} />
          </div>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="aspect-square bg-slate-100">
                {activeImage ? (
                  <img
                    src={activeImage}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                    No image
                  </div>
                )}
              </div>
            </div>

            {galleryImages.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {galleryImages.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActiveImage(url)}
                    aria-label="Show this image"
                    className={`overflow-hidden rounded-md border bg-white transition ${
                      activeImage === url
                        ? "border-emerald-500 ring-2 ring-emerald-100"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <span className="block aspect-square bg-slate-100">
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              {product?.category || "Product"}
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-normal">
              {product?.name}
            </h1>
            <p className="mt-4 text-2xl font-bold text-slate-950">
              {formatFromSource(
                product?.discount_price || product?.price,
                storeBaseCurrency
              )}
            </p>
            {product?.discount_price ? (
              <p className="mt-1 text-sm text-slate-400 line-through">
                {formatFromSource(product.price, storeBaseCurrency)}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <span
                className={`rounded-md px-3 py-1 text-sm font-semibold ${
                  isInStock
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {stockLabel}
              </span>
              {product?.cod_available ? (
                <span className="rounded-md bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
                  COD available
                </span>
              ) : null}
            </div>

            <p className="mt-6 text-sm leading-7 text-slate-600">
              {product?.description || "No description available."}
            </p>

            {hasSizes ? (
              <div className="mt-6">
                <p className="text-sm font-medium text-slate-700">Size</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sizes.map((size) => {
                    const active = size.id === selectedSizeId;
                    return (
                      <button
                        key={size.id}
                        type="button"
                        disabled={!size.in_stock}
                        onClick={() => setSelectedSizeId(size.id)}
                        className={`inline-flex h-10 min-w-[3rem] items-center justify-center rounded-md border px-3 text-sm font-semibold transition ${
                          !size.in_stock
                            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 line-through"
                            : active
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        {size.label}
                      </button>
                    );
                  })}
                </div>
                {needsSize ? (
                  <p className="mt-2 text-xs font-semibold text-amber-600">
                    Please select a size.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6">
              <p className="text-sm font-medium text-slate-700">Quantity</p>
              <div className="mt-2 inline-flex h-11 items-center overflow-hidden rounded-md border border-slate-300 bg-white">
                <button
                  type="button"
                  onClick={decreaseQuantity}
                  disabled={!isInStock || quantity <= 1}
                  className="inline-flex h-full w-11 items-center justify-center text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  <Minus aria-hidden="true" size={16} />
                </button>
                <span className="w-14 text-center text-sm font-semibold">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={increaseQuantity}
                  disabled={!isInStock || quantity >= maxQuantity}
                  className="inline-flex h-full w-11 items-center justify-center text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <Plus aria-hidden="true" size={16} />
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!canPurchase}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md border border-emerald-500 bg-white px-4 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {addedFlash
                  ? "Added to cart ✓"
                  : inCart
                    ? `In cart (${inCart.quantity}) — add more`
                    : "Add to cart"}
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={!canPurchase}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-md bg-emerald-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Buy now
              </button>
            </div>

            {store?.phone ? (
              <a
                href={`tel:${store.phone}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Phone aria-hidden="true" size={17} />
                Call {store.phone}
              </a>
            ) : null}
          </section>
        </div>

        {Array.isArray(product?.attributes) && product.attributes.length > 0 ? (
          <section className="mt-10">
            <div className="border-b border-slate-200">
              <h2 className="inline-block border-b-2 border-emerald-500 pb-2 text-lg font-bold text-slate-950">
                Additional information
              </h2>
            </div>
            <dl className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {product.attributes.map((row, index) => (
                <div
                  key={`${row.label}-${index}`}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[220px_1fr] sm:px-6"
                >
                  <dt className="text-sm font-semibold text-slate-700">
                    {row.label}
                  </dt>
                  <dd className="text-sm text-slate-600">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default PublicProductDetailPage;
