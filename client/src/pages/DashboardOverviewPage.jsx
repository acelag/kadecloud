import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  PackageSearch,
  RefreshCcw,
  Shield,
  ShoppingBag
} from "lucide-react";
import { Link } from "react-router-dom";
import StatCard from "../components/dashboard/StatCard.jsx";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const stats = [
  {
    title: "Today's orders",
    value: "18",
    helper: "6 more than yesterday",
    icon: ShoppingBag,
    badge: <StatusBadge tone="success">Live</StatusBadge>
  },
  {
    title: "Pending COD confirmations",
    value: "7",
    helper: "Needs seller review",
    icon: ClipboardCheck,
    badge: <StatusBadge tone="warning">Action</StatusBadge>
  },
  {
    title: "Delivered orders",
    value: "42",
    helper: "This week",
    icon: CheckCircle2,
    badge: <StatusBadge tone="success">Good</StatusBadge>
  },
  {
    title: "Returned/rejected orders",
    value: "3",
    helper: "Monitor customer risk",
    icon: RefreshCcw,
    badge: <StatusBadge tone="danger">Review</StatusBadge>
  },
  {
    title: "Total sales",
    value: "LKR 128,400",
    helper: "Placeholder month total",
    icon: ShoppingBag,
    badge: <StatusBadge tone="info">MVP</StatusBadge>
  },
  {
    title: "Low stock products",
    value: "5",
    helper: "Variants below threshold",
    icon: PackageSearch,
    badge: <StatusBadge tone="warning">Restock</StatusBadge>
  }
];

const codQueue = [
  {
    order: "KC-1024",
    customer: "Ayesha Fernando",
    amount: "LKR 6,450",
    status: "Pending COD",
    tone: "warning"
  },
  {
    order: "KC-1025",
    customer: "Dilshan Silva",
    amount: "LKR 3,200",
    status: "Verified",
    tone: "success"
  },
  {
    order: "KC-1026",
    customer: "Nethmi Perera",
    amount: "LKR 9,800",
    status: "High risk",
    tone: "danger"
  }
];

function DashboardOverviewPage() {
  const { user } = useAuth();
  const store = user?.store;

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
            Placeholder metrics for orders, COD verification, delivery, sales,
            and inventory health.
          </p>
        </div>
        {store?.slug ? (
          <StatusBadge tone="info">Storefront /{store.slug}</StatusBadge>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold">COD confirmation queue</h3>
              <p className="mt-1 text-sm text-slate-500">
                Sample orders that will need seller attention.
              </p>
            </div>
            <StatusBadge tone="warning">7 pending</StatusBadge>
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
            {codQueue.map((item) => (
              <div
                key={item.order}
                className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 sm:grid-cols-[120px_1fr_120px_auto] sm:items-center"
              >
                <p className="font-semibold text-slate-950">{item.order}</p>
                <p className="text-sm text-slate-600">{item.customer}</p>
                <p className="text-sm font-semibold text-slate-950">
                  {item.amount}
                </p>
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
              </div>
            ))}
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
                Five products are below their placeholder threshold. Inventory
                rules will connect here when product management is built.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardOverviewPage;
