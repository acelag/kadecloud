import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import GoogleSignInButton from "../components/storefront/GoogleSignInButton.jsx";
import { useShopperAuth } from "../context/ShopperAuthContext.jsx";

function ShopperSignupPage({ storeBase = "" }) {
  const { register, loginWithGoogle, googleClientId } = useShopperAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const redirectTo = location.state?.from || storeBase || "/";

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors([]);
    try {
      const storeSlug = storeBase.replace(/^\/store\//, "");
      await register({ ...form, store_slug: storeSlug });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || "Unable to create account");
      setFieldErrors(err.errors || []);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle(idToken) {
    setError("");
    try {
      await loginWithGoogle(idToken);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || "Google sign-in failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold">Create account</h1>
        <p className="mt-1 text-sm text-slate-600">
          One account works at every store on KadeCloud.
        </p>

        <div className="mt-6 space-y-3">
          <GoogleSignInButton
            clientId={googleClientId}
            onCredential={handleGoogle}
            onError={(err) => setError(err.message || "Google failed")}
          />
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>or with email</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{error}</p>
            {fieldErrors.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {fieldErrors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Name</span>
            <input
              name="name"
              value={form.name}
              onChange={updateField}
              autoComplete="name"
              className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={updateField}
              required
              autoComplete="email"
              className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Password
            </span>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={updateField}
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Minimum 8 characters.
            </span>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link
            to={`${storeBase}/login`}
            state={{ from: redirectTo }}
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

export default ShopperSignupPage;
