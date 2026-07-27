import { ArrowLeft, CheckCircle2, CreditCard, Landmark } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { publicOrdersApi, publicStoreApi } from "../api/client.js";
import AnnouncementBar from "../components/storefront/AnnouncementBar.jsx";
import CartIconLink from "../components/storefront/CartIconLink.jsx";
import CurrencySelector from "../components/storefront/CurrencySelector.jsx";
import ShopperHeaderMenu from "../components/storefront/ShopperHeaderMenu.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useCurrency } from "../context/CurrencyContext.jsx";
import { useShopperAuth } from "../context/ShopperAuthContext.jsx";

function CheckoutPage({ slug: slugProp } = {}) {
  const params = useParams();
  const slug = slugProp || params.slug;
  const isHostStorefront = Boolean(slugProp);
  const storeBase = isHostStorefront ? "" : `/store/${slug}`;
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    district: "",
    notes: "",
    payment_method: "cod",
    payment_reference: ""
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const payhereFormRef = useRef(null);
  const { formatFromSource, setStoreCurrency } = useCurrency();
  const { shopper } = useShopperAuth();
  const {
    items,
    subtotal,
    itemCount,
    setActiveStoreSlug,
    clear: clearCart
  } = useCart();
  const storeBaseCurrency = store?.default_currency || "LKR";

  useEffect(() => {
    setActiveStoreSlug(slug || null);
  }, [slug, setActiveStoreSlug]);

  useEffect(() => {
    if (!shopper) return;
    setForm((current) => ({
      ...current,
      name:     current.name     || shopper.name     || "",
      email:    current.email    || shopper.email     || "",
      phone:    current.phone    || shopper.phone     || "",
      address:  current.address  || shopper.address   || "",
      city:     current.city     || shopper.city      || "",
      district: current.district || shopper.district  || ""
    }));
  }, [shopper]);

  useEffect(() => {
    setStoreCurrency(store?.default_currency || null);
    return () => setStoreCurrency(null);
  }, [store?.default_currency, setStoreCurrency]);

  useEffect(() => {
    let isMounted = true;
    publicStoreApi
      .getStore(slug)
      .then((data) => {
        if (!isMounted) return;
        setStore(data.store);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Unable to load store");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [slug]);

  // If the cart goes empty (e.g. user removed everything in another tab),
  // bounce them back to the cart page so they're not stuck on a dead form.
  useEffect(() => {
    if (!loading && items.length === 0) {
      navigate(`${storeBase}/cart`, { replace: true });
    }
  }, [loading, items.length, navigate, storeBase]);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (items.length === 0) return;
    setSubmitting(true);
    setError("");
    setFieldErrors([]);

    try {
      const data = await publicOrdersApi.create({
        store_slug: slug,
        items: items.map((line) => ({
          product_id: line.product_id,
          quantity: line.quantity
        })),
        name: form.name,
        email: form.email || undefined,
        phone: form.phone,
        address: form.address,
        city: form.city,
        district: form.district,
        notes: form.notes,
        payment_method: form.payment_method,
        payment_reference:
          form.payment_method === "bank_transfer"
            ? form.payment_reference
            : null
      });

      sessionStorage.setItem("kadecloud_last_order", JSON.stringify(data));
      clearCart();

      // PayHere: auto-submit the hidden form to PayHere's hosted checkout.
      if (data.payhere) {
        // Store the order so OrderSuccessPage can read it on return.
        // (PayHere redirects back to return_url without state, so we rely on sessionStorage.)
        navigate(`${storeBase}/order-success`, { replace: false, state: data });
        // Populate and submit the hidden PayHere form.
        const ph = data.payhere;
        const form = payhereFormRef.current;
        if (form) {
          form.action = ph.checkout_url;
          const fields = {
            merchant_id: ph.merchant_id,
            return_url:  ph.return_url,
            cancel_url:  ph.cancel_url,
            notify_url:  ph.notify_url,
            order_id:    ph.order_id,
            items:       ph.items,
            currency:    ph.currency,
            amount:      ph.amount,
            first_name:  ph.first_name,
            last_name:   ph.last_name,
            email:       ph.email,
            phone:       ph.phone,
            address:     ph.address,
            city:        ph.city,
            country:     ph.country,
            hash:        ph.hash
          };
          // Set each hidden input value.
          Object.entries(fields).forEach(([name, value]) => {
            const input = form.querySelector(`input[name="${name}"]`);
            if (input) input.value = value ?? "";
          });
          form.submit();
        }
        return;
      }

      navigate(`${storeBase}/order-success`, {
        replace: true,
        state: data
      });
    } catch (err) {
      setError(err.message || "Unable to place order");
      setFieldErrors(err.errors || []);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <section className="mx-auto max-w-5xl rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading checkout...
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            to={`${storeBase}/cart`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Back to cart
          </Link>
          <div className="flex items-center gap-2">
            <CurrencySelector />
            <CartIconLink storeBase={storeBase} />
            <ShopperHeaderMenu storeBase={storeBase} />
          </div>
        </div>
      </header>

      <AnnouncementBar text={store?.announcement_text} />

      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_360px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                Checkout
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-normal">
                Delivery details
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {itemCount} item{itemCount === 1 ? "" : "s"} ready to ship.
              </p>
            </div>

            {error ? (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p>{error}</p>
                {fieldErrors.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {fieldErrors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Name</span>
                <input
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  required
                  autoComplete="name"
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Customer name"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Email
                  {form.payment_method === "payhere" ? (
                    <span className="ml-1 text-xs font-normal text-red-500">
                      — required for online payment
                    </span>
                  ) : (
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      — for order confirmation
                    </span>
                  )}
                </span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateField}
                  required={form.payment_method === "payhere"}
                  autoComplete="email"
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder={
                    form.payment_method === "payhere"
                      ? "you@example.com"
                      : "you@example.com (optional)"
                  }
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Phone</span>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={updateField}
                  required
                  autoComplete="tel"
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="0771234567"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Address
                </span>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={updateField}
                  required
                  rows={3}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="House no, street, nearest landmark"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">City</span>
                <input
                  name="city"
                  value={form.city}
                  onChange={updateField}
                  required
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Colombo"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  District
                </span>
                <input
                  name="district"
                  value={form.district}
                  onChange={updateField}
                  required
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Colombo"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">
                  Notes
                </span>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={updateField}
                  rows={3}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Delivery notes (timing, size/colour preference, ...)"
                />
              </label>
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-sm font-semibold text-slate-950">
                Payment method
              </p>
              <label
                className={`flex items-start gap-3 rounded-md border p-4 transition ${
                  form.payment_method === "cod"
                    ? "border-emerald-500 bg-emerald-50/40"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value="cod"
                  checked={form.payment_method === "cod"}
                  onChange={updateField}
                  className="mt-1 h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex flex-1 items-start gap-3">
                  <CheckCircle2
                    aria-hidden="true"
                    size={19}
                    className="mt-0.5 text-emerald-700"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Cash on Delivery
                    </p>
                    <p className="text-sm text-slate-500">
                      Pay the courier when your order arrives.
                    </p>
                  </div>
                </div>
              </label>

              {store?.bank_transfer_enabled ? (
                <label
                  className={`flex items-start gap-3 rounded-md border p-4 transition ${
                    form.payment_method === "bank_transfer"
                      ? "border-emerald-500 bg-emerald-50/40"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value="bank_transfer"
                    checked={form.payment_method === "bank_transfer"}
                    onChange={updateField}
                    className="mt-1 h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex flex-1 items-start gap-3">
                    <Landmark
                      aria-hidden="true"
                      size={19}
                      className="mt-0.5 text-emerald-700"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Bank Transfer
                      </p>
                      <p className="text-sm text-slate-500">
                        Transfer the total to the seller's account before dispatch.
                      </p>
                    </div>
                  </div>
                </label>
              ) : null}

              {store?.payhere_enabled ? (
                <label
                  className={`flex items-start gap-3 rounded-md border p-4 transition ${
                    form.payment_method === "payhere"
                      ? "border-blue-500 bg-blue-50/40"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value="payhere"
                    checked={form.payment_method === "payhere"}
                    onChange={updateField}
                    className="mt-1 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex flex-1 items-start gap-3">
                    <CreditCard
                      aria-hidden="true"
                      size={19}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Pay Online — Card / Wallet
                      </p>
                      <p className="text-sm text-slate-500">
                        Visa, Mastercard, Amex, eZ Cash, mCash &amp; more via PayHere.
                      </p>
                    </div>
                  </div>
                </label>
              ) : null}
            </div>

            {form.payment_method === "bank_transfer" &&
            store?.bank_transfer_enabled ? (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Transfer to
                </p>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {store.bank_account_name ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        Account name
                      </dt>
                      <dd className="font-semibold text-slate-950">
                        {store.bank_account_name}
                      </dd>
                    </div>
                  ) : null}
                  {store.bank_account_number ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        Account number
                      </dt>
                      <dd className="font-mono text-sm font-semibold text-slate-950">
                        {store.bank_account_number}
                      </dd>
                    </div>
                  ) : null}
                  {store.bank_name ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        Bank
                      </dt>
                      <dd className="font-semibold text-slate-950">
                        {store.bank_name}
                      </dd>
                    </div>
                  ) : null}
                  {store.bank_branch ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        Branch
                      </dt>
                      <dd className="font-semibold text-slate-950">
                        {store.bank_branch}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {store.bank_transfer_instructions ? (
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {store.bank_transfer_instructions}
                  </p>
                ) : null}

                <label className="mt-4 block">
                  <span className="text-sm font-semibold text-slate-700">
                    Transfer reference{" "}
                    <span className="font-normal text-slate-500">(optional)</span>
                  </span>
                  <input
                    name="payment_reference"
                    value={form.payment_reference}
                    onChange={updateField}
                    maxLength={120}
                    className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Your transaction reference"
                  />
                </label>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-md px-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                form.payment_method === "payhere"
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              }`}
            >
              {submitting
                ? "Placing order..."
                : form.payment_method === "bank_transfer"
                  ? "Place bank-transfer order"
                  : form.payment_method === "payhere"
                    ? "Pay now with PayHere →"
                    : "Place COD order"}
            </button>
          </form>

          {/* Hidden form — populated and submitted programmatically for PayHere. */}
          {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
          <form
            ref={payhereFormRef}
            method="post"
            style={{ display: "none" }}
            aria-hidden="true"
          >
            {[
              "merchant_id","return_url","cancel_url","notify_url",
              "order_id","items","currency","amount",
              "first_name","last_name","email","phone",
              "address","city","country","hash"
            ].map((name) => (
              <input key={name} type="hidden" name={name} />
            ))}
          </form>

          <aside className="h-fit space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-20">
            <p className="text-sm font-semibold text-slate-500">Order summary</p>
            <ul className="space-y-3">
              {items.map((line) => (
                <li
                  key={line.product_id}
                  className="flex items-start gap-3 text-sm"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    {line.image_url ? (
                      <img
                        src={line.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{line.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatFromSource(line.unit_price, storeBaseCurrency)} ×{" "}
                      {line.quantity}
                    </p>
                  </div>
                  <p className="text-right text-sm font-semibold">
                    {formatFromSource(
                      line.unit_price * line.quantity,
                      storeBaseCurrency
                    )}
                  </p>
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Quantity</span>
                <span className="font-semibold">{itemCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment</span>
                <span className="font-semibold">
                  {form.payment_method === "bank_transfer"
                    ? "Bank Transfer"
                    : form.payment_method === "payhere"
                      ? "PayHere"
                      : "COD"}
                </span>
              </div>
              <div className="flex justify-between text-base">
                <span className="font-semibold">Total</span>
                <span className="font-bold">
                  {formatFromSource(subtotal, storeBaseCurrency)}
                </span>
              </div>
            </div>
            <Link
              to={`${storeBase}/cart`}
              className="inline-flex h-9 w-full items-center justify-center text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Edit cart
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default CheckoutPage;
