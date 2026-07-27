import { ArrowLeft, ImagePlus, Plus, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { categoriesApi, productsApi, uploadsApi } from "../api/client.js";

const MAX_GALLERY_IMAGES = 10;
const MAX_ATTRIBUTES = 30;

const emptyProduct = {
  name: "",
  sku: "",
  category_id: "",
  description: "",
  price: "",
  discount_price: "",
  stock_quantity: "0",
  low_stock_threshold: "0",
  image_url: "",
  cod_available: true,
  is_active: true,
  images: [],
  attributes: []
};

function ProductFormPage({ mode }) {
  const isEdit = mode === "edit";
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyProduct);
  const [loading, setLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let isMounted = true;
    categoriesApi
      .list()
      .then((data) => {
        if (isMounted) setCategories(data.categories || []);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      if (!isEdit) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const data = await productsApi.get(id);
        const product = data.product;

        if (isMounted) {
          setForm({
            name: product.name || "",
            sku: product.sku || "",
            category_id: product.category_id || "",
            description: product.description || "",
            price: product.price || "",
            discount_price: product.discount_price || "",
            stock_quantity: String(product.stock_quantity ?? 0),
            low_stock_threshold: String(product.low_stock_threshold ?? 0),
            image_url: product.image_url || "",
            cod_available: Boolean(product.cod_available),
            is_active: Boolean(product.is_active),
            images: Array.isArray(product.images) ? product.images : [],
            attributes: Array.isArray(product.attributes)
              ? product.attributes.map((a) => ({
                  label: String(a?.label || ""),
                  value: String(a?.value || "")
                }))
              : []
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load product");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [id, isEdit]);

  function updateField(event) {
    const { name, type, checked, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  function buildPayload() {
    return {
      ...form,
      price: Number(form.price || 0),
      discount_price:
        form.discount_price === "" ? null : Number(form.discount_price),
      stock_quantity: Number.parseInt(form.stock_quantity || "0", 10),
      low_stock_threshold: Number.parseInt(
        form.low_stock_threshold || "0",
        10
      ),
      images: form.images
        .map((url) => url.trim())
        .filter((url) => url.length > 0),
      attributes: form.attributes
        .map((row) => ({
          label: String(row.label || "").trim(),
          value: String(row.value || "").trim()
        }))
        .filter((row) => row.label && row.value)
    };
  }

  function updateAttribute(index, field, value) {
    setForm((current) => {
      const next = current.attributes.slice();
      next[index] = { ...next[index], [field]: value };
      return { ...current, attributes: next };
    });
  }

  function addAttribute() {
    setForm((current) => {
      if (current.attributes.length >= MAX_ATTRIBUTES) return current;
      return {
        ...current,
        attributes: [...current.attributes, { label: "", value: "" }]
      };
    });
  }

  function removeAttribute(index) {
    setForm((current) => ({
      ...current,
      attributes: current.attributes.filter((_, i) => i !== index)
    }));
  }

  function updateImage(index, value) {
    setForm((current) => {
      const next = current.images.slice();
      next[index] = value;
      return { ...current, images: next };
    });
  }

  function addImage() {
    setForm((current) => {
      if (current.images.length >= MAX_GALLERY_IMAGES) {
        return current;
      }
      return { ...current, images: [...current.images, ""] };
    });
  }

  function removeImage(index) {
    setForm((current) => ({
      ...current,
      images: current.images.filter((_, i) => i !== index)
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

  async function uploadImage(file, target, index = null) {
    if (!file) {
      return;
    }

    setError("");
    setFieldErrors([]);
    setUploadingTarget(target);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const data = await uploadsApi.productImage({
        data_url: dataUrl,
        file_name: file.name
      });

      if (target === "cover") {
        setForm((current) => ({
          ...current,
          image_url: data.image_url
        }));
      } else {
        setForm((current) => {
          const next = current.images.slice();
          next[index] = data.image_url;
          return { ...current, images: next };
        });
      }
    } catch (err) {
      setError(err.message || "Unable to upload image");
    } finally {
      setUploadingTarget("");
    }
  }

  function uploadCoverImage(event) {
    uploadImage(event.target.files?.[0], "cover");
    event.target.value = "";
  }

  function uploadGalleryImage(event, index) {
    uploadImage(event.target.files?.[0], `gallery-${index}`, index);
    event.target.value = "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFieldErrors([]);
    setIsSubmitting(true);

    try {
      if (isEdit) {
        await productsApi.update(id, buildPayload());
      } else {
        await productsApi.create(buildPayload());
      }

      navigate("/dashboard/products");
    } catch (err) {
      setError(err.message || "Unable to save product");
      setFieldErrors(err.errors || []);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading product...
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/dashboard/products"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Products
          </Link>
          <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950">
            {isEdit ? "Edit product" : "Add product"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Manage pricing, stock, COD availability, and storefront status.
          </p>
        </div>
      </section>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          {fieldErrors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {fieldErrors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              name="name"
              value={form.name}
              onChange={updateField}
              required
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Cotton kurti"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">SKU</span>
            <input
              name="sku"
              value={form.sku}
              onChange={updateField}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="KF-001"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Category</span>
            <select
              name="category_id"
              value={form.category_id}
              onChange={updateField}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              <Link
                to="/dashboard/categories"
                className="font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Manage categories →
              </Link>
            </span>
          </label>

          <div className="block">
            <span className="text-sm font-medium text-slate-700">
              Cover image
            </span>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                name="image_url"
                value={form.image_url}
                onChange={updateField}
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="https://example.com/product.jpg"
              />
              <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <Upload aria-hidden="true" size={16} />
                {uploadingTarget === "cover" ? "Uploading..." : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={uploadCoverImage}
                  className="sr-only"
                  disabled={uploadingTarget === "cover"}
                />
              </label>
            </div>
            {form.image_url ? (
              <div className="mt-2 h-24 w-24 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                <img
                  src={form.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Price</span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="price"
              value={form.price}
              onChange={updateField}
              required
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="2500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Discount price
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              name="discount_price"
              value={form.discount_price}
              onChange={updateField}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="2200"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Stock quantity
            </span>
            <input
              type="number"
              min="0"
              step="1"
              name="stock_quantity"
              value={form.stock_quantity}
              onChange={updateField}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Low stock threshold
            </span>
            <input
              type="number"
              min="0"
              step="1"
              name="low_stock_threshold"
              value={form.low_stock_threshold}
              onChange={updateField}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Description
            </span>
            <textarea
              name="description"
              value={form.description}
              onChange={updateField}
              rows={4}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Short product description for the storefront"
            />
          </label>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Gallery images
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Additional product photos shown after the cover image. Up to{" "}
                {MAX_GALLERY_IMAGES} images. Paste a URL or upload from your
                device.
              </p>
            </div>
            <button
              type="button"
              onClick={addImage}
              disabled={form.images.length >= MAX_GALLERY_IMAGES}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus aria-hidden="true" size={15} />
              Add image
            </button>
          </div>

          {form.images.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              No gallery images yet. Click "Add image" to attach one.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {form.images.map((url, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                    {url ? (
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    ) : null}
                  </div>
                  <input
                    value={url}
                    onChange={(event) =>
                      updateImage(index, event.target.value)
                    }
                    className="h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="https://example.com/photo.jpg"
                  />
                  <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50">
                    <ImagePlus aria-hidden="true" size={16} />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => uploadGalleryImage(event, index)}
                      className="sr-only"
                      disabled={uploadingTarget === `gallery-${index}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-rose-200 text-rose-700 transition hover:bg-rose-50"
                    aria-label={`Remove image ${index + 1}`}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Additional information
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Free-form rows shown to customers under the product description.
                Useful for fabric, fit, size, wash &amp; care, dimensions, etc.
                Up to {MAX_ATTRIBUTES} rows.
              </p>
            </div>
            <button
              type="button"
              onClick={addAttribute}
              disabled={form.attributes.length >= MAX_ATTRIBUTES}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus aria-hidden="true" size={15} />
              Add row
            </button>
          </div>

          {form.attributes.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              No rows yet. Click "Add row" to start (e.g. Fabric / 100% Cotton).
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {form.attributes.map((row, index) => (
                <div
                  key={index}
                  className="grid gap-2 sm:grid-cols-[200px_1fr_44px]"
                >
                  <input
                    value={row.label}
                    onChange={(event) =>
                      updateAttribute(index, "label", event.target.value)
                    }
                    maxLength={100}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Label (e.g. Fabric)"
                  />
                  <input
                    value={row.value}
                    onChange={(event) =>
                      updateAttribute(index, "value", event.target.value)
                    }
                    maxLength={500}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Value (e.g. 100% Cotton Cambric)"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttribute(index)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-rose-200 text-rose-700 transition hover:bg-rose-50"
                    aria-label={`Remove row ${index + 1}`}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-md border border-slate-200 p-4">
            <input
              type="checkbox"
              name="cod_available"
              checked={form.cod_available}
              onChange={updateField}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-slate-700">
              COD available
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-md border border-slate-200 p-4">
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={updateField}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-slate-700">
              Active on storefront
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            to="/dashboard/products"
            className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save aria-hidden="true" size={17} />
            {isSubmitting ? "Saving..." : "Save product"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProductFormPage;
