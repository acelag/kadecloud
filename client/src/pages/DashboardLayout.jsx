import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Footer from "../components/Footer.jsx";
import VerifyEmailBanner from "../components/VerifyEmailBanner.jsx";
import Sidebar from "../components/dashboard/Sidebar.jsx";
import TopHeader from "../components/dashboard/TopHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { setFavicon } from "../utils/favicon.js";

function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, refreshUser, isImpersonating } = useAuth();

  // Brand the browser tab with the store name (super admin stays "KadeCloud").
  const isPlatformAdmin = user?.role === "platform_admin" && !isImpersonating;
  const brandName = isPlatformAdmin
    ? "KadeCloud"
    : user?.store?.name || "KadeCloud";
  useEffect(() => {
    document.title = `${brandName} · Dashboard`;
    return () => {
      document.title = "KadeCloud";
    };
  }, [brandName]);

  // Use the store's favicon in the browser tab (store users only).
  const faviconUrl = isPlatformAdmin ? null : user?.store?.favicon_url;
  useEffect(() => {
    setFavicon(faviconUrl);
  }, [faviconUrl]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 lg:flex">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopHeader onMenuClick={() => setIsSidebarOpen(true)} />
        {user && !user.email_verified ? (
          <VerifyEmailBanner userType="admin" onResent={refreshUser} />
        ) : null}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default DashboardLayout;
