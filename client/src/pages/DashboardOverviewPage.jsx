import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  PackageSearch,
  RefreshCcw,
  Shield,
  ShoppingBag
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ordersApi } from "../api/client.js";
import StatCard from "../components/dashboard/StatCard.jsx";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY_STATS = {
  today_orders: 0,
  today_delta: 0,
  pending_cod: 0,
  delivered_week: 0,
  returned_rejected: 0,
  sales_month: 0,
  low_stock: 0
};

function formatLkr(amount) {
  return `LKR ${Number(amount || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0
  })}`;
}

function todayDeltaHelper(delta) {
  if (delta > 0) {
    return `${delta} more than yesterday`;
  }
  if (delta < 0) {
    return `${Math.abs(delta)} fewer than yesterday`;
  }
  return "Same as yesterday";
}

function buildStatCards(stats) {
  return [
    {
      title: "Today's orders",
      value: String(stats.today_orders),
      helper: todayDeltaHelper(stats.today_delta),
      icon: ShoppingBag,
      badge: <StatusBadge tone="success">Live</StatusBadge>
    },
    {
      title: "Pending COD confirmations",
      value: String(stats.pending_cod),
      helper: "Needs seller review",
      icon: ClipboardCheck,
      badge:
        stats.pending_cod > 0 ? (
          <StatusBadge tone="warning">Action</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Clear</StatusBadge>
        )
    },
    {
      title: "Delivered orders",
      value: String(stats.delivered_week),
      helper: "This week",
      icon: CheckCircle2,
      badge: <StatusBadge tone="success">Good</StatusBadge>
    },
    {
      title: "Returned/rejected orders",
      value: String(stats.returned_rejected),
      helper: "Monitor customer risk",
      icon: RefreshCcw,
      badge:
        stats.returned_rejected > 0 ? (
          <StatusBadge tone="danger">Review</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">None</StatusBadge>
        )
    },
    {
      title: "Total sales",
      value: formatLkr(stats.sales_month),
      helper: "Delivered this month",
      icon: ShoppingBag,
      badge: <StatusBadge tone="info">Month</StatusBadge>
    },
    {
      title: "Low stock products",
      value: String(stats.low_stock),
      helper: "At or below threshold",
      icon: PackageSearch,
      badge:
        stats.low_stock > 0 ? (
          <StatusBadge tone="warning">Restock</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Stocked</StatusBadge>
        )
    }
  ];
}

function DashboardOverviewPage() {
  const { user } = useAuth();
  const store = user?.store;
  const isStoreUser = user?.role && user.role !== "platform_admin";
  const [stats, setStats] = useState(EMPTY_STATS);
  const [codQueue, setCodQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isStoreUser) {
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    ordersApi
      .stats()
      .then((data) => {
        if (!active) return;
        setStats({ ...EMPTY_STATS, ...(data.stats || {}) });
        setCodQueue(data.cod_queue || []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Unable to load dashboard metrics");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isStoreUser]);

  if (user?.role === "platform_admin") {
    return (
      <div className="space-y-5">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Super admin
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
            Platform dashboard
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Manage store admin accounts, attach sellers to stores, and support
            store workspaces with log in as.
          </p>
        </section>

        <Link
          to="/dashboard/admin/accounts"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          <Shield aria-hidden="true" size={18} />
          Manage accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Overview
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
            {store?.name || "Seller dashboard"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Live metrics for orders, COD verification, delivery, sales, and
            inventory health.
          </p>
        </div>
        {store?.slug ? (
          <StatusBadge tone="info">Storefront /{store.slug}</StatusBadge>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {buildStatCards(stats).map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold">COD confirmation queue</h3>
              <p className="mt-1 text-sm text-slate-500">
                Orders awaiting COD verification.
              </p>
            </div>
            {stats.pending_cod > 0 ? (
              <StatusBadge tone="warning">
                {stats.pending_cod} pending
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral">All clear</StatusBadge>
            )}
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
            {loading ? (
              <div className="p-6 text-sm text-slate-500">Loading orders...</div>
            ) : codQueue.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                No orders are waiting for COD confirmation.
              </div>
            ) : (
              codQueue.map((item) => (
                <div
                  key={item.order}
                  className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 sm:grid-cols-[120px_1fr_120px_auto] sm:items-center"
                >
                  <p className="font-semibold text-slate-950">{item.order}</p>
                  <p className="text-sm text-slate-600">{item.customer}</p>
                  <p className="text-sm font-semibold text-slate-950">
                    {formatLkr(item.amount)}
                  </p>
                  <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <AlertTriangle aria-hidden="true" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Low stock watch</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {stats.low_stock > 0
                  ? `${stats.low_stock} ${
                      stats.low_stock === 1 ? "product is" : "products are"
                    } at or below the low-stock threshold. Review them on the Inventory page.`
                  : "All products are above their low-stock threshold."}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardOverviewPage;
