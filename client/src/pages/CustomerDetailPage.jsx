import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { customersApi } from "../api/client.js";
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

function CustomerDetailPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCustomer() {
      setLoading(true);
      setError("");

      try {
        const data = await customersApi.get(id);

        if (isMounted) {
          setCustomer(data.customer);
          setOrders(data.orders || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load customer");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadCustomer();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading customer...
      </section>
    );
  }

  if (!customer) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || "Customer not found"}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/dashboard/customers"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Customers
          </Link>
          <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950">
            {customer.name}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{customer.phone}</p>
        </div>
        <StatusBadge tone={riskTone[customer.risk_status]}>
          {label(customer.risk_status)}
        </StatusBadge>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Customer profile</h3>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="text-slate-500">Address</p>
              <p className="font-semibold">
                {customer.address || "Not set"}
              </p>
            </div>
            <div>
              <p className="text-slate-500">City</p>
              <p className="font-semibold">{customer.city || "Not set"}</p>
            </div>
            <div>
              <p className="text-slate-500">District</p>
              <p className="font-semibold">
                {customer.district || "Not set"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-slate-500">Orders</p>
                <p className="text-xl font-bold">{customer.total_orders}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-slate-500">Cancelled</p>
                <p className="text-xl font-bold">
                  {customer.cancelled_orders}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Order history</h3>
          <div className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
            {orders.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No orders found.</div>
            ) : (
              orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/dashboard/orders/${order.id}`}
                  className="grid gap-2 p-4 transition hover:bg-slate-50 sm:grid-cols-[130px_1fr_130px]"
                >
                  <p className="font-semibold text-slate-950">
                    {order.order_number}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone="warning">{label(order.status)}</StatusBadge>
                    <StatusBadge tone="info">{label(order.cod_status)}</StatusBadge>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p className="font-semibold">
                      {formatMoney(order.total_amount)}
                    </p>
                    <p className="text-slate-500">{formatDate(order.created_at)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default CustomerDetailPage;
