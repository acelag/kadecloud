import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ordersApi } from "../api/client.js";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";

const riskTone = {
  trusted: "success",
  new: "info",
  medium_risk: "warning",
  high_risk: "danger"
};

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
  return value
    ? new Intl.DateTimeFormat("en-LK", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "Not set";
}

function OrdersListPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No orders yet. Customer orders will appear here after checkout.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {orders.map((order) => (
              <article
                key={order.id}
                className="grid gap-4 p-4 lg:grid-cols-[150px_1fr_150px_170px_80px] lg:items-center"
              >
                <div>
                  <p className="font-bold text-slate-950">
                    {order.order_number}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(order.created_at)}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-950">
                    {order.customer_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {order.customer_phone}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
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
                    <StatusBadge tone="info">{label(order.cod_status)}</StatusBadge>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="font-bold text-slate-950">
                    {formatMoney(order.total_amount)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    tone={
                      order.status === "cancelled" ||
                      order.status === "rejected" ||
                      order.status === "returned"
                        ? "danger"
                        : order.status === "delivered"
                          ? "success"
                          : "warning"
                    }
                  >
                    {label(order.status)}
                  </StatusBadge>
                  {order.stock_reduced_at ? (
                    <StatusBadge tone="success">Stock reduced</StatusBadge>
                  ) : null}
                </div>

                <Link
                  to={`/dashboard/orders/${order.id}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                  aria-label={`View ${order.order_number}`}
                >
                  <Eye aria-hidden="true" size={17} />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default OrdersListPage;
