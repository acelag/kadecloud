import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ordersApi } from "../api/client.js";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";

const riskTone = {
  trusted: "success",
  new: "info",
  medium_risk: "warning",
  high_risk: "danger"
};

// Many granular order statuses roll up into the four buckets shown as filters.
const GROUP_BY_STATUS = {
  new: "new",
  pending_confirmation: "new",
  confirmed: "confirmed",
  packed: "confirmed",
  dispatched: "confirmed",
  out_for_delivery: "confirmed",
  delivered: "delivered",
  returned: "cancelled",
  rejected: "cancelled",
  cancelled: "cancelled"
};

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "confirmed", label: "Confirmed" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" }
];

// Right-hand status pill: coloured dot + light fill, keyed by bucket.
const STATUS_PILL = {
  new: { dot: "bg-sky-500", cls: "bg-sky-50 text-sky-700" },
  confirmed: { dot: "bg-amber-500", cls: "bg-amber-50 text-amber-700" },
  delivered: { dot: "bg-emerald-500", cls: "bg-emerald-50 text-emerald-700" },
  cancelled: { dot: "bg-rose-500", cls: "bg-rose-50 text-rose-700" }
};

// COD verification tone — reassuring green when confirmed, alarming when not.
const codTone = {
  phone_confirmed: "success",
  whatsapp_confirmed: "success",
  not_verified: "danger",
  no_answer: "warning",
  suspicious: "danger",
  fake_order: "danger"
};

// Avatar chip colours, chosen deterministically from the customer name.
const AVATAR_TONES = [
  "bg-indigo-100 text-indigo-700",
  "bg-purple-100 text-purple-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700"
];

// Orders at or above this total get a "High value" flag beside the number.
const HIGH_VALUE_THRESHOLD = 10000;

function statusGroup(status) {
  return GROUP_BY_STATUS[status] || "new";
}

function label(value) {
  return String(value || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMoney(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    date
  );
  const time = new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(
    date
  );
  return `${day} · ${time}`;
}

function initials(name, fallback) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return (
      String(fallback || "")
        .replace(/[^A-Za-z0-9]/g, "")
        .slice(-2)
        .toUpperCase() || "?"
    );
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
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
  const pill = STATUS_PILL[statusGroup(status)] || STATUS_PILL.new;
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

function OrdersListPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      setLoading(true);
      setError("");

      try {
        const data = await ordersApi.list();

        if (isMounted) {
          setOrders(data.orders || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load orders");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      isMounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const counts = { all: orders.length, new: 0, confirmed: 0, delivered: 0, cancelled: 0 };
    let revenue = 0;
    for (const order of orders) {
      const group = statusGroup(order.status);
      counts[group] += 1;
      if (group !== "cancelled") {
        revenue += Number(order.total_amount || 0);
      }
    }
    return { counts, revenue };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (activeTab !== "all" && statusGroup(order.status) !== activeTab) {
        return false;
      }
      if (!term) return true;
      return [order.order_number, order.customer_name, order.customer_phone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term));
    });
  }, [orders, search, activeTab]);

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Orders
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
          Manage orders
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Review COD confirmations, customer risk, and delivery progress.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total orders" value={stats.counts.all} />
        <StatCard
          title="Pending"
          value={stats.counts.new}
          valueClass="text-indigo-600"
        />
        <StatCard
          title="Delivered"
          value={stats.counts.delivered}
          valueClass="text-emerald-600"
        />
        <StatCard title="Revenue" value={formatMoney(stats.revenue)} />
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:flex-1">
          <Search
            aria-hidden="true"
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by order ID, customer, or phone..."
            className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = stats.counts[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
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
          <div className="p-6 text-sm text-slate-500">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            {orders.length === 0
              ? "No orders yet. Customer orders will appear here after checkout."
              : "No orders match your search or filter."}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredOrders.map((order) => {
              const isHighValue =
                Number(order.total_amount || 0) >= HIGH_VALUE_THRESHOLD;
              return (
                <Link
                  key={order.id}
                  to={`/dashboard/orders/${order.id}`}
                  className="grid gap-4 p-4 transition hover:bg-slate-50 lg:grid-cols-[auto_170px_minmax(140px,1fr)_minmax(180px,1.4fr)_130px_130px] lg:items-center"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarTone(
                      order.customer_name
                    )}`}
                    aria-hidden="true"
                  >
                    {initials(order.customer_name, order.order_number)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-bold text-slate-950">
                        {order.order_number}
                      </p>
                      {isHighValue ? (
                        <span className="text-xs font-semibold text-amber-600">
                          High value
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(order.created_at)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">
                      {order.customer_name || "Walk-in Customer"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {order.customer_phone || "—"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {order.channel === "pos" ? (
                      <StatusBadge tone="success">POS</StatusBadge>
                    ) : null}
                    <StatusBadge tone={riskTone[order.customer_risk]}>
                      {label(order.customer_risk)}
                    </StatusBadge>
                    <StatusBadge
                      tone={
                        order.payment_method === "bank_transfer"
                          ? "warning"
                          : order.payment_method === "card"
                            ? "info"
                            : order.payment_method === "cash"
                              ? "success"
                              : "neutral"
                      }
                    >
                      {label(order.payment_method)}
                    </StatusBadge>
                    {order.cod_status ? (
                      <StatusBadge tone={codTone[order.cod_status] || "neutral"}>
                        {label(order.cod_status)}
                      </StatusBadge>
                    ) : null}
                  </div>

                  <div className="lg:text-right">
                    <p className="font-bold text-slate-950">
                      {formatMoney(order.total_amount)}
                    </p>
                    {order.stock_reduced_at ? (
                      <p className="mt-1 text-xs font-medium text-emerald-600">
                        Stock reduced
                      </p>
                    ) : null}
                  </div>

                  <div className="lg:flex lg:justify-end">
                    <StatusPill status={order.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default OrdersListPage;
