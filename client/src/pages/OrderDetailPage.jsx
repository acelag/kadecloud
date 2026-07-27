import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ordersApi } from "../api/client.js";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";

const orderStatuses = [
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

const progressionStatuses = [
  "new",
  "pending_confirmation",
  "confirmed",
  "packed",
  "dispatched",
  "out_for_delivery",
  "delivered"
];

const terminalStatuses = new Set(["returned", "rejected", "cancelled"]);

const codStatuses = [
  "not_verified",
  "phone_confirmed",
  "whatsapp_confirmed",
  "no_answer",
  "suspicious",
  "fake_order"
];

const riskTone = {
  trusted: "success",
  new: "info",
  medium_risk: "warning",
  high_risk: "danger"
};

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

function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [sellerNotes, setSellerNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  async function loadOrder() {
    setError("");

    try {
      const data = await ordersApi.get(id);
      setOrder(data.order);
      setItems(data.items || []);
      setTimeline(data.timeline || []);
      setSellerNotes(data.order?.seller_notes || "");
    } catch (err) {
      setError(err.message || "Unable to load order");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [id]);

  async function updateStatus(status) {
    setSaving("status");
    setError("");

    try {
      await ordersApi.updateStatus(id, status);
      await loadOrder();
    } catch (err) {
      setError(err.message || "Unable to update order status");
    } finally {
      setSaving("");
    }
  }

  async function updateCodStatus(codStatus) {
    setSaving("cod");
    setError("");

    try {
      await ordersApi.updateCodStatus(id, codStatus);
      await loadOrder();
    } catch (err) {
      setError(err.message || "Unable to update COD status");
    } finally {
      setSaving("");
    }
  }

  async function saveNotes() {
    setSaving("notes");
    setError("");

    try {
      await ordersApi.updateNotes(id, sellerNotes);
      await loadOrder();
    } catch (err) {
      setError(err.message || "Unable to save notes");
    } finally {
      setSaving("");
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading order...
      </section>
    );
  }

  if (!order) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || "Order not found"}
      </section>
    );
  }

  const reachedStatuses = (() => {
    const reached = new Set(timeline.map((item) => item.status));

    if (order.status) {
      if (terminalStatuses.has(order.status)) {
        reached.add(order.status);
      } else {
        const idx = progressionStatuses.indexOf(order.status);

        if (idx >= 0) {
          for (let i = 0; i <= idx; i += 1) {
            reached.add(progressionStatuses[i]);
          }
        }
      }
    }

    return reached;
  })();

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/dashboard/orders"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Orders
          </Link>
          <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950">
            {order.order_number}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Created {formatDate(order.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={riskTone[order.customer_risk]}>
            {label(order.customer_risk)}
          </StatusBadge>
          <StatusBadge tone="info">
            {order.payment_method === "bank_transfer"
              ? "Bank Transfer"
              : "Cash on Delivery"}
          </StatusBadge>
          <StatusBadge tone="info">{label(order.cod_status)}</StatusBadge>
          <StatusBadge tone={statusTone[order.status] || "neutral"}>
            {label(order.status)}
          </StatusBadge>
        </div>
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-bold">Customer</h3>
              {order.customer_id ? (
                <Link
                  to={`/dashboard/customers/${order.customer_id}`}
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  View customer profile
                </Link>
              ) : null}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Name</p>
                <p className="font-semibold">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Phone</p>
                <p className="font-semibold">{order.customer_phone}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-slate-500">Address</p>
                <p className="font-semibold">
                  {order.delivery_address}, {order.delivery_city},{" "}
                  {order.delivery_district}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Payment</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Method</p>
                <p className="font-semibold">
                  {order.payment_method === "bank_transfer"
                    ? "Bank Transfer"
                    : "Cash on Delivery"}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Verification</p>
                <p className="font-semibold">{label(order.cod_status)}</p>
              </div>
              {order.payment_reference ? (
                <div className="sm:col-span-2">
                  <p className="text-sm text-slate-500">Customer reference</p>
                  <p className="font-mono text-sm font-semibold">
                    {order.payment_reference}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Order items</h3>
            <div className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 p-4 sm:grid-cols-[1fr_90px_130px]"
                >
                  <div>
                    <p className="font-semibold">{item.product_name}</p>
                    <p className="text-sm text-slate-500">
                      {item.variant_name || "Default"}
                    </p>
                  </div>
                  <p className="text-sm text-slate-600">Qty {item.quantity}</p>
                  <p className="font-semibold">
                    {formatMoney(item.line_total)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end text-lg font-bold">
              Total {formatMoney(order.total_amount)}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Delivery status timeline</h3>
            <div className="mt-5 space-y-4">
              {orderStatuses.map((status) => {
                const isReached = reachedStatuses.has(status);
                const update = timeline.find((item) => item.status === status);

                return (
                  <div key={status} className="flex gap-3">
                    <div
                      className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                        isReached ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    <div>
                      <p
                        className={`text-sm font-semibold ${
                          isReached ? "text-slate-950" : "text-slate-500"
                        }`}
                      >
                        {label(status)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {update ? formatDate(update.created_at) : "Pending"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Order status</h3>
            <select
              value={order.status}
              onChange={(event) => updateStatus(event.target.value)}
              disabled={saving === "status"}
              className="mt-4 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Confirming an order reduces stock once. Cancelling a confirmed
              order restores stock.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Payment verification</h3>
            <div className="mt-4 grid gap-2">
              {codStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => updateCodStatus(status)}
                  disabled={saving === "cod"}
                  className={`rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${
                    order.cod_status === status
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label(status)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold">Internal seller notes</h3>
            <textarea
              value={sellerNotes}
              onChange={(event) => setSellerNotes(event.target.value)}
              rows={5}
              className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Private notes for this order"
            />
            <button
              type="button"
              onClick={saveNotes}
              disabled={saving === "notes"}
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save aria-hidden="true" size={17} />
              {saving === "notes" ? "Saving..." : "Save notes"}
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}

export default OrderDetailPage;
