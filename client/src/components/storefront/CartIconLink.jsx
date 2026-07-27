import { ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "../../context/CartContext.jsx";

function CartIconLink({ storeBase = "" }) {
  const { itemCount } = useCart();

  return (
    <Link
      to={`${storeBase}/cart`}
      aria-label={`Cart (${itemCount} items)`}
      className="relative inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      <ShoppingCart aria-hidden="true" size={17} />
      <span className="hidden sm:inline">Cart</span>
      {itemCount > 0 ? (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-bold text-slate-950">
          {itemCount}
        </span>
      ) : null}
    </Link>
  );
}

export default CartIconLink;
