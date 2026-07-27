import {
  Clipboard,
  CreditCard,
  ExternalLink,
  Globe,
  Landmark,
  Layout,
  Link2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Save,
  ScanBarcode,
  Store,
  Unlink,
  Upload,
  User
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { storesApi, uploadsApi } from "../api/client.js";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCurrency } from "../context/CurrencyContext.jsx";

const emptyStore = {
  name: "",
  phone: "",
  whatsapp_phone: "",
  description: "",
  address: "",
  city: "",
  district: "",
  logo_url: "",
  favicon_url: "",
  logo_size: "medium",
  default_currency: "LKR",
  storefront_card_aspect: "4:3",
  storefront_products_per_row: 3,
  announcement_text: "",
  pos_card_aspect: "1:1",
  pos_products_per_row: 4,
  subdomain: "",
  custom_domain: "",
  admin_domain: "",
  bank_transfer_enabled: false,
  bank_account_name: "",
  payhere_enabled: false,
  bank_account_number: "",
  bank_name: "",
  bank_branch: "",
  bank_transfer_instructions: "",
  meta_catalog_id: "",
  meta_currency: "LKR",
  meta_last_sync_at: "",
  meta_last_sync_error: "",
  meta_catalog_connected: false
};

const CARD_ASPECT_OPTIONS = [
  { value: "4:3", label: "4 : 3 — wide (default)" },
  { value: "1:1", label: "1 : 1 — square" },
  { value: "3:4", label: "3 : 4 — portrait" },
  { value: "4:5", label: "4 : 5 — tall" },
  { value: "16:9", label: "16 : 9 — banner" }
];

const PRODUCTS_PER_ROW_OPTIONS = [2, 3, 4, 5, 6];
const POS_PRODUCTS_PER_ROW_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

const emptyCatalog = {
  meta_catalog_id: "",
  meta_access_token: "",
  meta_currency: "LKR",
  whatsapp_phone: ""
};

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("en-LK", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "Not synced yet";
}

function StoreSettingsPage() {
  const { refreshUser } = useAuth();
  const { currencies } = useCurrency();
  const [store, setStore] = useState(emptyStore);
  const [catalog, setCatalog] = useState(emptyCatalog);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  function applyStore(nextStore) {
    const merged = {
      ...emptyStore,
      ...nextStore
    };
    setStore(merged);
    setCatalog({
      ...emptyCatalog,
      meta_catalog_id: merged.meta_catalog_id || "",
      meta_currency: merged.meta_currency || "LKR",
      whatsapp_phone: merged.whatsapp_phone || ""
    });
  }

  useEffect(() => {
    let isMounted = true;

    async function loadStore() {
      setLoading(true);
      setError("");

      try {
        const data = await storesApi.me();

        if (isMounted) {
          applyStore(data.store);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load store settings");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadStore();

    return () => {
      isMounted = false;
    };
  }, []);

  const storefrontUrl = useMemo(() => {
    if (!store.slug) {
      return "";
    }

    return `${window.location.origin}/store/${store.slug}`;
  }, [store.slug]);

  function updateStore(event) {
    const { name, type, value, checked } = event.target;
    setStore((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Unable to read image file"));
      reader.readAsDataURL(file);
    });
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setFieldErrors([]);
    setUploadingLogo(true);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const data = await uploadsApi.logo({
        data_url: dataUrl,
        file_name: file.name
      });
      setStore((current) => ({ ...current, logo_url: data.image_url }));
      setMessage("Logo uploaded — remember to save your changes");
    } catch (err) {
      setError(err.message || "Unable to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function uploadFavicon(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setFieldErrors([]);
    setUploadingFavicon(true);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const data = await uploadsApi.favicon({
        data_url: dataUrl,
        file_name: file.name
      });
      setStore((current) => ({ ...current, favicon_url: data.image_url }));
      setMessage("Favicon uploaded — remember to save your changes");
    } catch (err) {
      setError(err.message || "Unable to upload favicon");
    } finally {
      setUploadingFavicon(false);
    }
  }

  function updateCatalog(event) {
    setCatalog((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function copyStorefrontLink() {
    if (!storefrontUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setMessage("Storefront link copied");
    } catch (_err) {
      setError("Unable to copy link in this browser");
    }
  }

  async function submitStore(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    setFieldErrors([]);

    try {
      const data = await storesApi.update(store);
      applyStore(data.store);
      await refreshUser();
      setMessage("Store settings saved");
    } catch (err) {
      setError(err.message || "Unable to save store settings");
      setFieldErrors(err.errors || []);
    } finally {
      setSaving(false);
    }
  }

  async function connectCatalog(event) {
    event.preventDefault();
    setConnecting(true);
    setError("");
    setMessage("");
    setFieldErrors([]);

    try {
      const data = await storesApi.connectCatalog(catalog);
      setStore((current) => ({
        ...current,
        ...data.store
      }));
      setCatalog((current) => ({
        ...current,
        meta_access_token: ""
      }));
      setMessage("WhatsApp Business catalog connected");
    } catch (err) {
      setError(err.message || "Unable to connect WhatsApp catalog");
      setFieldErrors(err.errors || []);
    } finally {
      setConnecting(false);
    }
  }

  async function syncCatalog() {
    setSyncing(true);
    setError("");
    setMessage("");

    try {
      const data = await storesApi.syncCatalog();
      const freshStore = await storesApi.me();
      applyStore(freshStore.store);
      setMessage(`Synced ${data.synced || 0} product(s) to WhatsApp catalog`);
    } catch (err) {
      setError(err.message || "Unable to sync WhatsApp catalog");
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectCatalog() {
    setConnecting(true);
    setError("");
    setMessage("");

    try {
      const data = await storesApi.disconnectCatalog();
      setStore((current) => ({
        ...current,
        ...data.store
      }));
      setCatalog(emptyCatalog);
      setMessage("WhatsApp Business catalog disconnected");
    } catch (err) {
      setError(err.message || "Unable to disconnect WhatsApp catalog");
    } finally {
      setConnecting(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading store settings...
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Settings
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
            Store profile
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Keep the public storefront contact details, profile, and WhatsApp
            Business catalog connection up to date.
          </p>
        </div>
        {store.is_active ? (
          <StatusBadge tone="success">Active storefront</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Inactive</StatusBadge>
        )}
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

      {store.slug ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <Store aria-hidden="true" size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">
                  Public storefront
                </p>
                <p className="truncate text-sm font-mono text-slate-500">
                  {storefrontUrl || `/${store.slug}`}
                </p>
              </div>
              {store.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={`${store.name} logo`}
                  className="ml-3 h-10 w-10 shrink-0 rounded-md border border-slate-200 object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyStorefrontLink}
                disabled={!storefrontUrl}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Clipboard aria-hidden="true" size={16} />
                Copy link
              </button>
              <Link
                to={`/store/${store.slug}`}
                target="_blank"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <ExternalLink aria-hidden="true" size={16} />
                Open storefront
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
      <form onSubmit={submitStore} className="space-y-5">
        <div className="grid gap-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <User aria-hidden="true" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Profile</h3>
                <p className="text-sm text-slate-500">
                  Public contact details for your storefront.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Store name
                </span>
                <input
                  name="name"
                  value={store.name || ""}
                  onChange={updateStore}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Kade Fashion"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-700">
                  Phone
                </span>
                <input
                  name="phone"
                  value={store.phone || ""}
                  onChange={updateStore}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="0771234567"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-700">
                  WhatsApp phone
                </span>
                <input
                  name="whatsapp_phone"
                  value={store.whatsapp_phone || ""}
                  onChange={updateStore}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="0771234567"
                />
              </label>

              <div className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Logo
                </span>
                <div className="mt-1 flex items-center gap-4">
                  {store.logo_url ? (
                    <img
                      src={store.logo_url}
                      alt={`${store.name || "Store"} logo`}
                      className="h-16 w-16 shrink-0 rounded-md border border-slate-200 object-cover"
                      onError={(event) => {
                        event.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400">
                      <Store aria-hidden="true" size={22} />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                        <Upload aria-hidden="true" size={16} />
                        {uploadingLogo ? "Uploading..." : "Upload from device"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={uploadLogo}
                          disabled={uploadingLogo}
                          className="hidden"
                        />
                      </label>
                      {store.logo_url ? (
                        <button
                          type="button"
                          onClick={() =>
                            setStore((current) => ({
                              ...current,
                              logo_url: ""
                            }))
                          }
                          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <span className="text-xs text-slate-500">
                      JPG, PNG, or WebP · up to 5MB
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Logo size
                  </span>
                  <select
                    name="logo_size"
                    value={store.logo_size || "medium"}
                    onChange={updateStore}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                <input
                  name="logo_url"
                  value={store.logo_url || ""}
                  onChange={updateStore}
                  className="mt-3 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="…or paste an image URL: https://example.com/logo.png"
                />
              </div>

              <div className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Favicon
                </span>
                <p className="text-xs text-slate-500">
                  The small icon shown in the browser tab for your storefront.
                </p>
                <div className="mt-1 flex items-center gap-4">
                  {store.favicon_url ? (
                    <img
                      src={store.favicon_url}
                      alt="Favicon"
                      className="h-10 w-10 shrink-0 rounded-md border border-slate-200 object-contain"
                      onError={(event) => {
                        event.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400">
                      <Globe aria-hidden="true" size={18} />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      <Upload aria-hidden="true" size={16} />
                      {uploadingFavicon ? "Uploading..." : "Upload from device"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={uploadFavicon}
                        disabled={uploadingFavicon}
                        className="hidden"
                      />
                    </label>
                    {store.favicon_url ? (
                      <button
                        type="button"
                        onClick={() =>
                          setStore((current) => ({ ...current, favicon_url: "" }))
                        }
                        className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <label className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Description
                </span>
                <textarea
                  name="description"
                  value={store.description || ""}
                  onChange={updateStore}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Short public description of your store"
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <MapPin aria-hidden="true" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Address</h3>
                <p className="text-sm text-slate-500">
                  Shown to customers and used on order receipts.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Street address
                </span>
                <input
                  name="address"
                  value={store.address || ""}
                  onChange={updateStore}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Shop address"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-700">
                  City
                </span>
                <input
                  name="city"
                  value={store.city || ""}
                  onChange={updateStore}
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
                  value={store.district || ""}
                  onChange={updateStore}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Colombo"
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <Globe aria-hidden="true" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Storefront domain</h3>
                <p className="text-sm text-slate-500">
                  Where customers reach your store. Path-based URL always works
                  as a fallback.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Subdomain
                </span>
                <div className="mt-1 flex items-stretch overflow-hidden rounded-md border border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                  <input
                    name="subdomain"
                    value={store.subdomain || ""}
                    onChange={updateStore}
                    maxLength={63}
                    pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?"
                    placeholder="my-store"
                    className="h-11 flex-1 bg-white px-3 text-sm outline-none"
                  />
                  <span className="flex items-center bg-slate-100 px-3 text-sm font-mono text-slate-500">
                    .kadecloud.com
                  </span>
                </div>
                <span className="mt-1 block text-xs text-slate-500">
                  Lowercase letters, digits, hyphens. For local testing use{" "}
                  <span className="font-mono">
                    {store.subdomain || "your-subdomain"}.localtest.me:5173
                  </span>{" "}
                  — it resolves to 127.0.0.1 without /etc/hosts changes.
                </span>
              </label>

              <label className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Storefront domain
                </span>
                <input
                  name="custom_domain"
                  value={store.custom_domain || ""}
                  onChange={updateStore}
                  maxLength={253}
                  placeholder="www.yourbrand.com"
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Where customers reach your store (e.g. www.yourbrand.com).
                  Point your domain's DNS at the platform (CNAME / A record) and
                  paste it here. TLS provisioning is handled at the platform
                  level.
                </span>
              </label>

              <label className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Admin domain
                </span>
                <input
                  name="admin_domain"
                  value={store.admin_domain || ""}
                  onChange={updateStore}
                  maxLength={253}
                  placeholder="admin.yourbrand.com"
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  A separate host for this dashboard (e.g. admin.yourbrand.com).
                  Must differ from the storefront domain. Point its DNS at the
                  platform the same way.
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <Layout aria-hidden="true" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Storefront layout</h3>
                <p className="text-sm text-slate-500">
                  How the public storefront looks to customers.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Default currency
                </span>
                <select
                  name="default_currency"
                  value={store.default_currency || "LKR"}
                  onChange={updateStore}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {(currencies.length > 0
                    ? currencies
                    : [
                        { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs" }
                      ]
                  ).map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} — {currency.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-slate-500">
                  Prices are stored in this currency. Customers can switch the
                  display currency on the storefront.
                </span>
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-700">
                  Image aspect
                </span>
                <select
                  name="storefront_card_aspect"
                  value={store.storefront_card_aspect || "4:3"}
                  onChange={updateStore}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {CARD_ASPECT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-slate-500">
                  Width : height of each product image.
                </span>
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-700">
                  Products per row
                </span>
                <select
                  name="storefront_products_per_row"
                  value={String(store.storefront_products_per_row || 3)}
                  onChange={updateStore}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {PRODUCTS_PER_ROW_OPTIONS.map((value) => (
                    <option key={value} value={String(value)}>
                      {value}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-slate-500">
                  Desktop columns. Mobile stacks; tablet caps at 2–3.
                </span>
              </label>

              <label className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Announcement bar
                </span>
                <input
                  name="announcement_text"
                  value={store.announcement_text || ""}
                  onChange={updateStore}
                  maxLength={280}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="e.g. Free delivery on orders over Rs 5,000 this week!"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  One scrolling line shown under the storefront header. Leave
                  empty to hide the bar.
                </span>
                {store.announcement_text ? (
                  <div className="mt-2 overflow-hidden rounded-md border border-emerald-700/40 bg-emerald-600 px-3 py-1.5 text-xs font-semibold tracking-wide text-white">
                    Preview: {store.announcement_text}
                  </div>
                ) : null}
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <ScanBarcode aria-hidden="true" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold">POS layout</h3>
                <p className="text-sm text-slate-500">
                  How the in-store cashier sees the product grid.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-slate-700">
                  Tile aspect
                </span>
                <select
                  name="pos_card_aspect"
                  value={store.pos_card_aspect || "1:1"}
                  onChange={updateStore}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {CARD_ASPECT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-slate-500">
                  Width : height of each POS product tile.
                </span>
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-700">
                  Tiles per row
                </span>
                <select
                  name="pos_products_per_row"
                  value={String(store.pos_products_per_row || 4)}
                  onChange={updateStore}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {POS_PRODUCTS_PER_ROW_OPTIONS.map((value) => (
                    <option key={value} value={String(value)}>
                      {value}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-slate-500">
                  Desktop columns on the POS page. Mobile always shows 2.
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <Landmark aria-hidden="true" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold">Bank transfer</h3>
                <p className="text-sm text-slate-500">
                  Optional second payment method shown at checkout.
                </p>
              </div>
              <StatusBadge
                tone={store.bank_transfer_enabled ? "success" : "neutral"}
              >
                {store.bank_transfer_enabled ? "Enabled" : "Off"}
              </StatusBadge>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-md border border-slate-200 p-4">
              <input
                type="checkbox"
                name="bank_transfer_enabled"
                checked={Boolean(store.bank_transfer_enabled)}
                onChange={updateStore}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-950">
                  Accept bank transfer at checkout
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Customers see the account below and can submit an optional
                  reference. Verify each transfer from the Payment verification
                  tile on the order detail page.
                </span>
              </span>
            </label>

            {store.bank_transfer_enabled ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Account name
                  </span>
                  <input
                    name="bank_account_name"
                    value={store.bank_account_name || ""}
                    onChange={updateStore}
                    maxLength={160}
                    className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Kade Fashion (Pvt) Ltd"
                  />
                </label>

                <label>
                  <span className="text-sm font-semibold text-slate-700">
                    Account number
                  </span>
                  <input
                    name="bank_account_number"
                    value={store.bank_account_number || ""}
                    onChange={updateStore}
                    maxLength={64}
                    className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="8001234567"
                  />
                </label>

                <label>
                  <span className="text-sm font-semibold text-slate-700">
                    Bank
                  </span>
                  <input
                    name="bank_name"
                    value={store.bank_name || ""}
                    onChange={updateStore}
                    maxLength={120}
                    className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Bank of Ceylon"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Branch
                  </span>
                  <input
                    name="bank_branch"
                    value={store.bank_branch || ""}
                    onChange={updateStore}
                    maxLength={120}
                    className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Colombo 03"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Instructions for the customer
                  </span>
                  <textarea
                    name="bank_transfer_instructions"
                    value={store.bank_transfer_instructions || ""}
                    onChange={updateStore}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Please use your order number as the reference and WhatsApp us the slip once paid."
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <CreditCard aria-hidden="true" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold">Online payments — PayHere</h3>
                <p className="text-sm text-slate-500">
                  Let customers pay instantly with card, eZ Cash, mCash and more.
                </p>
              </div>
              <StatusBadge
                tone={store.payhere_enabled ? "success" : "neutral"}
              >
                {store.payhere_enabled ? "Enabled" : "Off"}
              </StatusBadge>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-md border border-slate-200 p-4">
              <input
                type="checkbox"
                name="payhere_enabled"
                checked={Boolean(store.payhere_enabled)}
                onChange={updateStore}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-950">
                  Accept online payments via PayHere
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Customers are redirected to PayHere's hosted checkout and
                  returned once payment is confirmed. Requires the platform
                  administrator to set up PayHere merchant credentials.
                </span>
              </span>
            </label>
          </section>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save aria-hidden="true" size={18} />
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </form>

      <form
        onSubmit={connectCatalog}
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <MessageCircle aria-hidden="true" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">WhatsApp Business catalog</h3>
              <p className="text-sm text-slate-500">
                Connect a Meta Commerce catalog and sync storefront products.
              </p>
            </div>
          </div>
          <StatusBadge tone={store.meta_catalog_connected ? "success" : "neutral"}>
            {store.meta_catalog_connected ? "Connected" : "Not connected"}
          </StatusBadge>
        </div>

        <div className="mt-5 grid gap-4">
          <label>
            <span className="text-sm font-semibold text-slate-700">
              Catalog ID
            </span>
            <input
              name="meta_catalog_id"
              value={catalog.meta_catalog_id}
              onChange={updateCatalog}
              className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="1234567890"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-700">
              Currency
            </span>
            <input
              name="meta_currency"
              value={catalog.meta_currency}
              onChange={updateCatalog}
              className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm uppercase outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              maxLength={3}
              placeholder="LKR"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-700">
              WhatsApp phone
            </span>
            <input
              name="whatsapp_phone"
              value={catalog.whatsapp_phone}
              onChange={updateCatalog}
              className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="0771234567"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-slate-700">
              Access token
            </span>
            <input
              name="meta_access_token"
              type="password"
              value={catalog.meta_access_token}
              onChange={updateCatalog}
              className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder={
                store.meta_catalog_connected
                  ? "Paste token to replace"
                  : "Meta access token"
              }
            />
          </label>
        </div>

        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
          Last sync: {formatDate(store.meta_last_sync_at)}
          {store.meta_last_sync_error ? (
            <span className="mt-1 block text-red-700">
              {store.meta_last_sync_error}
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={disconnectCatalog}
            disabled={connecting || !store.meta_catalog_connected}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Unlink aria-hidden="true" size={18} />
            Disconnect
          </button>
          <button
            type="button"
            onClick={syncCatalog}
            disabled={syncing || !store.meta_catalog_connected}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw aria-hidden="true" size={18} />
            {syncing ? "Syncing..." : "Sync products"}
          </button>
          <button
            type="submit"
            disabled={connecting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Link2 aria-hidden="true" size={18} />
            {connecting ? "Saving..." : "Connect catalog"}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

export default StoreSettingsPage;
