import { Eye, ExternalLink, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ordersApi } from "../api/client.js";

const deliveryStatuses = [
  "all",
  "new",
  "pending_confirmation",
  "confirmed",
  "packed",
  "dispatched",
  "out_for_delivery",
  "delivered",
  "returned",
  "rejected",
  "cancelled"
];

const editableStatuses = deliveryStatuses.filter((status) => status !== "all");

const statusTone = {
  delivered: "success",
  returned: "danger",
  rejected: "danger",
  cancelled: "danger",
  out_for_delivery: "info",
  dispatched: "info",
  packed: "warning",
  confirmed: "warning",
  pending_confirmation: "warning",
  new: "neutral"
};

// Buckets used by the summary cards.
const IN_TRANSIT = ["packed", "dispatched", "out_for_delivery"];
const ISSUES = ["returned", "rejected", "cancelled"];

const TONE_PILL = {
  success: { dot: "bg-emerald-500", cls: "bg-emerald-50 text-emerald-700" },
  danger: { dot: "bg-rose-500", cls: "bg-rose-50 text-rose-700" },
  info: { dot: "bg-sky-500", cls: "bg-sky-50 text-sky-700" },
  warning: { dot: "bg-amber-500", cls: "bg-amber-50 text-amber-700" },
  neutral: { dot: "bg-slate-400", cls: "bg-slate-100 text-slate-600" }
};

const AVATAR_TONES = [
  "bg-indigo-100 text-indigo-700",
  "bg-purple-100 text-purple-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700"
];

function label(value) {
  return String(value || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "Not set";
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function avatarTone(name) {
  const key = String(name || "?");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash + key.charCodeAt(i)) % AVATAR_TONES.length;
  }
  return AVATAR_TONES[hash];
}

function StatusPill({ status }) {
  const pill = TONE_PILL[statusTone[status]] || TONE_PILL.neutral;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${pill.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
      {label(status)}
    </span>
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

function DeliveryPage() {
  const [orders, setOrders] = useState([]);
  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  async function loadOrders() {
    setLoading(true);
    setError("");

    try {
      const data = await ordersApi.list();
      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message || "Unable to load delivery orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const statusCounts = useMemo(() => {
    return editableStatuses.reduce((counts, status) => {
      counts[status] = orders.filter((order) => order.status === status).length;
      return counts;
    }, {});
  }, [orders]);

  const stats = useMemo(() => {
    let inTransit = 0;
    let delivered = 0;
    let issues = 0;
    for (const order of orders) {
      if (IN_TRANSIT.includes(order.status)) inTransit += 1;
      if (order.status === "delivered") delivered += 1;
      if (ISSUES.includes(order.status)) issues += 1;
    }
    return { total: orders.length, inTransit, delivered, issues };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (activeStatus !== "all" && order.status !== activeStatus) {
        return false;
      }
      if (!term) return true;
      return [
        order.order_number,
        order.customer_name,
        order.delivery_city,
        order.delivery_district
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term));
    });
  }, [activeStatus, orders, search]);

  async function updateDeliveryStatus(orderId, status) {
    setSavingId(orderId);
    setError("");

    try {
      await ordersApi.updateStatus(orderId, status);
      await loadOrders();
    } catch (err) {
      setError(err.message || "Unable to update delivery status");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Delivery
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
            Delivery tracking
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Move orders through packing, dispatch, delivery, returns, and
            cancellations. Each status change is added to the customer timeline.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw aria-hidden="true" size={18} />
          Refresh
        </button>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total orders" value={stats.total} />
        <StatCard
          title="In transit"
          value={stats.inTransit}
          valueClass="text-sky-600"
        />
        <StatCard
          title="Delivered"
          value={stats.delivered}
          valueClass="text-emerald-600"
        />
        <StatCard
          title="Issues"
          value={stats.issues}
          valueClass="text-rose-600"
        />
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by order ID, customer, or city..."
            className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {deliveryStatuses.map((status) => {
            const isActive = activeStatus === status;
            const count =
              status === "all" ? orders.length : statusCounts[status] || 0;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setActiveStatus(status)}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {status === "all" ? "All" : label(status)}
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
          <div className="p-6 text-sm text-slate-500">
            Loading delivery orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No orders match this delivery status or search.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredOrders.map((order) => (
              <article
                key={order.id}
                className="grid gap-4 p-4 xl:grid-cols-[auto_150px_minmax(140px,1fr)_140px_190px_96px] xl:items-center"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarTone(
                    order.customer_name
                  )}`}
                  aria-hidden="true"
                >
                  {initials(order.customer_name)}
                </div>

                <div className="min-w-0">
                  <p className="font-bold text-slate-950">
                    {order.order_number}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Updated {formatDate(order.updated_at)}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">
                    {order.customer_name || "Walk-in Customer"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {order.delivery_city || "No city"},{" "}
                    {order.delivery_district || "No district"}
                  </p>
                </div>

                <div className="xl:flex xl:justify-start">
                  <StatusPill status={order.status} />
                </div>

                <select
                  value={order.status}
                  disabled={savingId === order.id}
                  onChange={(event) =>
                    updateDeliveryStatus(order.id, event.target.value)
                  }
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {editableStatuses.map((status) => (
                    <option key={status} value={status}>
                      {label(status)}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2 xl:justify-end">
                  <Link
                    to={`/track/${order.order_number}`}
                    target="_blank"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                    aria-label={`Open public tracking for ${order.order_number}`}
                  >
                    <ExternalLink aria-hidden="true" size={17} />
                  </Link>
                  <Link
                    to={`/dashboard/orders/${order.id}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                    aria-label={`View ${order.order_number}`}
                  >
                    <Eye aria-hidden="true" size={17} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default DeliveryPage;
