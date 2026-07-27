// Per-store, localStorage-backed shopping cart.
//
// Each store keeps its own cart, keyed by slug. A user shopping at two
// different stores keeps two separate carts. The cart stores a snapshot of
// the product (name, image, unit_price, stock at add time) — pricing/stock
// is re-validated by the server at checkout time, so price drift is fine.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

const STORAGE_PREFIX = "kadecloud_cart:";

const CartContext = createContext(null);

function keyFor(slug) {
  return `${STORAGE_PREFIX}${slug || "_no_store"}`;
}

function readStored(slug) {
  if (!slug) return [];
  try {
    const raw = localStorage.getItem(keyFor(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function writeStored(slug, items) {
  if (!slug) return;
  try {
    localStorage.setItem(keyFor(slug), JSON.stringify(items));
  } catch (_err) {
    // Quota exceeded etc. — silent fail; cart is non-critical.
  }
}

function unitPrice(product) {
  const discount = Number(product.discount_price);
  if (Number.isFinite(discount) && discount > 0) return discount;
  return Number(product.price) || 0;
}

function clampQuantity(qty, max) {
  const n = Number.isFinite(Number(qty)) ? Math.floor(Number(qty)) : 0;
  if (n <= 0) return 0;
  if (Number.isFinite(max) && max > 0) return Math.min(n, max);
  return n;
}

export function CartProvider({ children }) {
  // Track the active store slug so the cart switches automatically as the
  // user navigates between stores (on the same browser) — without leaking
  // line items across them.
  const [activeStoreSlug, setActiveStoreSlug] = useState(null);
  const [items, setItems] = useState([]);

  // Whenever the active store changes, reload its cart from storage.
  useEffect(() => {
    setItems(readStored(activeStoreSlug));
  }, [activeStoreSlug]);

  // Listen for storage changes from other tabs/windows so cart stays in sync.
  useEffect(() => {
    function onStorage(event) {
      if (!event.key || !event.key.startsWith(STORAGE_PREFIX)) return;
      if (event.key !== keyFor(activeStoreSlug)) return;
      setItems(readStored(activeStoreSlug));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [activeStoreSlug]);

  const persist = useCallback(
    (nextItems) => {
      setItems(nextItems);
      writeStored(activeStoreSlug, nextItems);
    },
    [activeStoreSlug]
  );

  const addItem = useCallback(
    (product, quantity = 1) => {
      if (!activeStoreSlug || !product?.id) return;
      const stock = Number(product.stock_quantity) || 0;
      if (stock <= 0) return;

      setItems((current) => {
        const existing = current.find((line) => line.product_id === product.id);
        const desired = clampQuantity(
          (existing?.quantity || 0) + quantity,
          stock
        );

        let next;
        if (existing) {
          next = current.map((line) =>
            line.product_id === product.id
              ? { ...line, quantity: desired }
              : line
          );
        } else {
          next = [
            ...current,
            {
              product_id: product.id,
              name: product.name,
              image_url: product.image_url || null,
              unit_price: unitPrice(product),
              source_currency: product.source_currency || null,
              stock_quantity: stock,
              quantity: clampQuantity(quantity, stock)
            }
          ];
        }
        writeStored(activeStoreSlug, next);
        return next;
      });
    },
    [activeStoreSlug]
  );

  const updateQuantity = useCallback(
    (productId, quantity) => {
      setItems((current) => {
        const next = current
          .map((line) =>
            line.product_id === productId
              ? { ...line, quantity: clampQuantity(quantity, line.stock_quantity) }
              : line
          )
          .filter((line) => line.quantity > 0);
        writeStored(activeStoreSlug, next);
        return next;
      });
    },
    [activeStoreSlug]
  );

  const removeItem = useCallback(
    (productId) => {
      setItems((current) => {
        const next = current.filter((line) => line.product_id !== productId);
        writeStored(activeStoreSlug, next);
        return next;
      });
    },
    [activeStoreSlug]
  );

  const clear = useCallback(() => {
    persist([]);
  }, [persist]);

  const totals = useMemo(() => {
    const itemCount = items.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = items.reduce(
      (sum, line) => sum + line.unit_price * line.quantity,
      0
    );
    return { itemCount, subtotal };
  }, [items]);

  const value = useMemo(
    () => ({
      activeStoreSlug,
      setActiveStoreSlug,
      items,
      itemCount: totals.itemCount,
      subtotal: totals.subtotal,
      addItem,
      updateQuantity,
      removeItem,
      clear
    }),
    [
      activeStoreSlug,
      items,
      totals.itemCount,
      totals.subtotal,
      addItem,
      updateQuantity,
      removeItem,
      clear
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be inside CartProvider");
  return context;
}
