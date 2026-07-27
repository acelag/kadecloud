import { Edit, Plus, Save, Tag, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { categoriesApi } from "../api/client.js";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const emptyDraft = { name: "", position: "0" };

function CategoriesPage() {
  const { user } = useAuth();
  const isStoreAdmin = user?.role === "store_admin";
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState("");
  const [editDraft, setEditDraft] = useState(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [message, setMessage] = useState("");

  async function loadCategories() {
    setLoading(true);
    setError("");

    try {
      const data = await categoriesApi.list();
      setCategories(data.categories || []);
    } catch (err) {
      setError(err.message || "Unable to load categories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function createCategory(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors([]);
    setMessage("");

    try {
      await categoriesApi.create({
        name: draft.name,
        position: Number.parseInt(draft.position || "0", 10)
      });
      setDraft(emptyDraft);
      setMessage("Category created");
      await loadCategories();
    } catch (err) {
      setError(err.message || "Unable to create category");
      setFieldErrors(err.errors || []);
    } finally {
      setSubmitting(false);
    }
  }

  function beginEdit(category) {
    setEditingId(category.id);
    setEditDraft({
      name: category.name,
      position: String(category.position ?? 0)
    });
    setError("");
    setFieldErrors([]);
  }

  function cancelEdit() {
    setEditingId("");
    setEditDraft(emptyDraft);
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editingId) return;
    setSubmitting(true);
    setError("");
    setFieldErrors([]);

    try {
      await categoriesApi.update(editingId, {
        name: editDraft.name,
        position: Number.parseInt(editDraft.position || "0", 10)
      });
      setMessage("Category updated");
      cancelEdit();
      await loadCategories();
    } catch (err) {
      setError(err.message || "Unable to update category");
      setFieldErrors(err.errors || []);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCategory(category) {
    const productLabel =
      category.product_count > 0
        ? ` (${category.product_count} product${
            category.product_count === 1 ? "" : "s"
          } will lose this category)`
        : "";

    if (
      !window.confirm(
        `Delete "${category.name}"?${productLabel}`
      )
    ) {
      return;
    }

    setDeletingId(category.id);
    setError("");
    setMessage("");

    try {
      await categoriesApi.remove(category.id);
      setMessage("Category deleted");
      await loadCategories();
    } catch (err) {
      setError(err.message || "Unable to delete category");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Catalog
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
            Categories
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Group your products so customers can filter the storefront.
            {isStoreAdmin
              ? " Renaming a category updates it everywhere."
              : " Only store admins can add or rename categories."}
          </p>
        </div>
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

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        {isStoreAdmin ? (
          <form
            onSubmit={createCategory}
            className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <Plus aria-hidden="true" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Add category</h3>
                <p className="text-sm text-slate-500">
                  Used in the product form and storefront filter.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Name
                </span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  required
                  maxLength={120}
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Clothing"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Sort position
                </span>
                <input
                  type="number"
                  min="0"
                  value={draft.position}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      position: event.target.value
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Lower numbers appear first.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus aria-hidden="true" size={17} />
              {submitting && !editingId ? "Creating..." : "Add category"}
            </button>
          </form>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <Tag aria-hidden="true" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">All categories</h3>
              <p className="text-sm text-slate-500">
                {categories.length} total
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-slate-500">
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No categories yet.
              {isStoreAdmin ? " Add one to start grouping products." : ""}
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {categories.map((category) =>
                editingId === category.id ? (
                  <form
                    key={category.id}
                    onSubmit={saveEdit}
                    className="grid gap-3 bg-emerald-50/40 p-4 lg:grid-cols-[1fr_120px_auto]"
                  >
                    <input
                      value={editDraft.name}
                      onChange={(event) =>
                        setEditDraft((current) => ({
                          ...current,
                          name: event.target.value
                        }))
                      }
                      required
                      maxLength={120}
                      className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    <input
                      type="number"
                      min="0"
                      value={editDraft.position}
                      onChange={(event) =>
                        setEditDraft((current) => ({
                          ...current,
                          position: event.target.value
                        }))
                      }
                      className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    <div className="flex gap-2 lg:justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-500 px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Save aria-hidden="true" size={16} />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                        aria-label="Cancel"
                      >
                        <X aria-hidden="true" size={16} />
                      </button>
                    </div>
                  </form>
                ) : (
                  <article
                    key={category.id}
                    className="grid gap-3 p-4 lg:grid-cols-[1fr_140px_140px_auto] lg:items-center"
                  >
                    <div>
                      <p className="font-bold text-slate-950">{category.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        /{category.slug}
                      </p>
                    </div>
                    <StatusBadge tone="info">
                      {category.product_count}{" "}
                      {category.product_count === 1 ? "product" : "products"}
                    </StatusBadge>
                    <p className="text-sm text-slate-500">
                      Position {category.position}
                    </p>
                    {isStoreAdmin ? (
                      <div className="flex gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => beginEdit(category)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                          aria-label={`Edit ${category.name}`}
                        >
                          <Edit aria-hidden="true" size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCategory(category)}
                          disabled={deletingId === category.id}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-rose-200 text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Delete ${category.name}`}
                        >
                          <Trash2 aria-hidden="true" size={17} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">View only</span>
                    )}
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

export default CategoriesPage;
