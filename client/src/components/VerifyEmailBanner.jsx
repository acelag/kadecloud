// Sticky banner shown to users whose email is not yet verified.
// Supports both store admins (useAuth) and shoppers (useShopperAuth).
//
// Props:
//   userType   — "admin" | "shopper"
//   storeBase  — e.g. "/store/my-shop" (shopper only, for the resend API call)
//   onVerified — optional callback fired after a successful resend so the
//                parent can refresh user state
import { Mail, X } from "lucide-react";
import { useState } from "react";
import { authApi, shoppersApi } from "../api/client.js";

function VerifyEmailBanner({ userType = "admin", storeBase = "", onResent }) {
  const [dismissed,  setDismissed]  = useState(false);
  const [sending,    setSending]    = useState(false);
  const [sent,       setSent]       = useState(false);
  const [error,      setError]      = useState("");

  if (dismissed) return null;

  async function handleResend() {
    setSending(true);
    setError("");
    try {
      if (userType === "shopper") {
        const storeSlug = storeBase.replace(/^\/store\//, "");
        await shoppersApi.resendVerification(storeSlug);
      } else {
        await authApi.resendVerification();
      }
      setSent(true);
      onResent?.();
    } catch (err) {
      setError(err.message || "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="alert"
      className="relative flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 sm:px-6 lg:px-8"
    >
      <Mail aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-amber-600" />

      <div className="flex-1 text-sm">
        {sent ? (
          <p className="font-semibold">
            Verification email sent — check your inbox (and spam folder).
          </p>
        ) : (
          <>
            <p>
              <span className="font-semibold">Please verify your email address.</span>{" "}
              We sent a confirmation link when you signed up.
            </p>

            {error ? (
              <p className="mt-1 text-red-700">{error}</p>
            ) : null}

            <button
              type="button"
              onClick={handleResend}
              disabled={sending}
              className="mt-1.5 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900 disabled:opacity-60"
            >
              {sending ? "Sending…" : "Resend verification email"}
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="mt-0.5 shrink-0 rounded text-amber-600 hover:text-amber-800"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default VerifyEmailBanner;
