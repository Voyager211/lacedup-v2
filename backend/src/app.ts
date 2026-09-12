import './config/env';

// Package imports
import express from 'express';
import type { NextFunction, Request, Response, Router } from 'express';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import morganBody from 'morgan-body';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import fs from 'fs';

// Middleware imports
import { FRONTEND_DIST, PUBLIC_DIR } from './config/paths';
import { apiLimiter } from './common/middlewares/rate-limiting.middleware';
import { addUserContext } from './common/middlewares/user-context.middleware';
import checkUserBlocked from './common/middlewares/check-user-blocked.middleware';
import jwtAuth from './common/middlewares/jwt-auth.middleware';
import { swaggerSpec } from './config/swagger';

// Route imports
import adminAuthRoutes from './modules/auth/admin-auth.routes';
import adminUserRoutes from './modules/users/admin-user.routes';
import adminCategoryRoutes from './modules/catalog/category.routes';
import adminBrandRoutes from './modules/catalog/brand.routes';
import adminProductRoutes from './modules/catalog/product.routes';
import adminOrderRoutes from './modules/orders/admin-order.routes';
import adminReturnRoutes from './modules/returns/admin-return.routes';
import adminCouponRoutes from './modules/coupons/admin-coupon.routes';
import adminSalesReportRoutes from './modules/reports/sales-report.routes';
import adminDashboardRoutes from './modules/reports/dashboard.routes';

import userAuthRoutes from './modules/auth/auth.routes';
import userShopRoutes from './modules/catalog/shop.routes';
import userReviewRoutes from './modules/reviews/review.routes';
import userProfileRoutes from './modules/users/profile.routes';
import userAddressRoutes from './modules/addresses/address.routes';
import userCartRoutes from './modules/cart/cart.routes';
import userWishlistRoutes from './modules/wishlist/wishlist.routes';
import userCouponRoutes from './modules/coupons/coupon.routes';
import checkoutRoutes from './modules/checkout/checkout.routes';
import userOrderRoutes from './modules/orders/order.routes';
import userWalletRoutes from './modules/wallet/wallet.routes';
import userReferralRoutes from './modules/referrals/referral.routes';
import helpRoutes from './modules/content/help.routes';
import newsletterRoutes from './modules/content/newsletter.routes';

import configurePassport from './modules/auth/auth.passport';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const app = express();

/**
 * Hops of reverse proxy in front of this server.
 *
 * Nothing in production talks to Express directly: Render fronts the service
 * with Cloudflare and its own load balancer, and the browser reaches that
 * through Vercel's edge, which rewrites /api to here. Without this, `req.ip` is
 * the nearest proxy rather than the visitor, which puts unrelated visitors in
 * the same rate-limit bucket - two people signing up from behind one Cloudflare
 * edge would share the 5-per-15-minutes OTP allowance.
 *
 * Rate limiting is the whole of what this affects. It does not gate the auth
 * cookies: res.cookie writes `Secure` from the option alone and never consults
 * req.secure - that check belongs to express-session, which this app dropped
 * with the EJS layer.
 *
 * The count is how many X-Forwarded-For entries to skip, counted from the right.
 * It is a property of the deployment, not of the code, and it is not guessable:
 * Render's own edge contributes hops nobody documents, so the first deploy at 2
 * still resolved every caller to a Cloudflare address. Read it off the chain
 * instead - GET /healthz returns both `ip` and the raw `forwardedFor`, and the
 * right value is the position of the real client address counted from the
 * right-hand end. It lives in an env var so that correcting it, or moving hosts,
 * is a restart rather than a commit.
 */
const TRUST_PROXY_HOPS = Number(process.env.TRUST_PROXY) || 0;
app.set('trust proxy', TRUST_PROXY_HOPS);

configurePassport(passport);

// Middlewares
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR));

// Passport is still used to verify credentials on the login routes, but no
// longer to carry the login: passport.session() is gone, and req.user is
// populated from the JWT cookie instead.
app.use(passport.initialize());

app.use(jwtAuth);

app.use(addUserContext);

// Check if user is blocked on every request (after passport session)
app.use(checkUserBlocked);

// Make Geoapify API key available to all templates
app.locals.geoapifyApiKey = process.env.GEOAPIFY_API_KEY;

// Morgan
app.use(morgan(IS_PRODUCTION ? 'combined' : 'dev'));

/**
 * Request and response bodies in the log - development only.
 *
 * These are the bodies as posted, which on /api/auth/login and the reset routes
 * means the plaintext password, and on the payment routes the provider
 * signatures. That is a useful thing to see in a terminal you own and a
 * liability in a hosting provider's log store, which is retained, searchable,
 * and readable by anyone with dashboard access.
 */
if (!IS_PRODUCTION) {
  morganBody(app, {
    logRequestBody: true,
    logResponseBody: true,
    maxBodyLength: 1000,
    prettify: true
  });
}

/**
 * Liveness probe.
 *
 * Render pings a path to decide whether a deploy succeeded, and the root is not
 * a candidate here: this server answers it with the React shell, which in this
 * deployment is Vercel's job and so is absent, leaving a 404 that reads as a
 * failed deploy. Declared before the routers so no mount or rate limiter can
 * shadow it.
 *
 * `ip` is echoed to make the TRUST_PROXY setting checkable from outside: if it
 * comes back as a datacentre address rather than yours, the hop count is wrong
 * and the rate limiters are bucketing unrelated visitors together.
 *
 * `forwardedFor` is the raw header next to it, because `ip` alone only says
 * that the number is wrong, not what it should be. With the chain visible,
 * the right value is the position of your own address counted from the right,
 * which is one reading rather than a series of redeploys. Each hop is a public
 * address of a proxy that already announces itself in the response headers.
 */
app.get('/healthz', (req: Request, res: Response) => {
  res.json({
    ok: true,
    ip: req.ip,
    forwardedFor: req.headers['x-forwarded-for'] ?? null,
    trustProxy: TRUST_PROXY_HOPS,
    uptime: Math.round(process.uptime())
  });
});

// ---------------------------------------------------------------------------
// API DOCS
//
// Mounted before the routers so /docs is never shadowed by a bare '/' mount.
// The spec is built from @swagger JSDoc blocks in the route files.
// ---------------------------------------------------------------------------
app.get('/docs.json', (_req: Request, res: Response) => {
  res.json(swaggerSpec);
});

app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'LacedUp API docs',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'none' }
  })
);

// ---------------------------------------------------------------------------
// ROUTES
//
// Everything is under /api. The bare mounts these routers also had existed for
// the EJS templates, which posted to unprefixed paths; with those gone the
// duplicates only widened the surface - every endpoint answered on two URLs,
// and a guard fixed on one of them protected half of what it looked like it
// protected.
// ---------------------------------------------------------------------------
const PREFIXED_ROUTES: Array<[string, Router]> = [
  ['/help', helpRoutes],
  ['/newsletter', newsletterRoutes],
  ['/cart', userCartRoutes],
  ['/wishlist', userWishlistRoutes],
  ['/wallet', userWalletRoutes],
  ['/coupons', userCouponRoutes],
  ['/referrals', userReferralRoutes],
  ['/checkout', checkoutRoutes],

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

/**
 * Routers that declare their own full paths, including the '/api' prefix.
 *
 * They are mounted at the root because their routes already read
 * '/api/orders', '/api/addresses' and so on internally - mounting them under
 * '/api' as well would produce '/api/api/*'.
 */
const ROOT_ROUTES: Router[] = [
  userAuthRoutes,
  userShopRoutes,
  userReviewRoutes,
  userProfileRoutes,
  userAddressRoutes,
  userOrderRoutes
];

// Every route below is under /api, so this now covers the whole surface.
app.use('/api', apiLimiter);

for (const [mountPath, router] of PREFIXED_ROUTES) {
  app.use(`/api${mountPath}`, router);
}

for (const router of ROOT_ROUTES) {
  app.use('/', router);
}

// ---------------------------------------------------------------------------
// THE REACT APP
//
// Mounted last, so it only ever sees what no router claimed. While the EJS
// views still exist they answer the page routes first and this serves nothing
// but unrouted paths; as the renders are deleted, more falls through to here
// until the SPA owns every page.
//
// In development this is inert - `npm run dev` in frontend/ serves the app
// on :5173 and proxies the API back to this server, so there is no build to
// find. The check is on every request rather than at startup so that starting
// the server before the first build, then building, does not require a restart.
// ---------------------------------------------------------------------------
app.use(express.static(FRONTEND_DIST));

/**
 * Paths that must 404 as themselves rather than being answered with the SPA
 * shell. Returning `index.html` for a mistyped endpoint turns what should be a
 * clear 404 into a 200 full of HTML, which is a genuinely confusing thing to
 * debug from the client side.
 */
const NEVER_SPA = ['/api', '/docs', '/uploads', '/images', '/google'];

app.get(/(.*)/, (req: Request, res: Response, next: NextFunction) => {
  if (NEVER_SPA.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    return next();
  }

  const shell = path.join(FRONTEND_DIST, 'index.html');

  if (!fs.existsSync(shell)) {
    return next();
  }

  res.sendFile(shell);
});

export = app;
