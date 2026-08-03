import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingBag,
  Trash2
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { publicStoreApi } from "../api/client.js";
import AnnouncementBar from "../components/storefront/AnnouncementBar.jsx";
import CartIconLink from "../components/storefront/CartIconLink.jsx";
import CurrencySelector from "../components/storefront/CurrencySelector.jsx";
import ShopperHeaderMenu from "../components/storefront/ShopperHeaderMenu.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useCurrency } from "../context/CurrencyContext.jsx";

function CartPage({ slug: slugProp } = {}) {
  const params = useParams();
  const slug = slugProp || params.slug;
  const isHostStorefront = Boolean(slugProp);
  const storeBase = isHostStorefront ? "" : `/store/${slug}`;
  const navigate = useNavigate();
  const { items, subtotal, updateQuantity, removeItem, setActiveStoreSlug } =
    useCart();
  const [store, setStore] = useState(null);
  const { formatFromSource, setStoreCurrency } = useCurrency();
  const storeBaseCurrency = store?.default_currency || "LKR";

  useEffect(() => {
    setActiveStoreSlug(slug || null);
  }, [slug, setActiveStoreSlug]);

  useEffect(() => {
    let isMounted = true;
    publicStoreApi
      .getStore(slug)
      .then((data) => {
        if (!isMounted) return;
        setStore(data.store);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [slug]);

  useEffect(() => {
    setStoreCurrency(store?.default_currency || null);
    return () => setStoreCurrency(null);
  }, [store?.default_currency, setStoreCurrency]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            to={storeBase || "/"}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            <span>{store?.name || "Store"}</span>
          </Link>
          <div className="flex items-center gap-2">
            <CurrencySelector />
            <CartIconLink storeBase={storeBase} />
            <ShopperHeaderMenu storeBase={storeBase} />
          </div>
        </div>
      </header>

      <AnnouncementBar text={store?.announcement_text} />

      <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <h1 className="text-3xl font-bold tracking-normal">Your cart</h1>
        <p className="mt-1 text-sm text-slate-600">
          {items.length === 0
            ? "Your cart is empty."
            : `${items.length} item${items.length === 1 ? "" : "s"} ready to check out.`}
        </p>

        {items.length === 0 ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <ShoppingBag aria-hidden="true" size={26} />
            </div>
            <h2 className="mt-4 text-lg font-bold">No items yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Browse the store and click "Add to cart" to start.
            </p>
            <Link
              to={storeBase || "/"}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-emerald-500 px-5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
            >
              Continue shopping
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {items.map((line) => (
                <li
                  key={line.key || line.product_id}
                  className="grid gap-3 p-4 sm:grid-cols-[80px_1fr_140px_44px] sm:items-center"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    {line.image_url ? (
                      <img
                        src={line.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <Link
                      to={`${storeBase}/product/${line.product_id}`}
                      className="font-semibold text-slate-950 hover:text-emerald-700"
                    >
                      {line.name}
                    </Link>
                    {line.variant_name ? (
                      <p className="mt-0.5 text-xs font-semibold text-slate-600">
                        Size: {line.variant_name}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-slate-500">
                      {formatFromSource(line.unit_price, storeBaseCurrency)} each
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Line total{" "}
                      <span className="font-semibold text-slate-700">
                        {formatFromSource(
                          line.unit_price * line.quantity,
                          storeBaseCurrency
                        )}
                      </span>
                    </p>
                  </div>
                  <div className="inline-flex h-10 items-center overflow-hidden rounded-md border border-slate-200 sm:justify-self-end">
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(line.key, line.quantity - 1)
                      }
                      className="inline-flex h-full w-10 items-center justify-center text-slate-700 hover:bg-slate-50"
                      aria-label={`Decrease ${line.name}`}
                    >
                      <Minus aria-hidden="true" size={14} />
                    </button>
                    <span className="w-10 text-center text-sm font-bold">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(line.key, line.quantity + 1)
                      }
                      disabled={line.quantity >= line.stock_quantity}
                      className="inline-flex h-full w-10 items-center justify-center text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Increase ${line.name}`}
                    >
                      <Plus aria-hidden="true" size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(line.key)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 sm:justify-self-end"
                    aria-label={`Remove ${line.name}`}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </li>
              ))}
            </ul>

            <aside className="h-fit space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-20">
              <h2 className="text-lg font-bold">Order summary</h2>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="font-semibold">
                    {formatFromSource(subtotal, storeBaseCurrency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Delivery</dt>
                  <dd className="text-slate-500">Calculated at checkout</dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
                  <dt className="font-bold">Total</dt>
                  <dd className="font-bold">
                    {formatFromSource(subtotal, storeBaseCurrency)}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => navigate(`${storeBase}/checkout`)}
                className="inline-flex h-12 w-full items-center justify-center rounded-md bg-emerald-500 px-5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                Checkout
              </button>
              <Link
                to={storeBase || "/"}
                className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Continue shopping
              </Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

export default CartPage;
