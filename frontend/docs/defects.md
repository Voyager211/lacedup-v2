# Known Defects, Dead Code & Open Decisions

Everything found while inventorying the codebase for Phase 4. Split into things that are
**broken today** (so the React app must not depend on them), **dead code** (so it does not
get faithfully ported), and **open decisions** that need an answer before or during the
rewrite.

Every entry names a file. The ones marked ✅ were confirmed directly against the route or
source files, not inferred.

---

## 1. Broken — needs a backend fix

These block React pages. Fix them before or while building the page that depends on them.

### ✅ Referrals pagination endpoints were never mounted

[user/referrals.ejs](../../backend/views/user/referrals.ejs) calls
`GET /referrals/api/referred-users?page=` and `GET /referrals/api/earnings?page=`.
[referral.routes.ts](../../backend/modules/referrals/referral.routes.ts) declares exactly one
route:

```ts
router.get('/', isAuthenticated, referralController.getReferralsPage);
```

The handlers `getPaginatedReferrals` and `getPaginatedEarnings` are written and exported in
[referral.controller.ts](../../backend/modules/referrals/referral.controller.ts) but bound to
nothing. **Both paginators on the referrals page have never worked.** Page 2 404s.

*Fix:* mount the two handlers. Two lines.

### ✅ `POST /wallet/topup/capture-paypal` does not exist

[user/wallet.ejs](../../backend/views/user/wallet.ejs) posts to it.
[wallet.routes.ts](../../backend/modules/wallet/wallet.routes.ts) declares only
`/topup/create-order` and `/topup/verify-razorpay`.

*Fix:* decide whether PayPal top-up is a feature. If not, delete the client call. See also
the PayPal note below.

### ✅ `views/error.ejs` does not exist — six catch blocks throw inside the error handler

Six controllers call `res.status(500).render('error', …)`:

| File | Line |
|---|---|
| [address.controller.ts](../../backend/modules/addresses/address.controller.ts) | 475 |
| [cart.controller.ts](../../backend/modules/cart/cart.controller.ts) | 424 |
| [product.controller.ts](../../backend/modules/catalog/product.controller.ts) | 67 |
| [checkout.controller.ts](../../backend/modules/checkout/checkout.controller.ts) | 333 |
| [help.controller.ts](../../backend/modules/content/help.controller.ts) | 14 |
| [profile.controller.ts](../../backend/modules/users/profile.controller.ts) | 176 |

`backend/src/views/` contains only `admin/`, `errors/`, `layouts/`, `user/` and `utils/` —
there is no top-level `error.ejs`. So when any of these pages fails, the error handler itself
throws and the user gets an unhandled exception rather than an error page.

*Fix:* point them at `errors/server-error` (which exists), or add the missing view. One-line
change per site.

### ✅ `views/admin/error.ejs` does not exist

Same bug in the admin coupons 500 path —
[admin-coupon.controller.ts:73](../../backend/modules/coupons/admin-coupon.controller.ts).

### ✅ `user/coupons.ejs` has never existed

`GET /coupons` → `renderCouponsPage`
([coupon.controller.ts:263](../../backend/modules/coupons/coupon.controller.ts)) renders
`user/coupons.ejs`. The file is not in the working tree and not in git history. The route
500s for every signed-in user who reaches it — nothing links to it, so nobody does.

It also passes no `layout`, so even with the view present it would render inside the admin
chrome (the global default layout is `admin/layout`).

*Decision needed:* build a coupons page in React, or delete the route. The locals it would
pass — `coupons`, `applicableCoupons`, `upcomingCoupons`, `cartTotal`, `hasCart` — describe
the page well enough to build it. The orphaned 402-line `user/partials/coupon-card.ejs` was
presumably written for it.

### ✅ Two admin endpoints are unreachable

In [admin-order.routes.ts](../../backend/modules/orders/admin-order.routes.ts):

```
line 134:  router.get('/:orderId',   getOrderDetails)
line 310:  router.get('/statistics', getOrderStatistics)   ← never matched
line 329:  router.get('/export',     exportOrders)         ← never matched
```

Express matches in declaration order, so `GET /admin/orders/statistics` hits
`getOrderDetails` with `orderId = 'statistics'`, and `/export` likewise. Both handlers are
dead.

*Fix:* move the two literal routes above the parameterised one. Note this **changes which
handler runs**, so it is a behaviour change, not a pure refactor — hence it was left as a
decision in Phase 1 rather than silently applied.

(The returns module declares its `/statistics` and `/export` *before* `/`, so those are fine
— merely unused by the UI.)

### ✅ Doubled path segment

[admin-order.routes.ts:295](../../backend/modules/orders/admin-order.routes.ts) declares
`/orders/:orderId/fix-payment-status` inside a router already mounted at `/admin/orders`,
producing `PATCH /admin/orders/orders/:orderId/fix-payment-status`. Not called by anything.

### ✅ `/css/admin/order-details.css` never loads

[admin/layout.ejs:32](../../backend/views/admin/layout.ejs#L32):

```ejs
<% if (title === 'Order Details') { %>
  <link rel="stylesheet" href="/css/admin/order-details.css">
<% } %>
```

The controller sets ``title = `Order Details - ${orderId}` ``, so the condition is never
true. **887 lines of stylesheet have never been served.** Whatever the admin order-details
page looks like today, it looks like that *without* its dedicated CSS.

Worth knowing before "matching the current design" on that page — there may not be a design
to match.

### ✅ Flash messages are written 8 times and rendered once

`connect-flash` is registered at [app.ts:73](../../backend/app.ts#L73) and written by the
blocked-user middleware, the admin guard, admin auth (×4), the coupon controller (×2), and
the orders, wallet and profile route guards.

It is rendered in **exactly one template**: `admin/login.ejs`. There is no flash partial and
no layout-level rendering; `user-layout` never reads `req.flash`.

So a blocked user is redirected with no explanation, "Please log in to continue" never
appears, and coupon and wallet errors vanish silently. **This is a live production bug**, not
just a migration concern — see [components.md](components.md#59-flash-messages--written-8-times-rendered-once)
for the React replacement.

### `window.PageTransition` does not exist

[auth-layout.ejs](../../backend/views/user/layouts/auth-layout.ejs) ships CSS for a page
transition overlay (backdrop, spinner, text). The object that would drive it is defined
nowhere. Three views — `navbar.ejs`, `order-success.ejs`, `order-failure.ejs` — guard on
`if (window.PageTransition)` and always fall through to a plain redirect.

Dead CSS plus three dead branches. Do not port.

### PayPal is inert

[checkout.controller.ts:325](../../backend/modules/checkout/checkout.controller.ts) hardcodes
`paypalClientId: ''`. The checkout view lazy-loads the PayPal SDK with that empty client id,
so the button never becomes usable. `@paypal/checkout-server-sdk` is installed and the server
side exists.

*Decision needed:* finish PayPal or remove it. Do not port a half-working payment method.

### Debug code left in place

- `navbar.ejs` — the profile link is `href="#"` with an inline
  `onclick="console.log('Profile clicked'); …"`.
- `admin/order-details.ejs` — a `testReturnModal()` function.
- `product-details.ejs:2413` — a **malformed HTML comment** that swallows a `<script>` tag:
  `<!-- SKU-based cart fix --<script src="/js/product-details-debug.js"></script>`.

---

## 2. Design and UX defects

Not crashes, but things that should not be reproduced.

| Issue | Where | Note |
|---|---|---|
| **Address pagination is 2 per page** | [address.controller.ts:444](../../backend/modules/addresses/address.controller.ts) | almost certainly unintended; most users have 2–3 addresses |
| **Empty status dropdown with no explanation** | admin order-details | `getValidTransitions` has no entry for `Partially Delivered` / `Partially Returned`, so `/transitions` returns `[]`. The order is *not* stuck — item-level updates progress it and the order status recomputes — but the admin sees an empty dropdown and no reason why |
| **11 of 15 footer links 404** | `footer.ejs` | `/categories`, `/contact`, `/faq`, `/returns`, `/terms`, `/privacy`, `/cookies` are not mounted |
| **About and Help never highlight in the nav** | `navbar.ejs` | only Home and Shop have active states |
| **Invoice downloads as HTML** | `orders-common.js` | saved as `Invoice-{id}.html` despite `pdfkit` being installed and used for other exports |
| **Newsletter form does nothing** | `join-community.ejs` | no action, no handler |
| ✅ **Sales report has no JSON endpoint** | admin sales-report | its "AJAX" refetched its own HTML and swapped nodes with `DOMParser`; the controller had no `X-Requested-With` branch, so it returned the full page every time. **Fixed in step 11** — `sales-report.controller.ts` now answers JSON via `wantsJson(req)`, and sends the raw `createdAt` alongside the pre-formatted `date` |
| ✅ **Admin product detail has no JSON endpoint** | admin products | `renderDetailPage` only ever rendered EJS, so the read-only detail view had nothing to call. **Fixed in step 11** — the same `wantsJson(req)` branch, returning the computed per-variant offer resolution the page exists to display |
| **Two Cropper.js versions on one page** | admin categories, brands | layout loads 1.5.13, the page loads 1.6.1 on top |
| **SweetAlert2 loaded twice** | `admin/layout.ejs` | head and body |
| **Toastify loaded, never called** | `admin/layout.ejs` | admin has no working toast despite shipping a toast library |
| **Toastr pinned to `latest`** | `user-layout.ejs` | an unversioned CDN URL in production |
| **bootstrap-icons unpinned on 3 of 4 layouts** | admin, auth, login layouts | storefront pins 1.10.5; the others don't, so versions can diverge |
| **Cart badge polls every 30s and is never cleared** | `navbar.ejs` | `setInterval` with no teardown |
| **Contradictory validation rules** | `validation.js` vs `addresses.ejs` | name minimum is 2 characters in one and 4 in the other |
| **Edit-profile has no breadcrumb or sidebar** | `edit-profile.ejs` | inconsistent with every other account page |
| **`/profile` and `/profile/edit` overlap** | | both edit the same fields; `/profile` does it inline |

---

## 3. Dead code — do not port

Roughly **1,900 lines** that exist but are never reached.

### Views (635 lines)

| File | Lines | Status |
|---|---:|---|
| `user/partials/header.ejs` | 0 | empty file, included nowhere |
| `user/partials/coupon-card.ejs` | 402 | a second coupon card with the same prop contract as the live one; unreferenced |
| `user/partials/order-card.ejs` | 139 | unreferenced — `orders.ejs` renders its own markup |
| `user/partials/new-banner.ejs` | 56 | unreferenced; also has a `setInterval` with no cleanup |
| `user/partials/pagination.ejs` | 38 | unreferenced |

### Scripts (~800 lines)

Only **9 local script files are referenced** across all 78 views (verified by grepping every
`src="/js/..."` tag). Everything else in `public/js` is unreachable:

| File | Lines | Status |
|---|---:|---|
| `public/js/user/pagination.js` | 168 | never loaded |
| `public/js/admin/pagination.js` | 168 | never loaded; **byte-identical** to the above |
| `public/js/admin/image-cropper.js` | 329 | never loaded — the admin pages inline their own crop code |
| `public/js/product-details-fix.js` | 117 | never loaded |
| `public/js/product-details-debug.js` | 87 | referenced only from inside the malformed comment above |
| `public/js/user/shop.js` | 0 | empty file |
| `public/js/admin/add-product.js` | 0 | empty file |
| `public/js/admin/scripts/` | — | unreferenced directory |

### Stylesheets

| File | Lines | Status |
|---|---:|---|
| `public/css/admin/order-details.css` | 887 | conditionally loaded on a condition that is never true |
| `public/css/pagination.css` | 151 | `<link>` commented out in `user-layout.ejs:26` |

### Server code

| Item | Where | Status |
|---|---|---|
| `profile.controller.loadOrders` | [profile.controller.ts](../../backend/modules/users/profile.controller.ts) | exported, never routed; renders `user/orders` with a completely different locals shape (`orderItems`) than the live handler |
| `referral.controller.getPaginatedReferrals` / `getPaginatedEarnings` | [referral.controller.ts](../../backend/modules/referrals/referral.controller.ts) | exported, never mounted — see §1 |
| `GET /admin/dashboard/api/best-selling-brand` | dashboard routes | live, never called (the plural `-brands` is the one in use) |
| `GET /admin/returns/statistics`, `/export` | returns routes | live, never called by the UI |
| `PATCH /admin/returns/orders/:orderId/approve` / `reject` | returns routes | live, never called |
| `PATCH /admin/orders/:orderId/items/:itemId/cancel` | orders routes | live; the call site is commented out in the view |
| `GET /wallet/balance`, `/stats`, `/transaction/:id` | wallet routes | live, never called — **available to React for free** |

---

## 4. Carried forward from earlier phases

Recorded for completeness; none blocks Phase 4.

- **`transactionService` never existed.** Three call sites referenced it; they were removed in
  Phase 1 rather than inventing the module. COD-completion and the user transactions list lost
  nothing functional — but a transactions screen would need that service written.
- **Two mongodb drivers are installed.** Mongoose bundles 6.16; `connect-mongo`'s peer
  resolves 6.20. Harmless at runtime; the session store carries a cast to paper over the
  typings mismatch. Disappears when `connect-mongo` goes.
- **Duplicate fields on the Return schema** — `processedDate`/`processedBy` alongside
  `approvedAt`/`approvedBy`. The service only writes the latter pair. Worth consolidating.
- **`/test-email`** is registered whenever `NODE_ENV !== 'production'` and reports
  `EMAIL_USER` plus the length of `EMAIL_PASS`.
- **`/docs` reads route sources at startup.** `npm run dev` works because tsx serves `.ts`
  directly; a compiled `npm start` needs the sources shipped alongside `dist/`, or the spec
  generated at build time. **Unresolved — settle before deploying.**

---

## 5. Open decisions

Answer these before the phase they affect.

| # | Decision | Affects | Suggested |
|---|---|---|---|
| 1 | Build a `/coupons` page or delete the route? | storefront step 8 | build it — the backend data is already there |
| 2 | Finish PayPal or remove it? | checkout, step 6 | remove; Razorpay + wallet + COD cover the flows |
| 3 | PayPal wallet top-up (`capture-paypal`)? | wallet, step 8 | follows from #2 |
| 4 | Reorder the two shadowed admin routes? | admin orders, step 10 | yes — it makes two dead handlers reachable |
| 5 | Fix the six `render('error')` call sites? | all | yes, trivial and it removes a class of unhandled exceptions |
| 6 | Where does `pendingRazorpayOrder` live? | checkout, step 6 | **highest risk item in the migration** — see the [README](../README.md) |
| 7 | Add a JSON endpoint for the sales report? | admin, step 11 | required; it is why that page is scheduled last |
| 8 | Invoice: HTML or PDF? | orders, step 7 | PDF — `pdfkit` is already used for other exports |
| 9 | Footer links: build, redirect or remove? | shell, step 2 | decide per link; do not ship 11 dead links |
| 10 | Address page size? | addresses, step 8 | drop pagination, or use 10 |
