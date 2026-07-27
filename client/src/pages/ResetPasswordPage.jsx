import { CheckCircle, Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../api/client.js";

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md rounded-lg border border-slate-800 bg-white p-8 text-center text-slate-950 shadow-2xl">
          <p className="text-sm text-red-600 font-semibold">
            Invalid or missing reset token.
          </p>
          <Link
            to="/forgot-password"
            className="mt-4 block text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Request a new reset link
          </Link>
        </div>
      </main>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
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
          {done ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle size={28} />
              </div>
              <h1 className="text-2xl font-bold">Password updated!</h1>
              <p className="mt-3 text-sm text-slate-600">
                Your password has been changed. Sign in with your new password.
              </p>
              <Link
                to="/login"
                className="mt-6 block rounded-md bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                  <Lock size={20} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Set new password</h1>
                  <p className="text-sm text-slate-500">
                    Choose a strong password for your account.
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
                    New password
                  </span>
                  <div className="relative mt-2">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      className="h-11 w-full rounded-md border border-slate-300 pl-3 pr-10 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Confirm password
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Same password again"
                    className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Updating…" : "Update password"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-500">
                Link expired?{" "}
                <Link
                  to="/forgot-password"
                  className="font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Request a new one
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default ResetPasswordPage;
