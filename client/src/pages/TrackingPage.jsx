import {
  ArrowLeft,
  Landmark,
  MessageCircle,
  PackageCheck,
  Search,
  Truck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { publicOrdersApi } from "../api/client.js";
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

function TrackingPage() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const [lookup, setLookup] = useState(orderNumber || "");
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadTracking() {
      setLoading(true);
      setError("");

      try {
        const data = await publicOrdersApi.track(orderNumber);

        if (isMounted) {
          setTracking(data);
          setLookup(data.order?.order_number || orderNumber);
        }
      } catch (err) {
        if (isMounted) {
          setTracking(null);
          setError(err.message || "Unable to find this order");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadTracking();

    return () => {
      isMounted = false;
    };
  }, [orderNumber]);

  function submitLookup(event) {
    event.preventDefault();
    const normalized = lookup.trim();

    if (normalized) {
      navigate(`/track/${encodeURIComponent(normalized)}`);
    }
  }

  const lastUpdated = useMemo(() => {
    const timeline = tracking?.timeline || [];
    const latestUpdate = timeline[timeline.length - 1];
    return latestUpdate?.created_at || tracking?.order?.updated_at;
  }, [tracking]);

  const reachedStatuses = useMemo(() => {
    const statuses = new Set(
      (tracking?.timeline || []).map((item) => item.status)
    );

    if (tracking?.order?.status) {
      statuses.add(tracking.order.status);
    }

    return statuses;
  }, [tracking]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          KadeCloud
        </Link>

        <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  Order tracking
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-normal">
                  {tracking?.order?.order_number || orderNumber}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {tracking?.store?.name
                    ? `${tracking.store.name} will update this timeline as your order moves.`
                    : "Enter an order number to check the latest delivery status."}
                </p>
              </div>
              {tracking?.order?.status ? (
                <StatusBadge tone={statusTone[tracking.order.status]}>
                  {label(tracking.order.status)}
                </StatusBadge>
              ) : null}
            </div>

            <form
              onSubmit={submitLookup}
              className="mt-6 flex flex-col gap-3 sm:flex-row"
            >
              <label className="sr-only" htmlFor="orderLookup">
                Order number
              </label>
              <input
                id="orderLookup"
                value={lookup}
                onChange={(event) => setLookup(event.target.value)}
                className="h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm uppercase outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="KC-000001"
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                <Search aria-hidden="true" size={18} />
                Track
              </button>
            </form>

            {error ? (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {loading ? (
              <p className="mt-6 text-sm text-slate-500">
                Loading tracking details...
              </p>
            ) : tracking ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Store</p>
                    <p className="mt-1 font-bold">{tracking.store.name}</p>
                  </div>
                  <div className="rounded-md bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Payment</p>
                    <p className="mt-1 font-bold">
                      {tracking.order.payment_method === "bank_transfer"
                        ? "Bank Transfer"
                        : "Cash on Delivery"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {label(tracking.order.cod_status)}
                    </p>
                  </div>
                  <div className="rounded-md bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Last updated</p>
                    <p className="mt-1 font-bold">{formatDate(lastUpdated)}</p>
                  </div>
                </div>

                {tracking.order.payment_method === "bank_transfer" &&
                tracking.store?.bank_details ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                    <div className="flex items-center gap-2">
                      <Landmark
                        aria-hidden="true"
                        size={18}
                        className="text-emerald-700"
                      />
                      <p className="text-sm font-semibold text-slate-950">
                        Transfer details
                      </p>
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      {tracking.store.bank_details.bank_account_name ? (
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-slate-500">
                            Account name
                          </dt>
                          <dd className="font-semibold text-slate-950">
                            {tracking.store.bank_details.bank_account_name}
                          </dd>
                        </div>
                      ) : null}
                      {tracking.store.bank_details.bank_account_number ? (
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-slate-500">
                            Account number
                          </dt>
                          <dd className="font-mono text-sm font-semibold text-slate-950">
                            {tracking.store.bank_details.bank_account_number}
                          </dd>
                        </div>
                      ) : null}
                      {tracking.store.bank_details.bank_name ? (
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-slate-500">
                            Bank
                          </dt>
                          <dd className="font-semibold text-slate-950">
                            {tracking.store.bank_details.bank_name}
                          </dd>
                        </div>
                      ) : null}
                      {tracking.store.bank_details.bank_branch ? (
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-slate-500">
                            Branch
                          </dt>
                          <dd className="font-semibold text-slate-950">
                            {tracking.store.bank_details.bank_branch}
                          </dd>
                        </div>
                      ) : null}
                      {tracking.order.payment_reference ? (
                        <div className="sm:col-span-2">
                          <dt className="text-xs uppercase tracking-wide text-slate-500">
                            Your reference
                          </dt>
                          <dd className="font-mono text-sm font-semibold text-slate-950">
                            {tracking.order.payment_reference}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    {tracking.store.bank_details.bank_transfer_instructions ? (
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                        {tracking.store.bank_details.bank_transfer_instructions}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-lg border border-slate-200 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                      <Truck aria-hidden="true" size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Delivery timeline</h2>
                      <p className="text-sm text-slate-500">
                        Status updates from the seller.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {orderStatuses.map((status) => {
                      const update = tracking.timeline.find(
                        (item) => item.status === status
                      );
                      const isCurrent = tracking.order.status === status;
                      const isReached = reachedStatuses.has(status);
                      const date =
                        update?.created_at ||
                        (isCurrent ? tracking.order.updated_at : null);

                      return (
                        <div key={status} className="flex gap-3">
                          <div
                            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              isReached
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-slate-300 bg-white text-slate-300"
                            }`}
                          >
                            {isReached ? (
                              <PackageCheck aria-hidden="true" size={12} />
                            ) : null}
                          </div>
                          <div>
                            <p
                              className={`text-sm font-semibold ${
                                isReached ? "text-slate-950" : "text-slate-500"
                              }`}
                            >
                              {label(status)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {date ? formatDate(date) : "Pending"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Need help?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Contact the seller with your order number ready.
            </p>
            {tracking?.contact_whatsapp_link ? (
              <a
                href={tracking.contact_whatsapp_link}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                <MessageCircle aria-hidden="true" size={18} />
                Contact seller
              </a>
            ) : tracking?.store?.phone ? (
              <a
                href={`tel:${tracking.store.phone}`}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Contact seller
              </a>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Seller contact details are not available.
              </p>
            )}
            {tracking?.store?.slug ? (
              <Link
                to={`/store/${tracking.store.slug}`}
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Visit store
              </Link>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

export default TrackingPage;
