import { Globe, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { adminApi } from "../api/client.js";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";

// A domain with 2 labels (example.com) is an apex → A records; anything with a
// leftmost label (www.example.com, admin.example.com) → a CNAME. This is a
// practical heuristic and doesn't cover multi-part TLDs like .co.uk.
function dnsRecordFor(domain, dns) {
  if (!domain) return null;
  const labels = domain.split(".").filter(Boolean);
  const isApex = labels.length <= 2;
  if (isApex) {
    return {
      type: "A",
      host: domain,
      points: dns.apexIps && dns.apexIps.length ? dns.apexIps.join(", ") : null
    };
  }
  return { type: "CNAME", host: domain, points: dns.cnameTarget || null };
}

function AdminDomainsPage() {
  const [stores, setStores] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [dns, setDns] = useState({ cnameTarget: null, apexIps: [] });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadStores() {
    setLoading(true);
    setError("");

    try {
      const data = await adminApi.listStores();
      const list = data.stores || [];
      setStores(list);
      setDns(data.dns || { cnameTarget: null, apexIps: [] });
      setDrafts(
        Object.fromEntries(
          list.map((store) => [
            store.id,
            {
              subdomain: store.subdomain || "",
              custom_domain: store.custom_domain || "",
              admin_domain: store.admin_domain || ""
            }
          ])
        )
      );
    } catch (err) {
      setError(err.message || "Unable to load stores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStores();
  }, []);

  function updateDraft(storeId, field, value) {
    setDrafts((current) => ({
      ...current,
      [storeId]: { ...current[storeId], [field]: value }
    }));
  }

  function isDirty(store) {
    const draft = drafts[store.id];
    if (!draft) return false;
    return (
      draft.subdomain !== (store.subdomain || "") ||
      draft.custom_domain !== (store.custom_domain || "") ||
      draft.admin_domain !== (store.admin_domain || "")
    );
  }

  async function saveDomains(store) {
    const draft = drafts[store.id];
    setSavingId(store.id);
    setError("");
    setMessage("");

    try {
      const data = await adminApi.updateStoreDomains(store.id, {
        subdomain: draft.subdomain.trim().toLowerCase(),
        custom_domain: draft.custom_domain.trim().toLowerCase(),
        admin_domain: draft.admin_domain.trim().toLowerCase()
      });
      const updated = data.store;
      setStores((current) =>
        current.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item
        )
      );
      setDrafts((current) => ({
        ...current,
        [updated.id]: {
          subdomain: updated.subdomain || "",
          custom_domain: updated.custom_domain || "",
          admin_domain: updated.admin_domain || ""
        }
      }));
      setMessage(`Domains updated for ${store.name}`);
    } catch (err) {
      setError(err.message || "Unable to update domains");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Super admin
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
          Store domains
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Assign a platform subdomain, a storefront domain (e.g.
          www.kadefashion.lk), and a separate admin domain (e.g.
          admin.kadefashion.lk) to any store. Custom domains are allowed through
          CORS automatically once saved.
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

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <Globe aria-hidden="true" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold">All stores</h3>
            <p className="text-sm text-slate-500">
              Point a store's DNS (CNAME / A record) at the platform, then paste
              the custom domain here. TLS is handled at the platform level.
            </p>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-sm font-semibold text-slate-700">
            DNS target for custom domains
          </p>
          {dns.cnameTarget || (dns.apexIps && dns.apexIps.length) ? (
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Subdomains (www., admin., …) → CNAME
                </dt>
                <dd className="mt-1 font-mono text-sm text-slate-800">
                  {dns.cnameTarget || "— not configured —"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Apex domain (example.lk) → A record
                </dt>
                <dd className="mt-1 font-mono text-sm text-slate-800">
                  {dns.apexIps && dns.apexIps.length
                    ? dns.apexIps.join(", ")
                    : "— not configured —"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              Set <span className="font-mono">PLATFORM_DNS_TARGET</span> (CNAME
              target for subdomains) and{" "}
              <span className="font-mono">PLATFORM_DNS_APEX_IPS</span> (A-record
              IPs) on the API to show exact records here.
            </p>
          )}
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading stores...</div>
        ) : stores.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No stores found.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {stores.map((store) => {
              const draft = drafts[store.id] || {
                subdomain: "",
                custom_domain: "",
                admin_domain: ""
              };
              return (
                <article key={store.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-bold text-slate-950">{store.name}</p>
                    <span className="text-xs font-semibold text-slate-500">
                      /{store.slug}
                    </span>
                    {store.is_active === false ? (
                      <StatusBadge tone="neutral">Inactive</StatusBadge>
                    ) : (
                      <StatusBadge tone="success">Active</StatusBadge>
                    )}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">
                        Subdomain
                      </span>
                      <div className="mt-1 flex items-stretch overflow-hidden rounded-md border border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
                        <input
                          value={draft.subdomain}
                          onChange={(event) =>
                            updateDraft(
                              store.id,
                              "subdomain",
                              event.target.value
                            )
                          }
                          maxLength={63}
                          pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?"
                          placeholder="my-store"
                          className="h-11 flex-1 bg-white px-3 text-sm outline-none"
                        />
                        <span className="flex items-center bg-slate-100 px-3 text-sm font-mono text-slate-500">
                          .kadecloud.com
                        </span>
                      </div>
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">
                        Storefront domain
                      </span>
                      <input
                        value={draft.custom_domain}
                        onChange={(event) =>
                          updateDraft(
                            store.id,
                            "custom_domain",
                            event.target.value
                          )
                        }
                        maxLength={253}
                        placeholder="www.yourbrand.com"
                        className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">
                        Admin domain
                      </span>
                      <input
                        value={draft.admin_domain}
                        onChange={(event) =>
                          updateDraft(
                            store.id,
                            "admin_domain",
                            event.target.value
                          )
                        }
                        maxLength={253}
                        placeholder="admin.yourbrand.com"
                        className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => saveDomains(store)}
                      disabled={savingId === store.id || !isDirty(store)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save aria-hidden="true" size={17} />
                      {savingId === store.id ? "Saving..." : "Save"}
                    </button>
                  </div>

                  {store.custom_domain || store.admin_domain ? (
                    <div className="mt-3 space-y-2 rounded-md bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        DNS records to create
                      </p>
                      {[
                        { label: "Storefront", domain: store.custom_domain },
                        { label: "Admin", domain: store.admin_domain }
                      ]
                        .filter((row) => row.domain)
                        .map((row) => {
                          const rec = dnsRecordFor(row.domain, dns);
                          return (
                            <div
                              key={row.label}
                              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600"
                            >
                              <span className="font-semibold text-slate-700">
                                {row.label}:
                              </span>
                              <span className="inline-flex items-center rounded bg-slate-200 px-1.5 py-0.5 font-mono font-semibold text-slate-700">
                                {rec.type}
                              </span>
                              <span className="font-mono">{rec.host}</span>
                              <span className="text-slate-400">→</span>
                              <span className="font-mono">
                                {rec.points || (
                                  <span className="text-amber-600">
                                    (set platform DNS target)
                                  </span>
                                )}
                              </span>
                              <span className="text-slate-400">·</span>
                              <a
                                href={`https://${row.domain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-emerald-700 hover:underline"
                              >
                                https://{row.domain}
                              </a>
                            </div>
                          );
                        })}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminDomainsPage;
