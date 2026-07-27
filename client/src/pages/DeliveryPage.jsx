import { Eye, ExternalLink, RefreshCw, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ordersApi } from "../api/client.js";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";

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

function label(value) {
  return String(value || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("en-LK", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "Not set";
}

function DeliveryPage() {
  const [orders, setOrders] = useState([]);
  const [activeStatus, setActiveStatus] = useState("all");
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

  const filteredOrders = useMemo(() => {
    if (activeStatus === "all") {
      return orders;
    }

    return orders.filter((order) => order.status === activeStatus);
  }, [activeStatus, orders]);

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

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <Truck aria-hidden="true" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Delivery queue</h3>
            <p className="text-sm text-slate-500">
              Filter by the current order delivery stage.
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {deliveryStatuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setActiveStatus(status)}
              className={`inline-flex h-10 shrink-0 items-center justify-center rounded-md border px-3 text-sm font-semibold transition ${
                activeStatus === status
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {status === "all"
                ? `All (${orders.length})`
                : `${label(status)} (${statusCounts[status] || 0})`}
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">
            Loading delivery orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No orders found for this delivery status.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredOrders.map((order) => (
              <article
                key={order.id}
                className="grid gap-4 p-4 xl:grid-cols-[150px_1fr_170px_210px_100px] xl:items-center"
              >
                <div>
                  <p className="font-bold text-slate-950">
                    {order.order_number}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Updated {formatDate(order.updated_at)}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-950">
                    {order.customer_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {order.delivery_city || "No city"},{" "}
                    {order.delivery_district || "No district"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={statusTone[order.status]}>
                    {label(order.status)}
                  </StatusBadge>
                  <StatusBadge tone="info">{label(order.cod_status)}</StatusBadge>
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
