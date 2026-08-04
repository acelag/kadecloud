import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { customersApi } from "../api/client.js";

const RISK_TABS = [
  { key: "all", label: "All" },
  { key: "trusted", label: "Trusted" },
  { key: "new", label: "New" },
  { key: "medium_risk", label: "Medium risk" },
  { key: "high_risk", label: "High risk" }
];

// Right-hand risk pill: coloured dot + light fill, keyed by risk status.
const RISK_PILL = {
  trusted: { dot: "bg-emerald-500", cls: "bg-emerald-50 text-emerald-700" },
  new: { dot: "bg-sky-500", cls: "bg-sky-50 text-sky-700" },
  medium_risk: { dot: "bg-amber-500", cls: "bg-amber-50 text-amber-700" },
  high_risk: { dot: "bg-rose-500", cls: "bg-rose-50 text-rose-700" }
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

function label(value) {
  return String(value || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatJoined(value) {
  if (!value) return "—";
  return `Joined ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric"
  }).format(new Date(value))}`;
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

function RiskPill({ risk }) {
  const pill = RISK_PILL[risk] || RISK_PILL.new;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${pill.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
      {label(risk)}
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

function CustomersListPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    let isMounted = true;

    async function loadCustomers() {
      setLoading(true);
      setError("");

      try {
        const data = await customersApi.list();

        if (isMounted) {
          setCustomers(data.customers || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load customers");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadCustomers();

    return () => {
      isMounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const counts = {
      all: customers.length,
      trusted: 0,
      new: 0,
      medium_risk: 0,
      high_risk: 0
    };
    let totalOrders = 0;
    for (const customer of customers) {
      if (counts[customer.risk_status] !== undefined) {
        counts[customer.risk_status] += 1;
      }
      totalOrders += Number(customer.total_orders || 0);
    }
    return {
      counts,
      totalOrders,
      atRisk: counts.medium_risk + counts.high_risk
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((customer) => {
      if (activeTab !== "all" && customer.risk_status !== activeTab) {
        return false;
      }
      if (!term) return true;
      return [customer.name, customer.phone, customer.city]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term));
    });
  }, [customers, search, activeTab]);

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Customers
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
          Customer risk
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Review customer history and risk signals calculated from delivered,
          returned, rejected, and fake orders.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total customers" value={stats.counts.all} />
        <StatCard
          title="Trusted"
          value={stats.counts.trusted}
          valueClass="text-emerald-600"
        />
        <StatCard
          title="At risk"
          value={stats.atRisk}
          valueClass="text-rose-600"
        />
        <StatCard title="Total orders" value={stats.totalOrders} />
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
            placeholder="Search by name, phone, or city..."
            className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {RISK_TABS.map((tab) => {
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
          <div className="p-6 text-sm text-slate-500">Loading customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            {customers.length === 0
              ? "No customers yet. Customers are created automatically from checkout."
              : "No customers match your search or filter."}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredCustomers.map((customer) => {
              const location = [customer.city, customer.district]
                .filter(Boolean)
                .join(", ");
              const cancelled = Number(customer.cancelled_orders || 0);
              return (
                <Link
                  key={customer.id}
                  to={`/dashboard/customers/${customer.id}`}
                  className="grid gap-4 p-4 transition hover:bg-slate-50 lg:grid-cols-[auto_minmax(160px,1.4fr)_minmax(140px,1fr)_130px_140px_130px] lg:items-center"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarTone(
                      customer.name
                    )}`}
                    aria-hidden="true"
                  >
                    {initials(customer.name)}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-950">
                      {customer.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {customer.phone || "—"}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-600">
                      {location || "—"}
                    </p>
                  </div>

                  <div className="text-sm">
                    <p className="font-semibold text-slate-950">
                      {customer.total_orders} orders
                    </p>
                    <p
                      className={`text-xs ${
                        cancelled > 0 ? "text-rose-600" : "text-slate-500"
                      }`}
                    >
                      {cancelled > 0
                        ? `${cancelled} cancelled`
                        : "No cancellations"}
                    </p>
                  </div>

                  <div className="text-sm text-slate-500">
                    {formatJoined(customer.created_at)}
                  </div>

                  <div className="lg:flex lg:justify-end">
                    <RiskPill risk={customer.risk_status} />
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

export default CustomersListPage;
