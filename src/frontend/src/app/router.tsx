import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { RequireAuth, RequireGuest } from './guards';
import Placeholder from './Placeholder';
import NotFound from './NotFound';
import RootError from './RootError';

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
 * Layouts are Outlet-only for now; the real shells land in step 2.
 */

const StorefrontLayout = () => (
  <div className="min-h-screen">
    <Outlet />
  </div>
);

const AuthLayout = () => (
  <div className="flex min-h-screen items-center justify-center bg-card">
    <Outlet />
  </div>
);

const AdminLayout = () => (
  <div className="min-h-screen">
    <Outlet />
  </div>
);

export const router = createBrowserRouter([
  {
    errorElement: <RootError />,
    children: [
      /* ---- Storefront ------------------------------------------------- */
      {
        element: <StorefrontLayout />,
        children: [
          { index: true, element: <Placeholder title="Landing" step={4} note="Hero carousel, new arrivals, best sellers, category carousel, brand grid, testimonials." /> },
          { path: 'home', element: <Navigate to="/" replace /> },
          { path: 'shop', element: <Placeholder title="Shop" step={4} note="Filter, sort and paginate against GET /api/shop. 1,597 lines today." /> },
          { path: 'product/:slug', element: <Placeholder title="Product details" step={4} note="Gallery, variant selector, reviews. The largest storefront view at 2,550 lines." /> },
          { path: 'about', element: <Placeholder title="About" step={4} note="Static. 759 lines, no behaviour." /> },
          { path: 'help', element: <Placeholder title="Help" step={4} note="FAQ accordion plus POST /help/contact." /> },

          /* Requires a shopper session */
          {
            element: <RequireAuth audience="user" />,
            children: [
              { path: 'cart', element: <Placeholder title="Cart" step={5} note="Behaviour lives in cart.js — 1,282 lines." /> },
              { path: 'wishlist', element: <Placeholder title="Wishlist" step={5} /> },
              { path: 'checkout', element: <Placeholder title="Checkout" step={6} note="Riskiest page: Razorpay, wallet, COD, addresses, coupons. checkout.js is 2,053 lines." /> },
              { path: 'checkout/order-success/:orderId', element: <Placeholder title="Order placed" step={6} /> },
              { path: 'checkout/order-failure/:transactionId', element: <Placeholder title="Payment failed" step={6} /> },
              { path: 'checkout/retry-payment/:transactionId', element: <Placeholder title="Retry payment" step={6} /> },
              { path: 'orders', element: <Placeholder title="Orders" step={7} /> },
              { path: 'orders/:orderId', element: <Placeholder title="Order details" step={7} note="Cancel and return flows, per order and per item." /> },
              { path: 'profile', element: <Placeholder title="Profile" step={8} note="1,729 lines: inline editing, avatar crop, email-change OTP." /> },
              { path: 'profile/edit', element: <Placeholder title="Edit profile" step={8} /> },
              { path: 'profile/change-password', element: <Placeholder title="Change password" step={8} /> },
              { path: 'addresses', element: <Placeholder title="Address book" step={8} note="Shares its form with checkout — 927-line partial today." /> },
              { path: 'wallet', element: <Placeholder title="Wallet" step={8} note="Razorpay top-up plus a paginated transaction list." /> },
              { path: 'referrals', element: <Placeholder title="Referrals" step={8} note="Both paginators are broken server-side — see docs/defects.md." /> }
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
              { path: 'login', element: <Placeholder title="Sign in" step={3} /> },
              { path: 'signup', element: <Placeholder title="Create account" step={3} /> },
              { path: 'verify-otp', element: <Placeholder title="Verify email" step={3} note="6-box OTP input — one of three copies in the current app." /> },
              { path: 'forgot-password', element: <Placeholder title="Forgot password" step={3} /> },
              { path: 'reset-otp', element: <Placeholder title="Verify reset code" step={3} /> },
              { path: 'reset-password', element: <Placeholder title="Set a new password" step={3} /> }
            ]
          }
        ]
      },

      /* ---- Admin ------------------------------------------------------- */
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          {
            element: <RequireGuest audience="admin" />,
            children: [{ path: 'login', element: <Placeholder title="Admin sign in" step={3} /> }]
          },
          {
            element: <RequireAuth audience="admin" />,
            children: [
              { index: true, element: <Navigate to="/admin/dashboard" replace /> },
              { path: 'dashboard', element: <Placeholder title="Dashboard" step={11} note="Eight API endpoints, three charts. Chart.js becomes Recharts." /> },
              { path: 'products', element: <Placeholder title="Products" step={9} /> },
              { path: 'products/add', element: <Placeholder title="Add product" step={9} note="Shares a form with edit — ~2,400 near-duplicate lines today." /> },
              { path: 'products/:id', element: <Placeholder title="Product detail" step={9} /> },
              { path: 'products/:id/edit', element: <Placeholder title="Edit product" step={9} /> },
              { path: 'categories', element: <Placeholder title="Categories" step={9} /> },
              { path: 'brands', element: <Placeholder title="Brands" step={9} /> },
              { path: 'coupons', element: <Placeholder title="Coupons" step={9} /> },
              { path: 'orders', element: <Placeholder title="Orders" step={10} /> },
              { path: 'orders/:orderId', element: <Placeholder title="Order details" step={10} note="The largest page in the app — 2,320 lines, 23 SweetAlert calls." /> },
              { path: 'returns', element: <Placeholder title="Returns" step={10} note="The only page using filters-bar, the model for <FilterBar>." /> },
              { path: 'users', element: <Placeholder title="Users" step={10} note="Block and unblock only." /> },
              { path: 'sales-report', element: <Placeholder title="Sales report" step={11} note="Needs a JSON endpoint — it scrapes its own HTML today." /> }
            ]
          }
        ]
      },

      { path: '*', element: <NotFound /> }
    ]
  }
]);
