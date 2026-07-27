import { CheckCircle2, CreditCard, Landmark, MessageCircle } from "lucide-react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";

function readStoredOrder() {
  const raw = sessionStorage.getItem("kadecloud_last_order");

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_err) {
    return null;
  }
}

function formatStatus(value) {
  return String(value || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function OrderSuccessPage({ slug: slugProp } = {}) {
  const params = useParams();
  const slug = slugProp || params.slug;
  const isHostStorefront = Boolean(slugProp);
  const storeBase = isHostStorefront ? "" : `/store/${slug}`;
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const data = location.state || readStoredOrder();
  const order = data?.order;
  const item = data?.items?.[0];
  const bankDetails = data?.bank_details;
  const isBankTransfer = order?.payment_method === "bank_transfer";
  const isPayhere = order?.payment_method === "payhere";

  // PayHere appends ?payment_id=...&status_code=2 to the return_url on success,
  // or ?status_code=-1 on cancel / failure.
  const payhereStatus = searchParams.get("status_code");
  const payherePaymentId = searchParams.get("payment_id");
  // status_code 2 = success; negative = cancel/fail; null = not a PayHere return
  const payhereSuccess = payhereStatus === "2";
  const payherePending = payhereStatus === null && isPayhere; // landed before IPN

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <section className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            isPayhere && !payhereSuccess && payhereStatus !== null
              ? "bg-red-50 text-red-600"
              : isPayhere
                ? "bg-blue-50 text-blue-600"
                : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {isPayhere ? (
            <CreditCard aria-hidden="true" size={30} />
          ) : (
            <CheckCircle2 aria-hidden="true" size={30} />
          )}
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-normal">
          {isPayhere && !payhereSuccess && payhereStatus !== null
            ? "Payment cancelled"
            : "Order placed"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {isPayhere && payhereSuccess
            ? "Payment received! Your order is confirmed and will be dispatched soon."
            : isPayhere && payhereStatus !== null
              ? "Your payment was not completed. Your order is on hold — you can retry or contact the seller."
              : isPayhere
                ? "Your order has been recorded and is awaiting payment confirmation from PayHere."
                : isBankTransfer
                  ? "Your order has been recorded. Please transfer the total to the account below, then send the seller your reference."
                  : "Your COD order has been created. The seller will verify it before dispatch, so stock has not been reduced yet."}
        </p>

        {order ? (
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Order number</p>
                <p className="mt-1 font-bold">{order.order_number}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Product</p>
                <p className="mt-1 font-bold">{item?.product_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Payment</p>
                <p className="mt-1 font-bold">
                  {isPayhere
                    ? "PayHere (Online)"
                    : isBankTransfer
                      ? "Bank Transfer"
                      : "Cash on Delivery"}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Payment status</p>
                <p className="mt-1 font-bold">
                  {isPayhere
                    ? payhereSuccess
                      ? "Paid"
                      : payhereStatus !== null
                        ? "Not completed"
                        : "Awaiting payment"
                    : formatStatus(order.cod_status)}
                </p>
              </div>
              {payherePaymentId ? (
                <div className="sm:col-span-2">
                  <p className="text-sm text-slate-500">PayHere reference</p>
                  <p className="mt-1 font-mono text-sm font-bold">
                    {payherePaymentId}
                  </p>
                </div>
              ) : null}
              {order.payment_reference ? (
                <div className="sm:col-span-2">
                  <p className="text-sm text-slate-500">Your reference</p>
                  <p className="mt-1 font-mono text-sm font-bold">
                    {order.payment_reference}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {isBankTransfer && bankDetails ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-left">
            <div className="flex items-center gap-2">
              <Landmark
                aria-hidden="true"
                size={18}
                className="text-emerald-700"
              />
              <p className="text-sm font-semibold text-slate-950">
                Transfer to
              </p>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {bankDetails.bank_account_name ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    Account name
                  </dt>
                  <dd className="font-semibold text-slate-950">
                    {bankDetails.bank_account_name}
                  </dd>
                </div>
              ) : null}
              {bankDetails.bank_account_number ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    Account number
                  </dt>
                  <dd className="font-mono text-sm font-semibold text-slate-950">
                    {bankDetails.bank_account_number}
                  </dd>
                </div>
              ) : null}
              {bankDetails.bank_name ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    Bank
                  </dt>
                  <dd className="font-semibold text-slate-950">
                    {bankDetails.bank_name}
                  </dd>
                </div>
              ) : null}
              {bankDetails.bank_branch ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    Branch
                  </dt>
                  <dd className="font-semibold text-slate-950">
                    {bankDetails.bank_branch}
                  </dd>
                </div>
              ) : null}
            </dl>
            {bankDetails.bank_transfer_instructions ? (
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                {bankDetails.bank_transfer_instructions}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {data?.whatsapp_link ? (
            <a
              href={data.whatsapp_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              <MessageCircle aria-hidden="true" size={18} />
              Open WhatsApp
            </a>
          ) : null}
          <Link
            to={order ? `/track/${order.order_number}` : storeBase || "/"}
            className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Track order
          </Link>
          <Link
            to={storeBase || "/"}
            className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  );
}

export default OrderSuccessPage;
