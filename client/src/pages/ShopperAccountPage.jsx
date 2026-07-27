import { LogOut, MapPin, Package, Save, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { shoppersApi } from "../api/client.js";
import VerifyEmailBanner from "../components/VerifyEmailBanner.jsx";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";
import { useShopperAuth } from "../context/ShopperAuthContext.jsx";

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("en-LK", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "—";
}

function label(value) {
  return String(value || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ShopperAccountPage({ storeBase = "", storeSlug = null }) {
  const { shopper, isAuthenticated, logout, updateShopper } = useShopperAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    district: ""
  });
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`${storeBase}/login`, {
        replace: true,
        state: { from: `${storeBase}/account` }
      });
    }
  }, [isAuthenticated, navigate, storeBase]);

  useEffect(() => {
    if (!shopper) return;
    setForm({
      name: shopper.name || "",
      phone: shopper.phone || "",
      address: shopper.address || "",
      city: shopper.city || "",
      district: shopper.district || ""
    });
  }, [shopper]);

  useEffect(() => {
    let isMounted = true;
    if (!isAuthenticated) return undefined;
    setLoadingOrders(true);
    shoppersApi
      .orders(storeSlug || undefined)
      .then((data) => {
        if (isMounted) setOrders(data.orders || []);
      })
      .catch(() => {
        if (isMounted) setOrders([]);
      })
      .finally(() => {
        if (isMounted) setLoadingOrders(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, storeSlug]);

  if (!isAuthenticated) return null;

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const data = await shoppersApi.update(form);
      updateShopper(data.shopper);
      setMessage("Saved");
    } catch (err) {
      setError(err.message || "Unable to save");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate(storeBase || "/");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      {shopper && !shopper.email_verified ? (
        <VerifyEmailBanner
          userType="shopper"
          storeBase={storeBase}
          onResent={() => shoppersApi.me().then((d) => updateShopper(d.shopper)).catch(() => {})}
        />
      ) : null}
      <div className="px-4 py-8">
      <section className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {shopper?.picture_url ? (
              <img
                src={shopper.picture_url}
                alt=""
                className="h-12 w-12 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <User aria-hidden="true" size={22} />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-normal">
                {shopper?.name || shopper?.email}
              </h1>
              <p className="text-sm text-slate-500">{shopper?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <LogOut aria-hidden="true" size={16} />
            Sign out
          </button>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <MapPin aria-hidden="true" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Saved checkout details</h2>
              <p className="text-sm text-slate-500">
                Auto-fills the checkout form next time you order.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700">Name</span>
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-700">Phone</span>
              <input
                name="phone"
                value={form.phone}
                onChange={updateField}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-700">City</span>
              <input
                name="city"
                value={form.city}
                onChange={updateField}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Address
              </span>
              <input
                name="address"
                value={form.address}
                onChange={updateField}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label>
              <span className="text-sm font-semibold text-slate-700">
                District
              </span>
              <input
                name="district"
                value={form.district}
                onChange={updateField}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save aria-hidden="true" size={17} />
            {saving ? "Saving..." : "Save"}
          </button>
        </form>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <Package aria-hidden="true" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Your orders</h2>
              <p className="text-sm text-slate-500">
                {storeSlug
                  ? "Orders at this store."
                  : "Orders across every store you've used."}
              </p>
            </div>
          </div>

          {loadingOrders ? (
            <p className="p-6 text-sm text-slate-500">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              No orders yet — your purchases will show up here.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="grid gap-2 p-4 sm:grid-cols-[140px_1fr_140px_140px] sm:items-center"
                >
                  <Link
                    to={`/track/${order.order_number}`}
                    className="font-mono text-sm font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    {order.order_number}
                  </Link>
                  <p className="text-sm">
                    <span className="font-semibold">{order.store_name}</span>
                    <span className="text-slate-500"> / {order.store_slug}</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge tone="info">
                      {label(order.payment_method)}
                    </StatusBadge>
                    <StatusBadge
                      tone={
                        order.status === "delivered"
                          ? "success"
                          : order.status === "cancelled" ||
                              order.status === "rejected" ||
                              order.status === "returned"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {label(order.status)}
                    </StatusBadge>
                  </div>
                  <p className="text-right text-sm">
                    <span className="font-bold">
                      {Number(order.total_amount).toLocaleString("en-LK", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                    <br />
                    <span className="text-xs text-slate-500">
                      {formatDate(order.created_at)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-xs text-slate-400">
          <Link to={storeBase || "/"} className="hover:text-slate-600">
            ← Back to store
          </Link>
        </p>
      </section>
      </div>
    </main>
  );
}

export default ShopperAccountPage;
