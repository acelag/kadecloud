import { LogIn, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useShopperAuth } from "../../context/ShopperAuthContext.jsx";

function ShopperHeaderMenu({ storeBase = "" }) {
  const { shopper, isAuthenticated } = useShopperAuth();

  if (!isAuthenticated) {
    return (
      <Link
        to={`${storeBase}/login`}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <LogIn aria-hidden="true" size={16} />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  const initials = (shopper?.name || shopper?.email || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link
      to={`${storeBase}/account`}
      className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 pr-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      {shopper?.picture_url ? (
        <img
          src={shopper.picture_url}
          alt=""
          className="h-7 w-7 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
          {initials || <User aria-hidden="true" size={14} />}
        </span>
      )}
      <span className="hidden max-w-[140px] truncate sm:inline">
        {shopper?.name || shopper?.email}
      </span>
    </Link>
  );
}

export default ShopperHeaderMenu;
