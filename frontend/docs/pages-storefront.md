# Storefront & Auth Pages

Every user-facing page the React app has to replace: 21 storefront views, 6 auth views,
2 error views. For each one — the route that renders it today, its guard, the exact render
locals (these become your props and query shapes), the layout, the partials it includes, its
size, the endpoints its client code calls, and its client-side state.

Paths are relative to the repo root. See [components.md](components.md) for the layouts and
partials referenced here, and [defects.md](defects.md) for the things that are broken.

---

## Reading this document

**Locals** are what the controller passes to `res.render`. They are the closest thing to an
API contract these pages have — a React page needs the same data, so the locals list tells
you what to fetch. Where a JSON endpoint already returns that shape, it is named.

**Guards** decide the route's redirect behaviour, which your React route guard must
reproduce:

| Guard | Defined in | Behaviour when it fails |
|---|---|---|
| `isAuthenticated` | [auth.middleware.ts](../../backend/common/middlewares/auth.middleware.ts) | redirect `/` |
| `isGuest` | same | redirect `/home` |
| `ensureAuthenticated` | [user-context.middleware.ts](../../backend/common/middlewares/user-context.middleware.ts) | JSON 401 for XHR, else redirect `/login` |
| `requireAuth` (module-local) | declared separately in cart, checkout, orders, profile, addresses, wallet, coupons routes | JSON 401 for XHR, else redirect `/login` |
| `requireAuthAPI` | cart + checkout routes | always JSON 401, never redirects |
| `ensureVisible` | [ensure-visible.middleware.ts](../../backend/common/middlewares/ensure-visible.middleware.ts) | renders 404 for hidden/deleted products |

There are **seven separate `requireAuth` definitions** across the module route files, all
near-identical. In React this collapses to one `<ProtectedRoute>` plus one axios 401
interceptor.

**Mount note.** Routers listed in `PREFIXED_ROUTES` ([app.ts:172](../../backend/app.ts#L172))
are mounted twice — bare and under `/api`. Routers in `ROOT_ROUTES` are mounted once at `/`
and declare their own `/api/...` paths internally. Use `/api` everywhere in React.

---

## Scope

| | Files | Lines |
|---|---:|---:|
| Storefront pages | 21 | 18,825 |
| Auth pages | 6 | 1,438 |
| Error pages | 2 | 20 |
| **Total** | **29** | **20,283** |

Largest units, which is where the schedule actually goes:

| View | Lines | Inline script | Notes |
|---|---:|---:|---|
| `product-details.ejs` | 2,550 | 1,368 | largest view in the app after `admin/order-details` |
| `profile.ejs` | 1,729 | 1,107 | inline field editing + Cropper + OTP |
| `shop.ejs` | 1,597 | 820 | client-side filter/sort/paginate |
| `orders.ejs` | 1,383 | 482 | |
| `address-book.ejs` | 1,247 | 764 | **plus** the 927-line `addresses` partial |
| `wallet.ejs` | 1,162 | 631 | |
| `cart.ejs` | 1,120 | **0** | all logic in `cart.js` (1,282 lines) |
| `checkout.ejs` | 482 | 17 | all logic in `checkout.js` (2,053 lines) |

> **Cart and checkout are the two most misleading entries.** Their views are nearly inert;
> the behaviour lives in `public/js/user/cart.js` and `checkout.js`. Judge those two by the
> JS, not the template.

---

# Storefront

## Landing — `/`

| | |
|---|---|
| View | [user/landing.ejs](../../backend/views/user/landing.ejs) — 102 lines (64 script) |
| Route | `GET /` → `showLanding`, [landing.controller.ts:4](../../backend/modules/content/landing.controller.ts) |
| Guard | none · `nocache` middleware |
| Locals | `title`, `layout`, `active`, `newArrivals`, `bestSellers`, `categories`, `brands`, `user` |
| Layout | `user-layout` |
| Includes | `banner`, `product-card` (×2 sections), `category-carousel`, `shop-by-brands`, `testimonials`, `join-community` |
| Client | no fetches of its own — carousel wiring only. Cart/wishlist actions come from the layout-level scripts |

## Home — `/home`

Structurally the same page, minus the inline script.

| | |
|---|---|
| View | [user/home.ejs](../../backend/views/user/home.ejs) — 37 lines, pure includes |
| Route | `GET /home` → `getHome`, [home.controller.ts:4](../../backend/modules/catalog/home.controller.ts) |
| Guard | **`isAuthenticated`** — signed-out users are bounced to `/` |
| Locals | identical to landing |

> **In React this is one route.** `/` and `/home` render the same sections against the same
> data; the only difference is the guard. Build `<HomePage>` once and vary the greeting on
> auth state.

## Shop — `/shop`

| | |
|---|---|
| View | [user/shop.ejs](../../backend/views/user/shop.ejs) — 1,597 lines (820 script / 500 style / 278 markup) |
| Route | `GET /shop` → `loadShopPage`, [shop.controller.ts](../../backend/modules/catalog/shop.controller.ts) |
| Guard | none (public) |
| Locals | `title`, `layout`, `active`, `categories`, `brands`, `availableSizes`, `products`, `currentPage`, `totalPages`, `hasPrevPage`, `hasNextPage`, `prevPage`, `nextPage`, `pageNumbers`, `selectedCategory`, `search`, `sortBy`, `minPrice`, `maxPrice`, `totalProductCount`, `userWishlistProductIds` |
| Includes | `breadcrumb`, `product-card` |
| API | `GET /api/shop?…` (filter/sort/paginate — returns the products JSON), `GET /api/search-suggestions?q=`, `GET /api/available-sizes` |
| State | `currentFilters = { q, sort, category, brand, minPrice, maxPrice, sizes[], stockStatus[] }` + a 5-page pagination window |
| Libs | Toastr ×4. No modals, no SweetAlert |

The controller has two `res.render` branches (one for `X-Requested-With: XMLHttpRequest`)
that pass **identical locals** — the AJAX path re-renders the whole page. `GET /api/shop`
already returns the JSON the React grid needs.

> The view **recomputes prices client-side** from `variants[].basePrice` × the largest
> applicable offer. Do not port that. Prices are authoritative from the server on every
> request — see the pricing note in the [README](../README.md).

## Product details — `/product/:slug`

The biggest storefront page.

| | |
|---|---|
| View | [user/product-details.ejs](../../backend/views/user/product-details.ejs) — 2,550 lines (1,368 script / 670 style / 512 markup) |
| Route | `GET /product/:slug` → `loadProductDetails`, [shop.controller.ts:845](../../backend/modules/catalog/shop.controller.ts) |
| Guard | none · **`ensureVisible`** (404s on a deleted/unlisted product or a disabled category) |
| Locals | `title`, `layout`, `active`, `product`, `reviews`, `relatedProducts`, `averageRating`, `totalReviews`, `ratingCounts`, `ratingBreakdown`, `averageFinalPrice`, `isInWishlist`, `userWishlistProductIds` |
| Includes | `breadcrumb`, `product-card` (related products) |
| API | `POST /api/reviews` (multipart — review + images), `GET /api/reviews/:productId`, `POST /cart/add`, `POST /wishlist/add`, `DELETE /wishlist/remove/:productId` |
| Modals | `#writeReviewModal`, `#reviewImageModal`, `#fullscreenModal` (lightbox) |
| State | `selectedVariant` (drives price + stock), `quantity`, `currentImageIndex`, `currentZoomed`, `selectedImages[]` (review upload buffer), `currentRating` |
| Libs | SweetAlert2 ×20 **and** Toastr ×12 — two toast systems for the same class of feedback |
| Scripts | `/js/validation.js`, `/utils/imageValidation.js` |

Decomposes into roughly: `<ProductGallery>` (thumbnails, zoom, lightbox), `<VariantSelector>`,
`<AddToCartBar>`, `<RatingSummary>`, `<ReviewList>`, `<WriteReviewDialog>`, `<RelatedProducts>`.

> Line 2413 contains a **malformed HTML comment** that swallows a `<script>` tag pointing at
> `product-details-debug.js`. Both that file and `product-details-fix.js` are cart-fix
> monkey-patches. Do not port either — see [defects.md](defects.md).

## Cart — `/cart`

| | |
|---|---|
| View | [user/cart.ejs](../../backend/views/user/cart.ejs) — 1,120 lines (**0 script** / 859 style / 262 markup) |
| Route | `GET /cart` → `loadCart`, [cart.controller.ts:412](../../backend/modules/cart/cart.controller.ts) |
| Guard | `requireAuth` |
| Locals | `user`, `cartItems`, `availableCartItems`, `outOfStockCartItems`, `unavailableCartItems`, `title`, `layout`, `active` |
| Includes | `breadcrumb`, `cart-item-card` |
| Logic | **[public/js/user/cart.js](../../../public/js/user/cart.js) — 1,282 lines**, loaded globally by `user-layout` |
| API | `POST /cart/add`, `/cart/update`, `/cart/remove`, `/cart/clear`, `/cart/remove-out-of-stock`, `/cart/save-for-later`, `/cart/reset-quantity`; `GET /cart/validate-stock`, `GET /cart/count`, `GET /checkout/validate-checkout-stock` |
| Libs | SweetAlert2 ×16, Toastr ×1 |

The server partitions the cart into three buckets — available, out-of-stock, unavailable
(product deleted or unlisted) — and the view renders three sections. Preserve that; it is
what makes the "remove out of stock" bulk action meaningful.

`GET /cart/checkout` is a bare 302 to `/checkout`.

## Wishlist — `/wishlist`

| | |
|---|---|
| View | [user/wishlist.ejs](../../backend/views/user/wishlist.ejs) — 647 lines (333 script) |
| Route | `GET /wishlist` → `getWishlist`, [wishlist.controller.ts:68](../../backend/modules/wishlist/wishlist.controller.ts) |
| Guard | `ensureAuthenticated` |
| Locals | `title`, `products`, `search`, `user`, `layout`, `active`, `isWishlistPage`, `userWishlistProductIds` |
| Includes | `breadcrumb`, `product-card` |
| API | `GET /wishlist/search?q=`, `DELETE /wishlist/remove/:productId`, `POST /cart/add` |
| Logic | also [public/js/user/wishlist.js](../../../public/js/user/wishlist.js) — 261 lines, loaded globally |
| Libs | Toastr ×7 |

## Checkout — `/checkout`

The riskiest page in the app. Redirects to `/cart` when the cart is empty
([checkout.controller.ts:286](../../backend/modules/checkout/checkout.controller.ts)) — that
is correct behaviour, not a bug.

| | |
|---|---|
| View | [user/checkout.ejs](../../backend/views/user/checkout.ejs) — 482 lines (17 script / 465 markup); CSS is external (`/css/checkout.css`, 1,151 lines) |
| Route | `GET /checkout` → `loadCheckout`, [checkout.controller.ts:311](../../backend/modules/checkout/checkout.controller.ts) |
| Guard | `requireAuth` |
| Locals | `user`, `cartItems`, `addresses`, `addressDocumentId`, `totalItemCount`, `totalDiscount`, `subtotal`, `amountAfterDiscount`, `couponDiscount`, `appliedCoupon`, `shipping`, `total`, `walletBalance`, `paypalClientId`, `title`, `layout`, `active`, `geoapifyApiKey` |
| Includes | `breadcrumb`, **`addresses`** (927 lines — full address CRUD + `#addressModal`), **`checkout-coupons-modal`** (259 lines) |
| Logic | **[public/js/user/checkout.js](../../../public/js/user/checkout.js) — 2,053 lines** |
| Libs | Razorpay Checkout, SweetAlert2 ×30, Toastr ×3, Geoapify autocomplete, PayPal SDK (inert) |
| State | selected address, payment method, applied coupon + recomputed totals, wallet sufficiency, `currentEditingId` for the address dialog |

Endpoints:

| Purpose | Endpoint |
|---|---|
| Stock revalidation before pay | `GET /checkout/validate-checkout-stock` |
| Address list / read | `GET /checkout/api/addresses`, `GET /api/address/:id` |
| Address create / update | `POST /api/address`, `PUT /api/address/:id` |
| Coupons | `GET /coupons/available`, `POST /checkout/apply-coupon`, `POST /checkout/remove-coupon` |
| Place order (COD) | `POST /checkout/place-order` |
| Razorpay | `POST /checkout/create-razorpay-order` → `POST /checkout/verify-razorpay-payment` |
| Wallet | `POST /checkout/process-wallet-payment` |
| Failure | `POST /checkout/payment-failure` |

**Payment paths:** COD, Razorpay and wallet are live. **PayPal is inert** — the controller
hardcodes `paypalClientId: ''`, so the lazy SDK loader never produces a usable button. Decide
whether to build PayPal or drop it; do not port it half-working.

> ⚠️ **`pendingRazorpayOrder`.** No order row exists until the payment signature verifies, so
> the session object is the *only* record of the basket mid-payment. This is the single
> highest-risk item in the migration — see the checklist in the [README](../README.md).

## Order success — `/checkout/order-success/:orderId`

| | |
|---|---|
| View | [user/order-success.ejs](../../backend/views/user/order-success.ejs) — 702 lines (66 script) |
| Route | `loadOrderSuccess`, [checkout.controller.ts:1518](../../backend/modules/checkout/checkout.controller.ts) |
| Guard | `requireAuth` |
| Locals | `user`, `orderData`, `title`, `layout`, `active` |
| `orderData` | `{ items, orderId?, orderNumber?, deliveryAddress{name,addressType,landMark,city,state,pincode,phone}, paymentMethod, subtotal, totalDiscount, couponDiscount, couponCode, amountAfterDiscount, shipping, total, totalItemCount, status, paymentStatus, createdAt }` |
| Client | no API calls. Confetti animation, copy-order-number, print styles |

## Order failure — `/checkout/order-failure/:transactionId`

| | |
|---|---|
| View | [user/order-failure.ejs](../../backend/views/user/order-failure.ejs) — 680 lines |
| Route | `loadOrderFailure`, [checkout.controller.ts:1673](../../backend/modules/checkout/checkout.controller.ts) |
| Guard | `requireAuth`. Reads `req.session.paymentFailure`, falls back to a DB lookup, redirects `/cart` on error |
| Locals | `transactionId`, `orderId`, `orderNumber`, `failureReason`, `orderData`, `canRetry`, `title`, `layout`, `active` |
| Client | no fetches — a summary plus a `canRetry`-gated link into retry-payment |

## Retry payment — `/checkout/retry-payment/:transactionId`

| | |
|---|---|
| View | [user/retry-payment.ejs](../../backend/views/user/retry-payment.ejs) — 353 lines (168 script) |
| Route | `loadRetryPaymentPage`, [checkout.controller.ts:1796](../../backend/modules/checkout/checkout.controller.ts) |
| Guard | `requireAuth` |
| Locals | `transactionId`, `orderId`, `orderNumber`, `failureReason`, **`razorpayKeyId`**, `orderData`, `title`, `layout`, `active` |
| API | `POST /checkout/create-razorpay-order-retry`, `POST /checkout/verify-retry-razorpay-payment`, `POST /checkout/retry-payment-failure` |
| Libs | Razorpay, SweetAlert2 ×5 |

Note this page receives `razorpayKeyId` as a local while checkout does not — checkout gets
its key inside the create-order response. Unify that in React: one `useRazorpay()` hook.

## Orders — `/orders`

| | |
|---|---|
| View | [user/orders.ejs](../../backend/views/user/orders.ejs) — 1,383 lines (482 script / 639 style) |
| Route | `GET /orders` → `orderController.getUserOrders`. **Registered twice** — [profile.routes.ts:191](../../backend/modules/users/profile.routes.ts) and [order.routes.ts:103](../../backend/modules/orders/order.routes.ts) — both to the same handler; the profile mount wins |
| Guard | `requireAuth` |
| Locals | `user`, `orders`, `currentPage`, `totalPages`, `hasPrevPage`, `hasNextPage`, `prevPage`, `nextPage`, `pageNumbers`, `totalOrders`, `title`, `layout`, `active`, `cancellationReasons`, `returnReasons` |
| Includes | `breadcrumb`, `profile-sidebar`, `order-search` |
| API | `GET /orders/api/filtered?page=&status=&search=`, `GET /orders/api/search` |
| Modals | `#orderActionModal` |
| State | `currentPage`, `currentStatusFilter`, `currentSearchQuery`, `isLoading` |

`cancellationReasons` and `returnReasons` come from
[order.constants.ts](../../backend/common/constants/order.constants.ts) — 11 cancellation
reasons and 13 return reasons. Fetch them once, or mirror the constants file in shared types.

## Order details — `/orders/:orderId`

| | |
|---|---|
| View | [user/order-details.ejs](../../backend/views/user/order-details.ejs) — 795 lines (39 script / 388 style / 368 markup) |
| Route | `getOrderDetails`, [order.controller.ts:514](../../backend/modules/orders/order.controller.ts) |
| Guard | `requireAuth` |
| Locals | `user`, `order` (with `order.comprehensiveStatusHistory` attached), `title`, `layout`, `active`, `cancellationReasons`, `returnReasons`, `ORDER_STATUS` |
| Includes | `breadcrumb` |
| Logic | **[public/js/user/orders-common.js](../../../public/js/user/orders-common.js) — 326 lines** |

The inline script only bridges the reason constants onto `window` and defines six thin
wrappers. The real behaviour:

| Action | Endpoint |
|---|---|
| Cancel whole order | `PATCH /orders/:orderId` |
| Cancel one item | `PATCH /orders/:orderId/items/:itemId` |
| Return whole order | `POST /orders/:orderId/returns` |
| Return one item | `POST /orders/:orderId/items/:itemId/returns` |
| Invoice | `GET /orders/:orderId/invoice` |
| Track | stub — "coming soon" |

Each action opens a SweetAlert `input: 'select'` reason picker, then a blocking loading
modal, then reloads the page. In React: `useOrderActions()` + `<ReasonPickerDialog>` +
mutations with cache invalidation instead of `location.reload()`.

> The invoice endpoint downloads as `Invoice-{id}.html`, not a PDF, despite `pdfkit` being
> installed and used elsewhere. Worth confirming which is intended.

## Profile — `/profile`

| | |
|---|---|
| View | [user/profile.ejs](../../backend/views/user/profile.ejs) — 1,729 lines (1,107 script / 515 style / 108 markup) |
| Route | `loadProfile`, [profile.controller.ts:119](../../backend/modules/users/profile.controller.ts) |
| Guard | `requireAuth` |
| Locals | `title`, `layout`, `active`, `user` |
| Includes | `breadcrumb`, `profile-sidebar` |
| API | `POST /profile/edit`, `POST /profile/email`, `POST /profile/photo` (multipart), `DELETE /profile/photo`, `POST /profile/verify-email-update-otp`, `POST /profile/resend-email-update-otp` |
| Modals | `#photoOptionsModal`, `#cropModal`, `#imageViewModal`, `#otpVerificationModal` |
| Libs | Cropper.js, SweetAlert2 ×20, Bootstrap Modal ×7 |
| State | inline field editing, cropper instance, pending new email + OTP resend countdown |

1,107 lines of script for what is structurally: a profile card, inline-editable fields, an
avatar crop-and-upload flow, and an email-change OTP flow. The avatar flow is the same
crop pipeline the admin product pages use — build `<ImageUploader>` once.

## Edit profile — `/profile/edit`

| | |
|---|---|
| View | [user/edit-profile.ejs](../../backend/views/user/edit-profile.ejs) — 398 lines (216 script) |
| Route | `loadEditProfile`, [profile.controller.ts:144](../../backend/modules/users/profile.controller.ts) |
| Guard | `requireAuth` |
| Locals | `title`, `layout`, `active`, `user` |
| Includes | **none** — no breadcrumb, no sidebar. Inconsistent with every other profile page |
| API | `POST /profile/edit`, `POST /profile/verify-current-email` |
| Modals | `#emailVerificationModal` |

This substantially overlaps `/profile`, which also edits fields inline. In React, consider
one profile page with an edit mode rather than two routes.

## Change password — `/profile/change-password`

| | |
|---|---|
| View | [user/change-password.ejs](../../backend/views/user/change-password.ejs) — 830 lines (450 script / 235 style) |
| Route | `loadChangePassword`, [profile.controller.ts:168](../../backend/modules/users/profile.controller.ts) |
| Guard | `requireAuth` |
| Locals | `user`, `title`, `layout`, `active` |
| Includes | `breadcrumb`, `profile-sidebar` |
| API | `POST /profile/change-password` |
| Libs | **none** — a hand-rolled strength meter and inline error rendering, no SweetAlert, no Toastr |

450 lines for one form. The strength meter is worth keeping as a small component; the
validation becomes a Zod schema.

## Email change OTP — `/profile/email-change-otp`

| | |
|---|---|
| View | [user/email-change-otp.ejs](../../backend/views/user/email-change-otp.ejs) — 434 lines (265 script) |
| Route | `loadEmailChangeOtp`, [profile.controller.ts:684](../../backend/modules/users/profile.controller.ts) — **redirects to `/profile/edit` unless `req.session.emailChangeOtp` exists** |
| Guard | `requireAuth` + session precondition |
| Locals | `title`, `layout`, `active`, `user`, `email` |
| API | `POST /profile/verify-email-otp`, `POST /profile/change-email` |
| Modals | `#newEmailModal` |
| State | 6-box OTP input with auto-advance, resend countdown |

The session precondition is one of the six items in the express-session migration. Once the
OTP challenge lives in Redux, this becomes a client-guarded route.

Its 6-box OTP widget is duplicated in `verify-otp.ejs` and `reset-otp.ejs` — three copies of
the same control. Build `<OtpInput>` once.

## Address book — `/addresses`

| | |
|---|---|
| View | [user/address-book.ejs](../../backend/views/user/address-book.ejs) — 1,247 lines (764 script / 335 style) |
| Route | `loadAddresses`, [address.controller.ts:458](../../backend/modules/addresses/address.controller.ts). `/profile/addresses` is a 302 here |
| Guard | `requireAuth` |
| Locals | `user`, `addresses`, `currentPage`, `totalPages`, `totalAddresses`, `hasPrevPage`, `hasNextPage`, `prevPage`, `nextPage`, `title`, `layout`, `active`, `geoapifyApiKey` |
| Includes | `breadcrumb`, `profile-sidebar`, **`addresses`** (927 lines) |
| API | `GET /api/addresses/paginated?page=`, `GET /api/address/:id`, `PATCH /api/address/:id/default`, `DELETE /api/address/:id`, `POST /api/address`, `PUT /api/address/:id`, `GET /api/states-districts` |
| Modals | `#addressModal` |
| Libs | Geoapify autocomplete, SweetAlert2 ×3 |

> **Pagination is server-side at 2 addresses per page**
> ([address.controller.ts:444](../../backend/modules/addresses/address.controller.ts)).
> Almost certainly unintended. Pick a sane page size, or drop pagination — most users have
> two or three addresses.

The `addresses` partial is the same 927-line form checkout uses. One `<AddressFormDialog>`
serves both, with `currentEditingId` becoming a prop.

## Wallet — `/wallet`

| | |
|---|---|
| View | [user/wallet.ejs](../../backend/views/user/wallet.ejs) — 1,162 lines (631 script / 329 style) |
| Route | `renderWalletPage`, [wallet.controller.ts:66](../../backend/modules/wallet/wallet.controller.ts) |
| Guard | `requireAuth` |
| Locals | `user`, `wallet`, `transactions`, `currentPage`, `totalPages`, `hasPrevPage`, `hasNextPage`, `prevPage`, `nextPage`, `pageNumbers`, `totalTransactions`, `stats`, `title`, `layout`, `active` |
| Includes | `breadcrumb`, `profile-sidebar` |
| API | `GET /wallet/transactions/paginated`, `POST /wallet/topup/create-order`, `POST /wallet/topup/verify-razorpay` |
| Modals | `#addMoneyModal` |
| Libs | Razorpay ×12, SweetAlert2 ×4 |
| State | `currentPage`, `currentFilter` (credit/debit), `isProcessing` |

Routed but never called by the view — available to React for free: `GET /wallet/balance`,
`GET /wallet/stats`, `GET /wallet/transaction/:id`.

> `POST /wallet/topup/capture-paypal` is called by this view and **does not exist**. See
> [defects.md](defects.md).

## Referrals — `/referrals`

| | |
|---|---|
| View | [user/referrals.ejs](../../backend/views/user/referrals.ejs) — 940 lines (330 script) |
| Route | `getReferralsPage`, [referral.controller.ts:89](../../backend/modules/referrals/referral.controller.ts) |
| Guard | `isAuthenticated` |
| Locals | `title`, `layout`, `active`, `user`, `referredUsers`, `referralTransactions`, `totalEarnings`, `referralLink`, plus **two independent paginator sets** (`referralsCurrentPage`/`referralsTotalPages`/… and `earningsCurrentPage`/`earningsTotalPages`/…), `totalReferrals`, `totalEarningsCount` |
| Includes | `breadcrumb`, `profile-sidebar` |
| Modals | `#shareModal` |

> ⚠️ **Both paginators are broken.** The view calls `GET /referrals/api/referred-users` and
> `GET /referrals/api/earnings`; [referral.routes.ts](../../backend/modules/referrals/referral.routes.ts)
> declares only `GET /`. The handlers exist and are exported but were never mounted. Page 2
> has never worked. Mount them before building this page.

## About — `/about`

| | |
|---|---|
| View | [user/about.ejs](../../backend/views/user/about.ejs) — 759 lines (**0 script** / 550 style / 209 markup) |
| Route | `getAbout`, [about.controller.ts:2](../../backend/modules/content/about.controller.ts) |
| Guard | none |
| Locals | `title`, `layout`, `active`, `user` |

Fully static. The cheapest page in the app to port, and a good warm-up for the Tailwind
conversion since it is 550 lines of pure styling with no behaviour to preserve.

## Help — `/help`

| | |
|---|---|
| View | [user/help.ejs](../../backend/views/user/help.ejs) — 878 lines (203 script / 385 style) |
| Route | `getHelpPage`, [help.controller.ts:5](../../backend/modules/content/help.controller.ts) |
| Guard | none |
| Locals | `title`, `layout`, `active` — **no `user`**, unlike every other storefront page |
| API | `POST /help/contact` — `{ name, email, subject, message }`, sends mail |
| Libs | none — accordion FAQ with inline form feedback |

## Coupons — `/coupons` (broken)

`GET /coupons` → `renderCouponsPage`,
[coupon.controller.ts:263](../../backend/modules/coupons/coupon.controller.ts), guarded by
`requireAuth`. It renders `user/coupons.ejs`, **which has never existed in git history**. The
route 500s and nothing in the app links to it.

The locals it would pass — `title`, `coupons`, `applicableCoupons`, `upcomingCoupons`,
`cartTotal`, `hasCart`, `user` — describe the page well enough to build it if you want it.
The orphaned 402-line `user/partials/coupon-card.ejs` was presumably written for it. It also
passes no `layout`, so even with the view present it would render inside the admin chrome.

**Decision needed:** build a coupons page in React, or delete the route.

---

# Auth

All six share `auth-layout`, are guarded by `isGuest`, include no partials, and post JSON.
Routes live in [auth.routes.ts](../../backend/modules/auth/auth.routes.ts); handlers in
[auth.controller.ts](../../backend/modules/auth/auth.controller.ts).

| Page | View | Lines (script) | Routes | Locals | Rate limit |
|---|---|---:|---|---|---|
| Signup | `auth/signup.ejs` | 153 (82) | `GET /signup`, `POST /signup` | `title`, `layout` | `authLimiter` 10/15min |
| Login | `auth/login.ejs` | 333 (214) | `GET /login`, `POST /login` | `title`, `layout`, `errorMessage` (from `?error=`) | `authLimiter` |
| Verify OTP | `auth/verify-otp.ejs` | 296 (256) | `GET /verify-otp`, `POST /verify-otp`, `POST /resend-otp` | `title`, `layout`, `email` — redirects `/signup` if absent | `otpLimiter` 5/15min |
| Forgot password | `auth/forgot-password.ejs` | 101 (74) | `GET`/`POST /forgot-password` | `title`, `layout` | `passwordResetLimiter` 5/hour |
| Reset OTP | `auth/reset-otp.ejs` | 302 (262) | `GET /reset-otp`, `POST /reset-otp`, `POST /resend-reset-otp` | `title`, `layout`, `email` — redirects `/forgot-password` if absent | `otpLimiter` |
| Reset password | `auth/reset-password.ejs` | 253 (164) | `GET`/`POST /reset-password` | `title`, `layout`, `email` | `passwordResetLimiter` |

`POST /login` returns `{ success: true }` on 200 and `{ error }` on 401 — already an API.

**Also routed, no view:** `GET /google` and `GET /google/callback` (OAuth redirect),
`POST /auth/refresh`, `GET /logout`, and `GET /test-email` (non-production only).

**Shared pieces across these six pages:** the 6-box OTP input with auto-advance and a resend
countdown (3 copies), a password strength meter and visibility toggle, and the SweetAlert
success/error pattern (37 calls total). Build `<OtpInput>`, `<PasswordField>` and the auth
card shell once and these six pages get short.

> `auth-layout` does **not** load `design-system.css` or Toastr — so badge tokens and toasts
> are unavailable on auth pages while SweetAlert is. One more reason to unify feedback.

---

# Error pages

| View | Lines | Rendered by |
|---|---:|---|
| [errors/404.ejs](../../backend/views/errors/404.ejs) | 10 | `ensure-visible.middleware`, `shop.controller` (×4), `order.controller`, `admin-order.controller` (×2) |
| [errors/server-error.ejs](../../backend/views/errors/server-error.ejs) | 10 | `ensure-visible.middleware`, `shop.controller`, `order.controller` (×2), `wishlist.controller`, `profile.controller` |

Both read only `title` and `message`, with fallbacks. The locals passed vary per call site and
are inconsistent. React needs one `<ErrorPage>` plus a router `errorElement`.

> **Six controllers also `render('error')` in their catch blocks — and `views/error.ejs` does
> not exist.** Every one of those throws inside its own error handler. See
> [defects.md](defects.md).

---

# Storefront JSON API

Everything below is already an API and needs no backend work. Entries under a prefixed mount
are available at both the bare path and `/api` + path.

**Catalog** ([shop.routes.ts](../../backend/modules/catalog/shop.routes.ts), root mount)
`GET /api/shop` · `GET /api/search-suggestions` · `GET /api/available-sizes` — all public.

**Reviews** ([review.routes.ts](../../backend/modules/reviews/review.routes.ts), root mount)
`POST /api/reviews` (multipart) · `GET /api/reviews/:productId`.

**Cart** ([cart.routes.ts](../../backend/modules/cart/cart.routes.ts), prefixed)
`POST /cart/add|update|remove|clear|remove-out-of-stock|save-for-later|reset-quantity` ·
`GET /cart/validate-stock` — all `requireAuthAPI`. `GET /cart/count` is **public**.

**Wishlist** ([wishlist.routes.ts](../../backend/modules/wishlist/wishlist.routes.ts), prefixed)
`POST /wishlist/add` · `DELETE /wishlist/remove/:productId` · `GET /wishlist/search`.

**Addresses** ([address.routes.ts](../../backend/modules/addresses/address.routes.ts), root mount)
`GET /api/addresses` · `GET /api/addresses/paginated` · `GET|PUT|DELETE /api/address/:addressId` ·
`POST /api/address` · `PATCH /api/address/:addressId/default` · `GET /api/states-districts` (**public**).

**Checkout** ([checkout.routes.ts](../../backend/modules/checkout/checkout.routes.ts), prefixed) —
the 12 endpoints tabulated under the checkout page above.

**Orders** ([order.routes.ts](../../backend/modules/orders/order.routes.ts), root mount)
`GET /orders/api/filtered` · `GET /orders/api/search` · `PATCH /orders/:orderId` ·
`PATCH /orders/:orderId/items/:itemId` · `POST /orders/:orderId/returns` ·
`POST /orders/:orderId/items/:itemId/returns` · `GET /orders/:orderId/invoice` (file stream).

**Profile** ([profile.routes.ts](../../backend/modules/users/profile.routes.ts), root mount)
`POST /profile/edit|email|verify-email-update-otp|resend-email-update-otp|verify-current-email|verify-email-otp|change-email|change-password` ·
`POST|DELETE /profile/photo` · `GET|POST /logout`.

**Wallet** ([wallet.routes.ts](../../backend/modules/wallet/wallet.routes.ts), prefixed)
`GET /wallet/balance|transactions/paginated|stats|transaction/:id` ·
`POST /wallet/add-money|topup/create-order|topup/verify-razorpay|debit`.

**Coupons** ([coupon.routes.ts](../../backend/modules/coupons/coupon.routes.ts), prefixed)
`GET /coupons/available` — no guard declared; returns 401 internally without a user.

**Content** `POST /help/contact`.

Full request/response shapes are in the live OpenAPI spec at `/docs` (156 operations).
Read that before guessing a payload.
