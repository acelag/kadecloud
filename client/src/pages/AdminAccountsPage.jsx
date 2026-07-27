import { LogIn, Plus, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../api/client.js";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const emptyAccount = {
  name: "",
  email: "",
  password: "",
  role: "store_admin",
  store_id: "",
  businessName: "",
  businessCategory: "",
  phone: "",
  address: "",
  city: "",
  district: ""
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

function AdminAccountsPage() {
  const navigate = useNavigate();
  const { impersonate, user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState(emptyAccount);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actingId, setActingId] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [message, setMessage] = useState("");

  async function loadAccounts() {
    setLoading(true);
    setError("");

    try {
      const data = await adminApi.listAccounts();
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err.message || "Unable to load accounts");
    } finally {
      setLoading(false);
    }
  }

  async function loadStores() {
    try {
      const data = await adminApi.listStores();
      setStores(data.stores || []);
    } catch (_err) {
      setStores([]);
    }
  }

  useEffect(() => {
    if (user?.role === "store_admin") {
      setForm((current) => ({
        ...current,
        role: "seller"
      }));
    }

    loadAccounts();
    loadStores();
  }, [user?.role]);

  function updateForm(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function createAccount(event) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setMessage("");
    setFieldErrors([]);

    try {
      await adminApi.createAccount(form);
      setForm({
        ...emptyAccount,
        role: user?.role === "store_admin" ? "seller" : "store_admin"
      });
      setMessage("Account created");
      await loadAccounts();
    } catch (err) {
      setError(err.message || "Unable to create account");
      setFieldErrors(err.errors || []);
    } finally {
      setCreating(false);
    }
  }

  async function loginAs(accountId) {
    setActingId(accountId);
    setError("");
    setMessage("");

    try {
      const data = await adminApi.loginAs(accountId);
      impersonate(data);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Unable to log in as this account");
    } finally {
      setActingId("");
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Super admin
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
          Accounts
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {user?.role === "platform_admin"
            ? "Create store admins, attach sellers to stores, and use log in as for support checks."
            : "Create seller accounts for your store."}
        </p>
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <form
          onSubmit={createAccount}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <Plus aria-hidden="true" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Add account</h3>
              <p className="text-sm text-slate-500">
                {user?.role === "platform_admin"
                  ? "Store admins get a new store. Sellers attach to a store."
                  : "Seller accounts attach to your store."}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {user?.role === "platform_admin" ? (
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Role</span>
                <select
                  name="role"
                  value={form.role}
                  onChange={updateForm}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="store_admin">Store Admin</option>
                  <option value="seller">Seller</option>
                </select>
              </label>
            ) : (
              <div className="rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                Role: Seller
              </div>
            )}

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Name</span>
              <input
                name="name"
                value={form.name}
                onChange={updateForm}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Account owner"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={updateForm}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="seller@example.com"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Password
              </span>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={updateForm}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Password123"
              />
            </label>

            {user?.role === "platform_admin" && form.role === "seller" ? (
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Store
                </span>
                <select
                  name="store_id"
                  value={form.store_id}
                  onChange={updateForm}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Select a store</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name} /{store.slug}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {form.role === "store_admin" ? (
              <>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    Business name
                  </span>
                  <input
                    name="businessName"
                    value={form.businessName}
                    onChange={updateForm}
                    className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Kade Fashion"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="text-sm font-semibold text-slate-700">
                      Category
                    </span>
                    <input
                      name="businessCategory"
                      value={form.businessCategory}
                      onChange={updateForm}
                      className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Clothing"
                    />
                  </label>
                  <label>
                    <span className="text-sm font-semibold text-slate-700">
                      Phone
                    </span>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={updateForm}
                      className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="0771234567"
                    />
                  </label>
                  <label>
                    <span className="text-sm font-semibold text-slate-700">
                      City
                    </span>
                    <input
                      name="city"
                      value={form.city}
                      onChange={updateForm}
                      className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Colombo"
                    />
                  </label>
                  <label>
                    <span className="text-sm font-semibold text-slate-700">
                      District
                    </span>
                    <input
                      name="district"
                      value={form.district}
                      onChange={updateForm}
                      className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Colombo"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    Address
                  </span>
                  <input
                    name="address"
                    value={form.address}
                    onChange={updateForm}
                    className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Shop address"
                  />
                </label>
              </>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={creating}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus aria-hidden="true" size={18} />
            {creating ? "Creating..." : "Create account"}
          </button>
        </form>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <Shield aria-hidden="true" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">All accounts</h3>
              <p className="text-sm text-slate-500">
                {user?.role === "platform_admin"
                  ? "Store admins, sellers, and super admins."
                  : "Store admins and sellers in your store."}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No accounts found.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {accounts.map((account) => (
                <article
                  key={account.id}
                  className="grid gap-4 p-4 lg:grid-cols-[1fr_160px_170px_120px] lg:items-center"
                >
                  <div>
                    <p className="font-bold text-slate-950">{account.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {account.email}
                    </p>
                    {account.store ? (
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        /{account.store.slug}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge
                      tone={
                        account.role === "platform_admin"
                          ? "danger"
                          : account.role === "store_admin"
                            ? "warning"
                            : "info"
                      }
                    >
                      {account.role === "platform_admin"
                        ? "Super admin"
                        : account.role === "store_admin"
                          ? "Store Admin"
                        : label(account.role)}
                    </StatusBadge>
                    {account.is_active ? (
                      <StatusBadge tone="success">Active</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Inactive</StatusBadge>
                    )}
                  </div>

                  <p className="text-sm text-slate-500">
                    Created {formatDate(account.created_at)}
                  </p>

                  {["store_admin", "seller"].includes(account.role) &&
                  user?.role === "platform_admin" ? (
                    <button
                      type="button"
                      onClick={() => loginAs(account.id)}
                      disabled={actingId === account.id}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <LogIn aria-hidden="true" size={17} />
                      {actingId === account.id ? "Opening..." : "Log in as"}
                    </button>
                  ) : (
                    <span className="text-sm text-slate-400">
                      {user?.role === "platform_admin"
                        ? "Admin account"
                        : "Store account"}
                    </span>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

export default AdminAccountsPage;
