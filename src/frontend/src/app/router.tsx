import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth, RequireGuest } from './guards';
import Placeholder from './Placeholder';
import NotFound from './NotFound';
import RootError from './RootError';
import Gallery from './Gallery';
import StorefrontLayout from '@/components/layout/StorefrontLayout';
import AuthLayout from '@/components/layout/AuthLayout';
import LoginPage from '@/features/auth/LoginPage';
import SignupPage from '@/features/auth/SignupPage';
import VerifyOtpPage from '@/features/auth/VerifyOtpPage';
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage';
import ResetOtpPage from '@/features/auth/ResetOtpPage';
import ResetPasswordPage from '@/features/auth/ResetPasswordPage';
import LandingPage from '@/features/catalog/LandingPage';
import ShopPage from '@/features/catalog/ShopPage';
import ProductDetailsPage from '@/features/catalog/ProductDetailsPage';
import CartPage from '@/features/cart/CartPage';
import WishlistPage from '@/features/wishlist/WishlistPage';
import CheckoutPage from '@/features/checkout/CheckoutPage';
import OrderSuccessPage from '@/features/checkout/OrderSuccessPage';
import OrderFailurePage from '@/features/checkout/OrderFailurePage';
import RetryPaymentPage from '@/features/checkout/RetryPaymentPage';
import OrdersPage from '@/features/orders/OrdersPage';
import OrderDetailsPage from '@/features/orders/OrderDetailsPage';
import ProfilePage from '@/features/account/ProfilePage';
import ChangePasswordPage from '@/features/account/ChangePasswordPage';
import WalletPage from '@/features/account/WalletPage';
import ReferralsPage from '@/features/account/ReferralsPage';
import AddressBookPage from '@/features/addresses/AddressBookPage';
import AdminLoginPage from '@/features/admin/AdminLoginPage';
import ProductsPage from '@/features/admin/ProductsPage';
import CouponsPage from '@/features/admin/CouponsPage';
import { BrandsPage, CategoriesPage } from '@/features/admin/CategoriesPage';

/**
 * The route tree.
 *
 * Mirrors the routes the EJS app serves today, so URLs do not change and links
 * that exist in the wild keep working. Two deliberate differences:
 *
 *  - `/` and `/home` render the same component. They were separate views only
 *    because /home carried an auth guard; the pages themselves are identical.
 *  - `/coupons` is absent. Its view has never existed in git history and the
 *    route 500s today - see docs/defects.md. Add it back when the page is
 *    actually built.
 *
 * The three shells live in components/layout. The admin one renders the login
 * page without its chrome, since there is nobody signed in to show it to.
 *
 * The admin branch is code-split. Only a handful of people ever load it, while
 * every shopper would otherwise pay for it on first paint - and it will grow
 * to 14 pages including the largest in the app. Establishing the split now is
 * far cheaper than retrofitting it once those pages exist; the same `lazy`
 * shape applies to any page heavy enough to warrant its own chunk.
 */
const lazyAdminLayout = async () => ({
  Component: (await import('@/components/layout/AdminLayout')).default
});
export const router = createBrowserRouter([
  {
    errorElement: <RootError />,
    children: [
      /* ---- Storefront ------------------------------------------------- */
      {
        element: <StorefrontLayout />,
        children: [
          { index: true, element: <LandingPage /> },
          { path: 'home', element: <Navigate to="/" replace /> },
          { path: 'shop', element: <ShopPage /> },
          { path: 'product/:slug', element: <ProductDetailsPage /> },
          { path: 'about', element: <Placeholder title="About" step={4} note="Static. 759 lines, no behaviour." /> },
          { path: 'help', element: <Placeholder title="Help" step={4} note="FAQ accordion plus POST /help/contact." /> },

          /* Requires a shopper session */
          {
            element: <RequireAuth audience="user" />,
            children: [
              { path: 'cart', element: <CartPage /> },
              { path: 'wishlist', element: <WishlistPage /> },
              { path: 'checkout', element: <CheckoutPage /> },
              { path: 'checkout/order-success/:orderId', element: <OrderSuccessPage /> },
              { path: 'checkout/order-failure/:transactionId', element: <OrderFailurePage /> },
              { path: 'checkout/retry-payment/:transactionId', element: <RetryPaymentPage /> },
              { path: 'orders', element: <OrdersPage /> },
              { path: 'orders/:orderId', element: <OrderDetailsPage /> },
              { path: 'profile', element: <ProfilePage /> },
              /* /profile and /profile/edit were two pages editing the same two
                 fields. One page now, with an edit mode; the old URL redirects
                 so existing links keep working. */
              { path: 'profile/edit', element: <Navigate to="/profile" replace /> },
              { path: 'profile/change-password', element: <ChangePasswordPage /> },
              { path: 'addresses', element: <AddressBookPage /> },
              { path: 'wallet', element: <WalletPage /> },
              { path: 'referrals', element: <ReferralsPage /> }
            ]
          }
        ]
      },

      /* ---- Auth -------------------------------------------------------- */
      {
        element: <AuthLayout />,
        children: [
          {
            element: <RequireGuest audience="user" />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'signup', element: <SignupPage /> },
              { path: 'verify-otp', element: <VerifyOtpPage /> },
              { path: 'forgot-password', element: <ForgotPasswordPage /> },
              { path: 'reset-otp', element: <ResetOtpPage /> },
              { path: 'reset-password', element: <ResetPasswordPage /> }
            ]
          }
        ]
      },

      /* ---- Admin ------------------------------------------------------- */
      {
        path: 'admin',
        lazy: lazyAdminLayout,
        children: [
          {
            element: <RequireGuest audience="admin" />,
            children: [{ path: 'login', element: <AdminLoginPage /> }]
          },
          {
            element: <RequireAuth audience="admin" />,
            children: [
              { index: true, element: <Navigate to="/admin/dashboard" replace /> },
              { path: 'dashboard', element: <Placeholder title="Dashboard" step={11} note="Eight API endpoints, three charts. Chart.js becomes Recharts." /> },
              { path: 'products', element: <ProductsPage /> },
              { path: 'products/add', element: <Placeholder title="Add product" step={9} note="Variants plus a 3–6 image upload. Needs <ImageUploader>." /> },
              { path: 'products/:id', element: <Placeholder title="Product detail" step={9} /> },
              { path: 'products/:id/edit', element: <Placeholder title="Edit product" step={9} note="Shares its form with add." /> },
              { path: 'categories', element: <CategoriesPage /> },
              { path: 'brands', element: <BrandsPage /> },
              { path: 'coupons', element: <CouponsPage /> },
              { path: 'orders', element: <Placeholder title="Orders" step={10} /> },
              { path: 'orders/:orderId', element: <Placeholder title="Order details" step={10} note="The largest page in the app — 2,320 lines, 23 SweetAlert calls." /> },
              { path: 'returns', element: <Placeholder title="Returns" step={10} note="The only page using filters-bar, the model for <FilterBar>." /> },
              { path: 'users', element: <Placeholder title="Users" step={10} note="Block and unblock only." /> },
              { path: 'sales-report', element: <Placeholder title="Sales report" step={11} note="Needs a JSON endpoint — it scrapes its own HTML today." /> }
            ]
          }
        ]
      },

      /* The shared-component gallery. Dev only - it is not in the production
         bundle at all, because the condition is statically false after Vite
         replaces import.meta.env.DEV and the branch is dropped. */
      ...(import.meta.env.DEV ? [{ path: '_gallery', element: <Gallery /> }] : []),

      { path: '*', element: <NotFound /> }
    ]
  }
]);
