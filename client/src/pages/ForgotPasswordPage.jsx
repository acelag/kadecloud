import { CheckCircle, KeyRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api/client.js";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center">
        <div className="w-full rounded-lg border border-slate-800 bg-white p-6 text-slate-950 shadow-2xl shadow-black/20 sm:p-8">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle size={28} />
              </div>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                If <span className="font-semibold">{email}</span> is registered,
                we've sent a password reset link. It expires in{" "}
                <strong>60 minutes</strong>.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Don't see it? Check your spam folder.
              </p>
              <Link
                to="/login"
                className="mt-6 block text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Forgot password?</h1>
                  <p className="text-sm text-slate-500">
                    We'll send a reset link to your email.
                  </p>
                </div>
              </div>

              {error ? (
                <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Email address
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="seller@example.com"
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-600">
                Remember it?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default ForgotPasswordPage;
