// Handles the ?token= link from a verification email.
// Works for both admins (/verify-email) and shoppers (/store/:slug/verify-email
// and host-based /verify-email). The `userType` prop selects which API to call.
import { CheckCircle, Loader, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi, shoppersApi } from "../api/client.js";

function VerifyEmailPage({ userType = "admin", storeBase = "" }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus]   = useState("pending"); // pending | success | error
  const [message, setMessage] = useState("");
  const calledRef = useRef(false);

  const loginPath = userType === "shopper"
    ? `${storeBase}/login`
    : "/login";

  useEffect(() => {
    // Strict-mode double-fire guard.
    if (calledRef.current) return;
    calledRef.current = true;

    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    const api = userType === "shopper" ? shoppersApi : authApi;

    api.verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Your email address has been verified.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message || "The verification link is invalid or has expired.");
      });
  }, [token, userType]);

  return (
    <main
      className={`flex min-h-screen items-center justify-center px-4 py-8 ${
        userType === "admin"
          ? "bg-slate-950 text-white"
          : "bg-slate-50 text-slate-950"
      }`}
    >
      <section
        className={`w-full max-w-md rounded-lg border p-8 text-center shadow-sm ${
          userType === "admin"
            ? "border-slate-800 bg-white text-slate-950 shadow-2xl shadow-black/20"
            : "border-slate-200 bg-white"
        }`}
      >
        {status === "pending" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Loader size={28} className="animate-spin" />
            </div>
            <h1 className="text-xl font-bold">Verifying your email…</h1>
            <p className="mt-2 text-sm text-slate-500">Just a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle size={28} />
            </div>
            <h1 className="text-2xl font-bold text-slate-950">Email verified!</h1>
            <p className="mt-3 text-sm text-slate-600">{message}</p>
            <Link
              to={loginPath}
              className="mt-6 block rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Continue to sign in
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
              <XCircle size={28} />
            </div>
            <h1 className="text-2xl font-bold text-slate-950">Verification failed</h1>
            <p className="mt-3 text-sm text-slate-600">{message}</p>
            <p className="mt-4 text-sm text-slate-500">
              Links expire after 24 hours. Sign in and request a new one.
            </p>
            <Link
              to={loginPath}
              className="mt-5 block text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            >
              ← Back to sign in
            </Link>
          </>
        )}
      </section>
    </main>
  );
}

export default VerifyEmailPage;
