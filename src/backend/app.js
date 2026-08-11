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
const connectDB = require('./config/db');
const { PUBLIC_DIR, VIEWS_DIR } = require('./config/paths');
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

// Connect DB
connectDB();

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

// ROUTES
// User Routes 
app.use('/help', helpRoutes);
app.use('/cart', userCartRoutes);
app.use('/wishlist', userWishlistRoutes);
app.use('/wallet', userWalletRoutes);
app.use('/coupons', userCouponRoutes);
app.use ('/referrals', userReferralRoutes);
app.use('/checkout', checkoutRoutes);
app.use('/about', aboutRoutes);

// app.use('/transactions', transactionRoutes);
app.use('/', landingRoutes);
app.use('/', userAuthRoutes);
app.use('/', userHomeRoutes);
app.use('/', userShopRoutes);
app.use('/', userReviewRoutes);
app.use('/', userProfileRoutes);
app.use('/', userAddressRoutes);
app.use('/', userOrderRoutes);






// Admin Routes
app.use('/admin', adminAuthRoutes);
app.use('/admin/users', adminUserRoutes);
app.use('/admin/categories', adminCategoryRoutes);
app.use('/admin/brands', adminBrandRoutes);
app.use('/admin/products', adminProductRoutes);
app.use('/admin/orders', adminOrderRoutes);
app.use('/admin/returns', adminReturnRoutes);
app.use('/admin/coupons', adminCouponRoutes);
app.use('/admin/sales-report', adminSalesReportRoutes);
app.use('/admin/dashboard', adminDashboardRoutes);

app.get('coupons/available', (req, res) => {
    console.log('/coupons/available route HIT!');
    userCouponController.getAvailableCoupons(req, res);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});