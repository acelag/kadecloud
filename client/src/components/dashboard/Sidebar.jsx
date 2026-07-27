import {
  BarChart3,
  Boxes,
  ClipboardList,
  Globe,
  Shield,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  ScanBarcode,
  Settings,
  Store,
  Tag,
  Truck,
  Users
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const operationsNavItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, end: true },
  { label: "POS", to: "/dashboard/pos", icon: ScanBarcode },
  { label: "Products", to: "/dashboard/products", icon: Package },
  { label: "Categories", to: "/dashboard/categories", icon: Tag },
  { label: "Orders", to: "/dashboard/orders", icon: ClipboardList },
  { label: "Customers", to: "/dashboard/customers", icon: Users },
  { label: "Inventory", to: "/dashboard/inventory", icon: Boxes },
  { label: "Delivery", to: "/dashboard/delivery", icon: Truck },
  { label: "Reports", to: "/dashboard/reports", icon: BarChart3 },
  { label: "Storefront", to: "/dashboard/storefront", icon: Store }
];

const storeAdminNavItems = [
  ...operationsNavItems,
  { label: "Accounts", to: "/dashboard/admin/accounts", icon: Shield },
  { label: "Settings", to: "/dashboard/settings", icon: Settings }
];

const adminNavItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, end: true },
  { label: "Accounts", to: "/dashboard/admin/accounts", icon: Shield },
  { label: "Domains", to: "/dashboard/admin/domains", icon: Globe },
  { label: "Settings", to: "/dashboard/admin/settings", icon: Settings }
];

function Sidebar({ isOpen, onClose }) {
  const { user, isImpersonating } = useAuth();
  const isAdmin = user?.role === "platform_admin" && !isImpersonating;
  const isStoreAdmin = user?.role === "store_admin";
  const navItems = isAdmin
    ? adminNavItems
    : isStoreAdmin
      ? storeAdminNavItems
      : operationsNavItems;

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/50 transition-opacity lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:z-auto lg:h-screen lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <p className="text-lg font-bold text-slate-950">KadeCloud</p>
            <p className="text-xs font-medium text-slate-500">
              {isAdmin
                ? "Super admin"
                : isStoreAdmin
                  ? "Store admin console"
                  : "Seller console"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
            aria-label="Close sidebar"
          >
            <PanelLeftClose aria-hidden="true" size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`
              }
            >
              <item.icon aria-hidden="true" size={19} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
