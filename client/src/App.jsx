import { Navigate, Route, Routes, useParams } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useStoreHost } from "./context/StoreHostContext.jsx";

function StoreScopedShopperLogin() {
  const { slug } = useParams();
  return <ShopperLoginPage storeBase={`/store/${slug}`} />;
}

function StoreScopedShopperSignup() {
  const { slug } = useParams();
  return <ShopperSignupPage storeBase={`/store/${slug}`} />;
}

function StoreScopedShopperAccount() {
  const { slug } = useParams();
  return <ShopperAccountPage storeBase={`/store/${slug}`} storeSlug={slug} />;
}

function StoreScopedShopperForgotPassword() {
  const { slug } = useParams();
  return <ShopperForgotPasswordPage storeBase={`/store/${slug}`} />;
}

function StoreScopedShopperResetPassword() {
  const { slug } = useParams();
  return <ShopperResetPasswordPage storeBase={`/store/${slug}`} />;
}

function StoreScopedShopperVerifyEmail() {
  const { slug } = useParams();
  return <VerifyEmailPage userType="shopper" storeBase={`/store/${slug}`} />;
}
import AdminAccountsPage from "./pages/AdminAccountsPage.jsx";
import AdminDomainsPage from "./pages/AdminDomainsPage.jsx";
import AdminSettingsPage from "./pages/AdminSettingsPage.jsx";
import CategoriesPage from "./pages/CategoriesPage.jsx";
import DashboardLayout from "./pages/DashboardLayout.jsx";
import DashboardOverviewPage from "./pages/DashboardOverviewPage.jsx";
import DashboardPlaceholderPage from "./pages/DashboardPlaceholderPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import CustomerDetailPage from "./pages/CustomerDetailPage.jsx";
import CustomersListPage from "./pages/CustomersListPage.jsx";
import DeliveryPage from "./pages/DeliveryPage.jsx";
import OrderDetailPage from "./pages/OrderDetailPage.jsx";
import OrdersListPage from "./pages/OrdersListPage.jsx";
import OrderSuccessPage from "./pages/OrderSuccessPage.jsx";
import POSPage from "./pages/POSPage.jsx";
import ProductFormPage from "./pages/ProductFormPage.jsx";
import ProductsListPage from "./pages/ProductsListPage.jsx";
import PublicProductDetailPage from "./pages/PublicProductDetailPage.jsx";
import PublicStorefrontPage from "./pages/PublicStorefrontPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.jsx";
import ShopperAccountPage from "./pages/ShopperAccountPage.jsx";
import ShopperForgotPasswordPage from "./pages/ShopperForgotPasswordPage.jsx";
import ShopperLoginPage from "./pages/ShopperLoginPage.jsx";
import ShopperResetPasswordPage from "./pages/ShopperResetPasswordPage.jsx";
import ShopperSignupPage from "./pages/ShopperSignupPage.jsx";
import StoreSettingsPage from "./pages/StoreSettingsPage.jsx";
import TrackingPage from "./pages/TrackingPage.jsx";

// The seller/admin dashboard route subtree. Shared between the platform host
// and storefront hosts so the same dashboard is reachable in both places.
// `loginPath` is where ProtectedRoute sends unauthenticated users — "/login"
// on the platform, "/admin" on a storefront host (where "/login" is the
// shopper login).
function dashboardRouteTree(loginPath) {
  return (
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute loginPath={loginPath}>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<DashboardOverviewPage />} />
      <Route path="products" element={<ProductsListPage />} />
      <Route path="products/new" element={<ProductFormPage mode="create" />} />
      <Route path="products/:id/edit" element={<ProductFormPage mode="edit" />} />
      <Route path="pos" element={<POSPage />} />
      <Route path="orders" element={<OrdersListPage />} />
      <Route path="orders/:id" element={<OrderDetailPage />} />
      <Route path="customers" element={<CustomersListPage />} />
      <Route path="customers/:id" element={<CustomerDetailPage />} />
      <Route path="inventory" element={<InventoryPage />} />
      <Route path="categories" element={<CategoriesPage />} />
      <Route path="delivery" element={<DeliveryPage />} />
      <Route path="admin/accounts" element={<AdminAccountsPage />} />
      <Route path="admin/domains" element={<AdminDomainsPage />} />
      <Route path="admin/settings" element={<AdminSettingsPage />} />
      <Route path="reports" element={<DashboardPlaceholderPage title="Reports" />} />
      <Route path="storefront" element={<DashboardPlaceholderPage title="Storefront" />} />
      <Route path="settings" element={<StoreSettingsPage />} />
    </Route>
  );
}

function StorefrontApp({ slug }) {
  return (
    <Routes>
      {/* Seller/admin console on the storefront host: /admin → login, then
          the shared /dashboard tree. Lets a store be managed at
          e.g. ayaale.com/admin without a separate admin subdomain. */}
      <Route path="/admin" element={<LoginPage />} />
      {dashboardRouteTree("/admin")}

      <Route path="/" element={<PublicStorefrontPage slug={slug} />} />
      <Route
        path="/product/:productId"
        element={<PublicProductDetailPage slug={slug} />}
      />
      <Route path="/cart" element={<CartPage slug={slug} />} />
      <Route path="/checkout" element={<CheckoutPage slug={slug} />} />
      <Route path="/order-success" element={<OrderSuccessPage slug={slug} />} />
      <Route path="/track/:orderNumber" element={<TrackingPage />} />
      <Route path="/login" element={<ShopperLoginPage />} />
      <Route path="/signup" element={<ShopperSignupPage />} />
      <Route path="/forgot-password" element={<ShopperForgotPasswordPage />} />
      <Route path="/reset-password" element={<ShopperResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage userType="shopper" />} />
      <Route
        path="/account"
        element={<ShopperAccountPage storeSlug={slug} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const {
    store: hostStore,
    surface: hostSurface,
    loading: hostLoading
  } = useStoreHost();

  if (hostLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading…
      </main>
    );
  }

  // A host mapped to a store's storefront renders the customer-facing app.
  // A host mapped to a store's admin_domain (surface "admin") falls through to
  // the dashboard/login routes below, same as a platform host.
  if (hostStore && hostSurface === "storefront") {
    return <StorefrontApp slug={hostStore.slug} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage userType="admin" />} />
      <Route path="/track/:orderNumber" element={<TrackingPage />} />
      <Route path="/store/:slug" element={<PublicStorefrontPage />} />
      <Route
        path="/store/:slug/product/:productId"
        element={<PublicProductDetailPage />}
      />
      <Route path="/store/:slug/cart" element={<CartPage />} />
      <Route path="/store/:slug/checkout" element={<CheckoutPage />} />
      <Route path="/store/:slug/order-success" element={<OrderSuccessPage />} />
      <Route path="/store/:slug/login" element={<StoreScopedShopperLogin />} />
      <Route path="/store/:slug/signup" element={<StoreScopedShopperSignup />} />
      <Route path="/store/:slug/forgot-password" element={<StoreScopedShopperForgotPassword />} />
      <Route path="/store/:slug/reset-password" element={<StoreScopedShopperResetPassword />} />
      <Route path="/store/:slug/verify-email" element={<StoreScopedShopperVerifyEmail />} />
      <Route path="/store/:slug/account" element={<StoreScopedShopperAccount />} />
      {dashboardRouteTree("/login")}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
