import { Shield, ShoppingBag, User } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const DEMO_ACCOUNTS = [
  {
    role: "Super admin",
    email: "admin@example.com",
    password: "Password123",
    description: "Manage every store and impersonate accounts.",
    icon: Shield,
    tone: "bg-rose-50 text-rose-700"
  },
  {
    role: "Store admin",
    email: "aselagamlath@gmail.com",
    password: "Password123",
    description: "Owns kade Fashion — products, orders, POS, settings.",
    icon: User,
    tone: "bg-emerald-50 text-emerald-700"
  },
  {
    role: "Seller",
    email: "seller@example.com",
    password: "Password123",
    description: "Staff seat — sells at POS, processes orders.",
    icon: ShoppingBag,
    tone: "bg-sky-50 text-sky-700"
  }
];

function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectTo = location.state?.from?.pathname || "/dashboard";

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function submitCredentials(credentials) {
    setError("");
    setIsSubmitting(true);

    try {
      await login(credentials);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || "Unable to log in");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function useDemoAccount(account) {
    const credentials = { email: account.email, password: account.password };
    setForm(credentials);
    await submitCredentials(credentials);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await submitCredentials(form);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_440px]">
        <div className="max-w-xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-300">
            KadeCloud
          </p>
          <h1 className="text-4xl font-bold tracking-normal sm:text-6xl">
            Sign in to manage your store.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
            Keep orders, stock, customers, and COD verification moving from one
            store workspace.
          </p>

          <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
              Demo accounts
            </p>
            <p className="mt-1 text-sm text-slate-400">
              One-click login. Password for all three:{" "}
              <span className="font-mono text-slate-200">Password123</span>
            </p>
            <div className="mt-4 grid gap-2">
              {DEMO_ACCOUNTS.map((account) => {
                const Icon = account.icon;
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => useDemoAccount(account)}
                    disabled={isSubmitting}
                    className="group flex items-start gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3 text-left transition hover:border-emerald-500 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${account.tone}`}
                    >
                      <Icon aria-hidden="true" size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white">
                          {account.role}
                        </span>
                        <span className="text-xs font-semibold text-emerald-300 transition group-hover:text-emerald-200">
                          Sign in →
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-xs text-slate-300">
                        {account.email}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">
                        {account.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-slate-800 bg-white p-6 text-slate-950 shadow-2xl shadow-black/20 sm:p-8"
        >
          <div>
            <h2 className="text-2xl font-bold">Login</h2>
            <p className="mt-2 text-sm text-slate-600">
              Use your Store Admin or seller account details.
            </p>
          </div>

          {error ? (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={updateField}
                required
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="seller@example.com"
              />
            </label>

            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  Password
                </span>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={updateField}
                required
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Password123"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-md bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>

          <p className="mt-5 text-center text-sm text-slate-600">
            New to KadeCloud?{" "}
            <Link
              to="/register"
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Create an account
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
