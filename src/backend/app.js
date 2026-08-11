require('./config/env');

// Package imports
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const passport = require('passport');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const morgan = require('morgan');
const morganBody = require('morgan-body');

// Middleware imports
const { PUBLIC_DIR, VIEWS_DIR } = require('./config/paths');
const { apiLimiter } = require('./common/middlewares/rate-limiting.middleware');
const isAdmin = require('./common/middlewares/is-admin.middleware');
const { addUserContext } = require('./common/middlewares/user-context.middleware');
const checkUserBlocked = require('./common/middlewares/check-user-blocked.middleware');


// Route imports
const adminAuthRoutes = require('./modules/auth/admin-auth.routes');
const adminUserRoutes = require('./modules/users/admin-user.routes');
const adminCategoryRoutes = require('./modules/catalog/category.routes');
const adminBrandRoutes = require('./modules/catalog/brand.routes');
const adminProductRoutes = require('./modules/catalog/product.routes');
const adminOrderRoutes = require('./modules/orders/admin-order.routes');
const adminReturnRoutes = require('./modules/returns/admin-return.routes');
const adminCouponRoutes = require('./modules/coupons/admin-coupon.routes');
const adminSalesReportRoutes = require('./modules/reports/sales-report.routes');
const adminDashboardRoutes = require('./modules/reports/dashboard.routes');

const landingRoutes = require('./modules/content/landing.routes');
const userAuthRoutes = require('./modules/auth/auth.routes');
const userHomeRoutes = require('./modules/catalog/home.routes');
const userShopRoutes = require('./modules/catalog/shop.routes');
const userReviewRoutes = require('./modules/reviews/review.routes');
const userProfileRoutes = require('./modules/users/profile.routes');
const userAddressRoutes = require('./modules/addresses/address.routes');
const userCartRoutes = require('./modules/cart/cart.routes');
const userWishlistRoutes = require('./modules/wishlist/wishlist.routes');
const userCouponRoutes = require('./modules/coupons/coupon.routes');
const checkoutRoutes = require('./modules/checkout/checkout.routes');
const userOrderRoutes = require('./modules/orders/order.routes');
const userWalletRoutes = require('./modules/wallet/wallet.routes');
const userReferralRoutes = require('./modules/referrals/referral.routes');
const aboutRoutes = require('./modules/content/about.routes');
const helpRoutes = require('./modules/content/help.routes');

require('./modules/auth/auth.passport')(passport);

// View engine
app.set('view engine', 'ejs');
app.set('views', VIEWS_DIR);
app.use(expressLayouts);
app.set('layout', 'admin/layout');

// Middlewares
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(methodOverride('_method'));
app.use(express.static(PUBLIC_DIR));
app.use(flash());

// Session configuration with dynamic session names and durations based on route
app.use((req, res, next) => {
  const isAdminRoute = req.path.startsWith('/admin');
  const sessionName = isAdminRoute ? 'admin.sid' : 'user.sid';

  // Different session durations: 60 minutes for admin, 20 minutes for user
  const sessionDuration = isAdminRoute ? 60 * 60 : 20 * 60; // in seconds
  const cookieMaxAge = sessionDuration * 1000; // in milliseconds

  // Apply session middleware with appropriate name and duration
  const sessionMiddleware = session({
    name: sessionName,
    secret: process.env.SESSION_SECRET || 'yourSecretKey',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      client: mongoose.connection.getClient(),
      ttl: sessionDuration
    }),
    cookie: {
      maxAge: cookieMaxAge,
      httpOnly: true,
      sameSite: 'lax'
    }
  });

  sessionMiddleware(req, res, next);
});

// Passport
app.use(passport.initialize());
app.use(passport.session());

app.use(addUserContext);

// Check if user is blocked on every request (after passport session)
app.use(checkUserBlocked);

// Make Geoapify API key available to all templates
app.locals.geoapifyApiKey = process.env.GEOAPIFY_API_KEY;

// Morgan
app.use(morgan('dev'));
morganBody(app, {
  logRequestBody: true,
  logResponseBody: true,
  maxBodyLength: 1000,
  prettify: true
});

// ---------------------------------------------------------------------------
// ROUTES
//
// Every router is mounted twice: once on its historic path, which the EJS
// templates still call, and once under /api, which the React client will use.
// The duplication is deliberate and temporary - the bare mounts are deleted in
// Phase 5 once the EJS views are gone.
//
// Eight routers sat on bare '/', which would collide with React's client-side
// router; the /api prefix is what removes that collision.
// ---------------------------------------------------------------------------
const PREFIXED_ROUTES = [
  ['/help', helpRoutes],
  ['/cart', userCartRoutes],
  ['/wishlist', userWishlistRoutes],
  ['/wallet', userWalletRoutes],
  ['/coupons', userCouponRoutes],
  ['/referrals', userReferralRoutes],
  ['/checkout', checkoutRoutes],
  ['/about', aboutRoutes],

  ['/admin', adminAuthRoutes],
  ['/admin/users', adminUserRoutes],
  ['/admin/categories', adminCategoryRoutes],
  ['/admin/brands', adminBrandRoutes],
  ['/admin/products', adminProductRoutes],
  ['/admin/orders', adminOrderRoutes],
  ['/admin/returns', adminReturnRoutes],
  ['/admin/coupons', adminCouponRoutes],
  ['/admin/sales-report', adminSalesReportRoutes],
  ['/admin/dashboard', adminDashboardRoutes]
];

// Routers that declare their own full paths, so they mount at the root.
//
// These are NOT additionally mounted under /api: they already declare their
// JSON endpoints as '/api/...' internally (47 such routes across addresses,
// catalog, shop and checkout), so their API surface is at /api/* already.
// Mounting them again under /api would only produce /api/api/* duplicates.
const ROOT_ROUTES = [
  landingRoutes,
  userAuthRoutes,
  userHomeRoutes,
  userShopRoutes,
  userReviewRoutes,
  userProfileRoutes,
  userAddressRoutes,
  userOrderRoutes
];

// Broad backstop across the API surface; page routes are left alone.
app.use('/api', apiLimiter);

for (const [mountPath, router] of PREFIXED_ROUTES) {
  app.use(mountPath, router);
  app.use(`/api${mountPath}`, router);
}

for (const router of ROOT_ROUTES) {
  app.use('/', router);
}

// Removed: app.get('coupons/available', ...). It was missing its leading slash
// so it never matched, and its handler referenced a `userCouponController` that
// was never imported here - it would have thrown a ReferenceError if it ever
// had matched. The route is already served by userCouponRoutes.

module.exports = app;
