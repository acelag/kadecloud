import {
  Banknote,
  CreditCard,
  Landmark,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { posApi, productsApi, storesApi } from "../api/client.js";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "bank_transfer", label: "Bank transfer", icon: Landmark }
];

// Static class lookups so Tailwind JIT keeps the classes at build time.
const POS_GRID_COLUMNS = {
  1: "sm:grid-cols-1 lg:grid-cols-1",
  2: "sm:grid-cols-2 lg:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5",
  6: "sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6",
  7: "sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7",
  8: "sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8"
};

function formatPrice(amount, currency = "LKR") {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch (_err) {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function unitPriceOf(product) {
  const discount = Number(product.discount_price);
  if (Number.isFinite(discount) && discount > 0) return discount;
  return Number(product.price) || 0;
}

const emptyForm = {
  payment_method: "cash",
  payment_reference: "",
  cash_given: "",
  customer_name: "",
  customer_phone: "",
  notes: ""
};

function POSPage() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [storeCurrency, setStoreCurrency] = useState("LKR");
  const [storeName, setStoreName] = useState("");
  const [posTileAspect, setPosTileAspect] = useState("1:1");
  const [posPerRow, setPosPerRow] = useState(4);
  const searchInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    storesApi
      .me()
      .then((data) => {
        if (!isMounted) return;
        setStoreCurrency(data.store?.default_currency || "LKR");
        setStoreName(data.store?.name || "");
        setPosTileAspect(data.store?.pos_card_aspect || "1:1");
        setPosPerRow(Number(data.store?.pos_products_per_row) || 4);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const gridClass = POS_GRID_COLUMNS[posPerRow] || POS_GRID_COLUMNS[4];
  const tileAspectCss = String(posTileAspect || "1:1").replace(":", " / ");

  async function loadProducts() {
    setLoadingProducts(true);
    setProductsError("");
    try {
      const data = await productsApi.list({ status: "active" });
      setProducts(data.products || []);
    } catch (err) {
      setProductsError(err.message || "Unable to load products");
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => {
      return (
        (product.name || "").toLowerCase().includes(query) ||
        (product.sku || "").toLowerCase().includes(query) ||
        (product.category || "").toLowerCase().includes(query)
      );
    });
  }, [products, search]);

  const subtotal = useMemo(() => {
    return cart.reduce(
      (sum, line) => sum + line.unit_price * line.quantity,
      0
    );
  }, [cart]);

  function addToCart(product) {
    if (Number(product.stock_quantity) <= 0) return;
    setCart((current) => {
      const existing = current.find((line) => line.product_id === product.id);
      if (existing) {
        if (existing.quantity >= Number(product.stock_quantity)) return current;
        return current.map((line) =>
          line.product_id === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }
      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          image_url: product.image_url,
          unit_price: unitPriceOf(product),
          stock_quantity: Number(product.stock_quantity),
          quantity: 1
        }
      ];
    });
  }

  function incrementLine(productId) {
    setCart((current) =>
      current.map((line) =>
        line.product_id === productId
          ? {
              ...line,
              quantity: Math.min(line.stock_quantity, line.quantity + 1)
            }
          : line
      )
    );
  }

  function decrementLine(productId) {
    setCart((current) =>
      current
        .map((line) =>
          line.product_id === productId
            ? { ...line, quantity: line.quantity - 1 }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
  }

  function removeLine(productId) {
    setCart((current) =>
      current.filter((line) => line.product_id !== productId)
    );
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startNewSale() {
    setCart([]);
    setForm(emptyForm);
    setReceipt(null);
    setError("");
    setFieldErrors([]);
    searchInputRef.current?.focus();
  }

  const cashGivenNum = Number(form.cash_given);
  const cashGivenValid = Number.isFinite(cashGivenNum) && cashGivenNum >= 0;
  const cashBalance = cashGivenValid ? cashGivenNum - subtotal : null;
  const isCash = form.payment_method === "cash";
  const cashShort =
    isCash && cashGivenValid && cashBalance !== null && cashBalance < 0;
  const canCharge =
    cart.length > 0 &&
    !submitting &&
    (!isCash || form.cash_given === "" || (cashGivenValid && !cashShort));

  async function submit() {
    if (!canCharge) return;
    setSubmitting(true);
    setError("");
    setFieldErrors([]);

    try {
      const payload = {
        items: cart.map((line) => ({
          product_id: line.product_id,
          quantity: line.quantity
        })),
        payment_method: form.payment_method,
        payment_reference: form.payment_reference,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        notes: form.notes
      };

      if (isCash && form.cash_given !== "") {
        payload.cash_given = cashGivenNum;
      }

      const data = await posApi.createSale(payload);
      setReceipt({
        order: data.order,
        items: data.items,
        cartSnapshot: cart,
        storeName,
        timestamp: new Date()
      });
      // Reload product stock for further sales without page refresh.
      loadProducts();
    } catch (err) {
      setError(err.message || "Unable to record sale");
      setFieldErrors(err.errors || []);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Point of sale
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
            POS
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Pick products, take payment at the till, and stock updates
            immediately.
          </p>
        </div>
        {cart.length > 0 ? (
          <button
            type="button"
            onClick={() => setCart([])}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          >
            <X aria-hidden="true" size={16} />
            Clear cart
          </button>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-start">
        {/* Product picker */}
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <label className="relative block">
              <Search
                aria-hidden="true"
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                autoFocus
                placeholder="Search by name, SKU, or category"
                className="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          {productsError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {productsError}
            </div>
          ) : null}

          {loadingProducts ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              No products match "{search}".
            </div>
          ) : (
            <div className={`grid gap-3 ${gridClass}`}>
              {filteredProducts.map((product) => {
                const stock = Number(product.stock_quantity);
                const outOfStock = stock <= 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={outOfStock}
                    className={`group flex flex-col items-stretch overflow-hidden rounded-lg border bg-white text-left shadow-sm transition ${
                      outOfStock
                        ? "cursor-not-allowed border-slate-200 opacity-50"
                        : "border-slate-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md"
                    }`}
                  >
                    <div
                      className="bg-slate-100"
                      style={{ aspectRatio: tileAspectCss }}
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-slate-950">
                        {product.name}
                      </p>
                      <p className="text-xs font-mono text-slate-400">
                        {product.sku || "—"}
                      </p>
                      <div className="mt-auto flex items-baseline justify-between gap-2 pt-2">
                        <span className="text-sm font-bold text-slate-950">
                          {formatPrice(
                            unitPriceOf(product),
                            storeCurrency
                          )}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            outOfStock ? "text-rose-600" : "text-slate-500"
                          }`}
                        >
                          {outOfStock ? "Out of stock" : `${stock} left`}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart panel */}
        <aside className="space-y-3 xl:sticky xl:top-20">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <ShoppingCart aria-hidden="true" size={18} className="text-emerald-700" />
                <h3 className="text-base font-bold text-slate-950">
                  Cart ({cart.length})
                </h3>
              </div>
              {cart.length > 0 ? (
                <p className="text-xs text-slate-500">
                  {cart.reduce((n, l) => n + l.quantity, 0)} item(s)
                </p>
              ) : null}
            </div>

            {cart.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                Click a product to add it.
              </div>
            ) : (
              <ul className="max-h-[360px] divide-y divide-slate-200 overflow-y-auto">
                {cart.map((line) => (
                  <li
                    key={line.product_id}
                    className="flex items-start gap-3 p-3"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {line.image_url ? (
                        <img
                          src={line.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {line.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatPrice(line.unit_price, storeCurrency)}
                      </p>
                      <div className="mt-1.5 inline-flex h-8 items-center overflow-hidden rounded-md border border-slate-200">
                        <button
                          type="button"
                          onClick={() => decrementLine(line.product_id)}
                          className="inline-flex h-full w-8 items-center justify-center text-slate-700 hover:bg-slate-50"
                          aria-label="Decrease"
                        >
                          <Minus aria-hidden="true" size={13} />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => incrementLine(line.product_id)}
                          disabled={line.quantity >= line.stock_quantity}
                          className="inline-flex h-full w-8 items-center justify-center text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Increase"
                        >
                          <Plus aria-hidden="true" size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-950">
                        {formatPrice(
                          line.unit_price * line.quantity,
                          storeCurrency
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeLine(line.product_id)}
                        className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                        aria-label="Remove"
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between text-base font-bold">
                <span>Total</span>
                <span>{formatPrice(subtotal, storeCurrency)}</span>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment method
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {PAYMENT_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = form.payment_method === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            payment_method: option.value
                          }))
                        }
                        className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold transition ${
                          active
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <Icon aria-hidden="true" size={18} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isCash ? (
                <div className="space-y-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cash given
                    </span>
                    <input
                      name="cash_given"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.cash_given}
                      onChange={updateForm}
                      placeholder={String(subtotal.toFixed(2))}
                      className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-base font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          cash_given: subtotal.toFixed(2)
                        }))
                      }
                      disabled={subtotal <= 0}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Exact
                    </button>
                    {[500, 1000, 2000, 5000, 10000]
                      .filter((step) => step > subtotal)
                      .slice(0, 4)
                      .map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              cash_given: amount.toFixed(2)
                            }))
                          }
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          {formatPrice(amount, storeCurrency)}
                        </button>
                      ))}
                  </div>

                  {cashBalance !== null && form.cash_given !== "" ? (
                    <div
                      className={`rounded-md border px-3 py-2 text-sm font-bold ${
                        cashBalance < 0
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {cashBalance < 0 ? (
                        <span>
                          Short by{" "}
                          {formatPrice(Math.abs(cashBalance), storeCurrency)}
                        </span>
                      ) : (
                        <span>
                          Balance{" "}
                          {formatPrice(cashBalance, storeCurrency)}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payment reference
                  </span>
                  <input
                    name="payment_reference"
                    value={form.payment_reference}
                    onChange={updateForm}
                    placeholder={
                      form.payment_method === "card"
                        ? "Last 4 digits / terminal ref"
                        : "Bank reference"
                    }
                    maxLength={120}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              )}

              <details className="rounded-md border border-slate-200 p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer details (optional)
                </summary>
                <div className="mt-3 space-y-2">
                  <input
                    name="customer_name"
                    value={form.customer_name}
                    onChange={updateForm}
                    placeholder="Customer name"
                    maxLength={140}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                  <input
                    name="customer_phone"
                    value={form.customer_phone}
                    onChange={updateForm}
                    placeholder="Customer phone"
                    maxLength={30}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={updateForm}
                    rows={2}
                    placeholder="Notes"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </details>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <p>{error}</p>
                  {fieldErrors.length > 0 ? (
                    <ul className="mt-1 list-disc pl-4">
                      {fieldErrors.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={submit}
                disabled={!canCharge}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Recording sale..."
                  : cashShort
                    ? "Cash given is less than total"
                    : `Charge ${formatPrice(subtotal, storeCurrency)}`}
              </button>
            </div>
          </div>
        </aside>
      </section>

      {receipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                Sale complete
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">
                {receipt.order.order_number}
              </h3>
              <p className="text-xs text-slate-500">
                {receipt.timestamp.toLocaleString("en-LK", {
                  dateStyle: "medium",
                  timeStyle: "short"
                })}
              </p>
            </div>

            <div className="space-y-3 p-5">
              {receipt.storeName ? (
                <p className="text-center text-sm font-bold text-slate-950">
                  {receipt.storeName}
                </p>
              ) : null}
              <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
                {receipt.cartSnapshot.map((line) => (
                  <li
                    key={line.product_id}
                    className="grid grid-cols-[1fr_60px_110px] gap-2 p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{line.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatPrice(line.unit_price, storeCurrency)}
                      </p>
                    </div>
                    <p className="text-right text-slate-600">
                      ×{line.quantity}
                    </p>
                    <p className="text-right font-semibold">
                      {formatPrice(
                        line.unit_price * line.quantity,
                        storeCurrency
                      )}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="flex items-baseline justify-between text-base font-bold">
                <span>Total</span>
                <span>
                  {formatPrice(receipt.order.total_amount, storeCurrency)}
                </span>
              </div>

              <dl className="space-y-1 text-sm text-slate-600">
                <div className="flex justify-between">
                  <dt>Payment</dt>
                  <dd className="font-semibold text-slate-950">
                    {PAYMENT_OPTIONS.find(
                      (o) => o.value === receipt.order.payment_method
                    )?.label || receipt.order.payment_method}
                  </dd>
                </div>
                {receipt.order.cash_given !== null &&
                receipt.order.cash_given !== undefined ? (
                  <>
                    <div className="flex justify-between">
                      <dt>Cash given</dt>
                      <dd className="font-semibold text-slate-950">
                        {formatPrice(receipt.order.cash_given, storeCurrency)}
                      </dd>
                    </div>
                    <div className="flex justify-between text-base">
                      <dt className="font-semibold text-slate-950">Balance</dt>
                      <dd className="font-bold text-emerald-700">
                        {formatPrice(
                          Number(receipt.order.cash_given) -
                            Number(receipt.order.total_amount),
                          storeCurrency
                        )}
                      </dd>
                    </div>
                  </>
                ) : null}
                {receipt.order.payment_reference ? (
                  <div className="flex justify-between">
                    <dt>Reference</dt>
                    <dd className="font-mono text-xs">
                      {receipt.order.payment_reference}
                    </dd>
                  </div>
                ) : null}
                {receipt.order.customer_name ? (
                  <div className="flex justify-between">
                    <dt>Customer</dt>
                    <dd>{receipt.order.customer_name}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 p-4 sm:flex-row">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Printer aria-hidden="true" size={16} />
                Print
              </button>
              <button
                type="button"
                onClick={startNewSale}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                New sale
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default POSPage;
