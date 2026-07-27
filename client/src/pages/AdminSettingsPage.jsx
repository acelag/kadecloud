import { Save, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { adminApi } from "../api/client.js";

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("en-LK", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "Never";
}

function AdminSettingsPage() {
  const [supportedCurrencies, setSupportedCurrencies] = useState([]);
  const [defaultCurrency, setDefaultCurrency] = useState("LKR");
  const [lastUpdated, setLastUpdated] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const data = await adminApi.getSettings();

        if (isMounted) {
          setSupportedCurrencies(data.supported_currencies || []);
          const setting = data.settings?.default_currency;
          setDefaultCurrency(setting?.value || "LKR");
          setLastUpdated(setting?.updated_at || "");
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load platform settings");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = await adminApi.updateSettings({
        default_currency: defaultCurrency
      });
      const setting = data.settings?.default_currency;
      setDefaultCurrency(setting?.value || defaultCurrency);
      setLastUpdated(setting?.updated_at || new Date().toISOString());
      setMessage("Platform settings saved");
    } catch (err) {
      setError(err.message || "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading platform settings...
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Super admin
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
          Platform settings
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Default values applied across all stores. Individual stores can
          override their storefront currency in their own settings.
        </p>
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <form
        onSubmit={handleSave}
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <SettingsIcon aria-hidden="true" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Default currency</h3>
            <p className="text-sm text-slate-500">
              Used when a store has not set its own storefront currency.
            </p>
          </div>
        </div>

        <label className="mt-5 block max-w-md">
          <span className="text-sm font-semibold text-slate-700">
            Platform default
          </span>
          <select
            value={defaultCurrency}
            onChange={(event) => setDefaultCurrency(event.target.value)}
            className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            {supportedCurrencies.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code} — {currency.name}
              </option>
            ))}
          </select>
        </label>

        <p className="mt-4 text-xs text-slate-500">
          Last updated: {formatDate(lastUpdated)}
        </p>

        <button
          type="submit"
          disabled={saving}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save aria-hidden="true" size={18} />
          {saving ? "Saving..." : "Save settings"}
        </button>
      </form>
    </div>
  );
}

export default AdminSettingsPage;
