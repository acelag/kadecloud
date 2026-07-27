import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

function CustomersListPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No customers yet. Customers are created automatically from checkout.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {customers.map((customer) => (
              <article
                key={customer.id}
                className="grid gap-4 p-4 md:grid-cols-[1fr_160px_140px_80px] md:items-center"
              >
                <div>
                  <p className="font-bold text-slate-950">{customer.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {customer.phone}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {[customer.city, customer.district].filter(Boolean).join(", ")}
                  </p>
                </div>
                <StatusBadge tone={riskTone[customer.risk_status]}>
                  {label(customer.risk_status)}
                </StatusBadge>
                <div className="text-sm">
                  <p className="font-semibold text-slate-950">
                    {customer.total_orders} orders
                  </p>
                  <p className="text-slate-500">
                    {customer.cancelled_orders} cancelled
                  </p>
                </div>
                <Link
                  to={`/dashboard/customers/${customer.id}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                  aria-label={`View ${customer.name}`}
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

export default CustomersListPage;
