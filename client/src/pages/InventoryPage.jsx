import { History, PackageMinus, Plus, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { inventoryApi } from "../api/client.js";
import StatusBadge from "../components/dashboard/StatusBadge.jsx";

const emptyAdjustment = {
  product_id: "",
  adjustment_type: "add",
  quantity: "1",
  reason: "",
  note: ""
};

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("en-LK", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "Not set";
}

function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adjustment, setAdjustment] = useState(emptyAdjustment);
  const [fieldErrors, setFieldErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  async function loadInventory() {
    setLoading(true);
    setError("");

    try {
      const [inventoryData, logsData] = await Promise.all([
        inventoryApi.list(),
        inventoryApi.logs()
      ]);
      setInventory(inventoryData.inventory || []);
      setLowStock(inventoryData.low_stock || []);
      setLogs(logsData.logs || []);
    } catch (err) {
      setError(err.message || "Unable to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  function openAdjustment(product = null) {
    setAdjustment({
      ...emptyAdjustment,
      product_id: product?.id || ""
    });
    setFieldErrors([]);
    setError("");
    setIsModalOpen(true);
  }

  function updateAdjustment(event) {
    setAdjustment((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  }

  async function submitAdjustment(event) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors([]);
    setError("");

    try {
      await inventoryApi.adjust({
        ...adjustment,
        quantity: Number.parseInt(adjustment.quantity || "0", 10)
      });
      setIsModalOpen(false);
      setAdjustment(emptyAdjustment);
      await loadInventory();
    } catch (err) {
      setError(err.message || "Unable to adjust stock");
      setFieldErrors(err.errors || []);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Inventory
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
            Stock management
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Monitor low stock, adjust quantities manually, and audit every stock
            movement.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openAdjustment()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          <Plus aria-hidden="true" size={18} />
          Adjust stock
        </button>
      </section>

      {error && !isModalOpen ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <PackageMinus aria-hidden="true" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Low stock products</h3>
            <p className="text-sm text-slate-500">
              Products at or below their configured threshold.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">Loading inventory...</p>
        ) : lowStock.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">
            No low stock products right now.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lowStock.map((product) => (
              <div
                key={product.id}
                className="rounded-md border border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{product.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {product.sku || "No SKU"}
                    </p>
                  </div>
                  <StatusBadge tone="warning">Low stock</StatusBadge>
                </div>
                <p className="mt-3 text-sm text-slate-700">
                  {product.stock_quantity} left · threshold{" "}
                  {product.low_stock_threshold}
                </p>
                <button
                  type="button"
                  onClick={() => openAdjustment(product)}
                  className="mt-3 text-sm font-semibold text-amber-800 hover:text-amber-900"
                >
                  Adjust this product
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-bold">All inventory</h3>
            <p className="text-sm text-slate-500">
              Current product stock and thresholds.
            </p>
          </div>
          <SlidersHorizontal aria-hidden="true" size={20} className="text-slate-400" />
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading products...</div>
        ) : inventory.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No products available for inventory tracking.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {inventory.map((product) => (
              <article
                key={product.id}
                className="grid gap-4 p-4 md:grid-cols-[1fr_130px_130px_130px]"
              >
                <div>
                  <p className="font-bold text-slate-950">{product.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {product.sku || "No SKU"} · {product.category || "No category"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Stock</p>
                  <p className="font-semibold">{product.stock_quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Threshold</p>
                  <p className="font-semibold">{product.low_stock_threshold}</p>
                </div>
                <div className="flex items-center justify-between gap-3 md:justify-end">
                  {product.is_low_stock ? (
                    <StatusBadge tone="warning">Low</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">OK</StatusBadge>
                  )}
                  <button
                    type="button"
                    onClick={() => openAdjustment(product)}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Adjust
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <History aria-hidden="true" size={20} className="text-slate-500" />
          <div>
            <h3 className="text-lg font-bold">Inventory logs</h3>
            <p className="text-sm text-slate-500">Most recent stock changes.</p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-slate-200 rounded-md border border-slate-200">
          {logs.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">
              No inventory logs yet.
            </div>
          ) : (
            logs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="grid gap-3 p-4 md:grid-cols-[1fr_120px_160px]"
              >
                <div>
                  <p className="font-semibold text-slate-950">
                    {log.product_name || "Product"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {log.reason || log.type}
                    {log.note ? ` · ${log.note}` : ""}
                  </p>
                </div>
                <p
                  className={`font-bold ${
                    Number(log.quantity_change) >= 0
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}
                >
                  {Number(log.quantity_change) >= 0 ? "+" : ""}
                  {log.quantity_change}
                </p>
                <p className="text-sm text-slate-500">
                  {log.stock_before} → {log.stock_after}
                  <br />
                  {formatDate(log.created_at)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <form
            onSubmit={submitAdjustment}
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl"
          >
            <h3 className="text-xl font-bold text-slate-950">
              Manual stock adjustment
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Every adjustment is logged and stock cannot go below zero.
            </p>

            {error ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

            <div className="mt-5 grid gap-4">
              <label>
                <span className="text-sm font-medium text-slate-700">
                  Product
                </span>
                <select
                  name="product_id"
                  value={adjustment.product_id}
                  onChange={updateAdjustment}
                  required
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Select product</option>
                  {inventory.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.stock_quantity} in stock)
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Type
                  </span>
                  <select
                    name="adjustment_type"
                    value={adjustment.adjustment_type}
                    onChange={updateAdjustment}
                    className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="add">Add stock</option>
                    <option value="remove">Remove stock</option>
                  </select>
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Quantity
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    name="quantity"
                    value={adjustment.quantity}
                    onChange={updateAdjustment}
                    required
                    className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>

              <label>
                <span className="text-sm font-medium text-slate-700">
                  Reason
                </span>
                <input
                  name="reason"
                  value={adjustment.reason}
                  onChange={updateAdjustment}
                  required
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Restock, damage, correction"
                />
              </label>

              <label>
                <span className="text-sm font-medium text-slate-700">Note</span>
                <textarea
                  name="note"
                  value={adjustment.note}
                  onChange={updateAdjustment}
                  rows={3}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Optional internal note"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-10 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Save adjustment"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default InventoryPage;
