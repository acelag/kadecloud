import { LogOut, Menu, RotateCcw, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

function TopHeader({ onMenuClick }) {
  const { user, logout, isImpersonating, returnToAdmin } = useAuth();
  const workspaceName =
    user?.role === "platform_admin"
      ? "Super admin workspace"
      : user?.store?.name || "Seller workspace";
  const roleLabel =
    user?.role === "store_admin"
      ? "Store Admin"
      : user?.role === "seller"
        ? "Seller"
        : "Super Admin";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu aria-hidden="true" size={20} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-500">
              {workspaceName} · {roleLabel}
            </p>
            <h1 className="truncate text-lg font-bold text-slate-950 sm:text-xl">
              {isImpersonating ? `Logged in as ${user?.name}` : "Dashboard"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isImpersonating ? (
            <button
              type="button"
              onClick={returnToAdmin}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              <RotateCcw aria-hidden="true" size={17} />
              <span className="hidden sm:inline">Return to admin</span>
            </button>
          ) : null}
          <div className="hidden h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 md:flex">
            <Search aria-hidden="true" size={16} />
            <span>Search later</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <LogOut aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default TopHeader;
