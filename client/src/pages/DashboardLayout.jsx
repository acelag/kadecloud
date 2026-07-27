import { useState } from "react";
import { Outlet } from "react-router-dom";
import Footer from "../components/Footer.jsx";
import VerifyEmailBanner from "../components/VerifyEmailBanner.jsx";
import Sidebar from "../components/dashboard/Sidebar.jsx";
import TopHeader from "../components/dashboard/TopHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, refreshUser } = useAuth();

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
