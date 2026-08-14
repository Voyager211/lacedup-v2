# Frontend

The Phase 4 app: what is built, what is next, and the specification for the rest.

Phases 0–3 are done — the `src/` restructure, a 16-module modular monolith, 100% TypeScript,
JWT auth, Swagger at `/docs`. **The backend is finished. Build against it as a stable API.**

## Running it

```bash
# once
cd src/frontend && npm install

# two terminals
npm run dev            # from the repo root — backend on :3000
cd src/frontend && npm run dev   # SPA on :5173
```

Open **http://localhost:5173**. Vite proxies `/api`, `/uploads`, `/images` and `/google` to the backend
so the browser sees one origin — which matters because auth is carried in httpOnly cookies,
and a cross-origin setup would need CORS plus `SameSite=None` on every one of them.

| Script | Does |
|---|---|
| `npm run dev` | dev server on :5173 with the backend proxy |
| `npm run build` | typecheck, then production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run test:watch` | Vitest in watch mode |

## Status

**Phase 4 is complete — steps 0 through 11.** The scaffold, the primitives, the shells,
auth, browse, cart, wishlist, checkout, orders, the account pages, the whole admin panel
and the reporting.

The only placeholders left are `/about` and `/help` — static content with no behaviour to
port, deliberately deferred rather than forgotten.

**528 tests pass — 367 frontend, 161 backend.**

See the primitives running at **http://localhost:5173/_gallery** (development only — it is
tree-shaken out of the production bundle).

### Step 0 — foundation

| Built | Where |
|---|---|
| Vite + React 19 + TS 7 + Tailwind 4 | `vite.config.ts`, `tsconfig.json` |
| Design tokens as a Tailwind theme | `src/styles/index.css` |
| axios client + refresh-on-401 interceptor | `src/api/client.ts` |
| Redux store, dual-audience session state | `src/app/store.ts`, `src/features/auth/` |
| Route tree, `RequireAuth` / `RequireGuest` | `src/app/router.tsx`, `src/app/guards.tsx` |

### Step 1 — primitives

| Built | Replaces |
|---|---|
| `<Badge>` + status/method tone maps | 5 class families, 457 of design-system.css's 606 lines |
| `<Modal>` (Radix) | 45 `bootstrap.Modal` instantiations across 24 ids |
| `useConfirm()` / `usePrompt()` | ~120 SweetAlert confirmations and the reason pickers |
| `<Toaster>` + `useToast()` | SweetAlert (262 calls), Toastr (35), Toastify (0, loaded anyway) |
| `<Pagination>` + `pageItems()` | 3 JS implementations, 2 EJS partials, per-page reimplementations |
| `<QueryBoundary>`, `<Skeleton>`, `<EmptyState>` | 5 loading idioms, 9 empty-state classes, 1 error state |
| `<TextField>`, `<SelectField>`, `<PasswordField>`, `<OtpInput>` | the 475-line `FormValidator`, 3 copies of the OTP boxes |
| `lib/schemas.ts` (Zod) | 3 competing validation systems with contradictory rules |
| `lib/imageValidation.ts`, `lib/format.ts`, `lib/pricing.ts` | ported / newly centralised |

### Step 2 — shells and the data layer

| Built | Notes |
|---|---|
| RTK Query over the axios client | `src/api/api.ts` — a custom base query, so the refresh interceptor still applies |
| `<StorefrontLayout>` | navbar, search typeahead, cart badge, account menu, mobile panel, footer |
| `<AdminLayout>` | icon sidebar, active-route highlighting, derived breadcrumbs, identity menu |
| `<AuthLayout>` | centred card, no chrome |
| Route-level code splitting | the admin branch is its own chunk; vendor is separated for caching |

### Step 3 — auth

All six pages: sign in, create account, verify email, forgot password, verify reset code,
set a new password. Google OAuth is a real navigation to `/google`, proxied in dev.

### Step 4 — storefront browse

Landing, shop and product details, plus `<ProductCard>` and the catalog API slice.

| Built | Notes |
|---|---|
| `<LandingPage>` | hero, new arrivals, best sellers, category and brand grids — one request |
| `<ShopPage>` | filters, sort, pagination, all driven by the URL so a filtered view is linkable |
| `<ProductDetailsPage>` | gallery, variant selector, stock states, reviews, related products |
| `<ProductCard>` | shared by landing, shop, wishlist and related products |

### Step 5 — cart & wishlist

| Built | Notes |
|---|---|
| `<CartPage>` | quantity steppers, the three server buckets, save-for-later, confirm-before-empty |
| `<WishlistPage>` | debounced search, reuses `<ProductCard>` |
| Add to cart / wishlist | wired into the product page — the button now works |

### Step 6 — checkout

| Built | Notes |
|---|---|
| `<CheckoutPage>` | addresses, coupons, three payment paths, stock recheck before payment |
| `<AddressFormDialog>` | replaces the 927-line partial shared by checkout and the address book |
| `useRazorpay()` | loads the SDK on demand, guards re-entry, reports dismissal |
| Order success / failure / retry pages | |

### Step 7 — orders & returns

| Built | Notes |
|---|---|
| `<OrdersPage>` | URL-driven search, status filter and paging |
| `<OrderDetailsPage>` | items, payment breakdown, address, status history |
| `useOrderActions()` | cancel and return at order or item level, plus invoice download |

### Step 8 — account

| Built | Notes |
|---|---|
| `<ProfilePage>` | details and avatar upload; `/profile/edit` now redirects here |
| `<ChangePasswordPage>` | |
| `<AddressBookPage>` | reuses the checkout address dialog |
| `<WalletPage>` | balance, paginated transactions, Razorpay top-up |
| `<ReferralsPage>` | code, invite link, referred people, rewards |
| `<AccountNav>` | replaces `profile-sidebar` + `profile-card` |

### Step 9 — admin catalog

| Built | Notes |
|---|---|
| `<AdminLoginPage>` | admin audience, so it sets the admin cookie pair |
| `<ResourceListPage>` | one list page, configured four times |
| `<ResourceFormDialog>` | one create/edit dialog, described by a field list |
| `<FilterBar>` | deferred from step 1 until it had consumers |
| Categories, Brands, Coupons, Products lists | |
| `<ProductFormPage>` + `<ImageUploader>` | add and edit in one component; 3–6 images |

### Step 10 — admin operations

| Built | Notes |
|---|---|
| `<AdminOrdersPage>` | item-level list, filters and paging from the URL |
| `<AdminOrderDetailsPage>` | status transitions, per-item status changes |
| `<AdminReturnsPage>` | approve and reject, with a reason the shopper sees |
| `<AdminUsersPage>` | block and unblock |

### Step 11 — reporting

| Built | Notes |
|---|---|
| `<DashboardPage>` | eight endpoints, one period selector; Chart.js → Recharts |
| `<SalesReportPage>` | filters in the URL, five stat cards, PDF and Excel export links |
| `<AdminProductDetailPage>` | the read-only view; shows which offer won and why |

Two backend endpoints were added for this step, both of which simply did not exist:

- **`GET /api/admin/sales-report`.** The EJS page refetched its own HTML with an
  `X-Requested-With` header, parsed the response with `DOMParser` and swapped four regions
  into place — against a controller with no branch for that header, so it re-rendered the
  entire page, layout included, on every filter change.
- **`GET /api/admin/products/:id`.** The admin product detail page only ever rendered EJS.

Recharts is around 350kB, so the dashboard route is lazy and charting is deliberately left
unassigned in `manualChunks` — see the comment in `vite.config.ts`. It lands in the
dashboard's own chunk, so a shopper browsing products never downloads it.

### Notes on what these steps changed

- **`product.features` is a comma-separated string, not an array.** The schema stores one
  required `String` and the EJS page called `.split(',')` on it. The React type declared
  `string[]` and mapped over it, which threw `features.map is not a function` on every
  product that had any — the fixtures all omitted the field, so nothing caught it until a
  backend test built a real product. Now typed as `string` with a `productFeatures()`
  helper that tolerates either shape, since the admin form has always accepted both.
- **`GET /api/auth/me` and `GET /api/admin/auth/me` were added to the backend.** The SPA
  cannot read httpOnly cookies, so without them it has no way to tell a signed-in visitor
  from a signed-out one except by firing a request and watching it fail. Both return 401
  rather than a null user, which keeps them on the same refresh-then-retry path as every
  other call. Covered by `src/backend/modules/auth/__tests__/session-me.test.ts`.
- **The auth routes are now registered under `/api` as well as their bare paths.** This
  router is root-mounted and deliberately not dual-mounted, so `/login`, `/signup`, the four
  OTP endpoints, `/reset-password` and **`/auth/refresh`** existed only on their bare paths —
  every one was a 404 under the `/api` base URL the client uses. Nothing in the frontend
  test suite could catch it, because a mocked adapter answers whatever path it is given;
  it only surfaced when the pages were exercised against the running server. There is now a
  parity test with a negative control so it cannot come back.
- **JSON logout endpoints were added** (`POST /api/auth/logout`, `POST /api/admin/auth/logout`).
  The EJS `GET /logout` answers with a 302 to an HTML page, which an XHR client can only
  follow and discard — and the shopper one was not reachable under `/api` at all.
- **Three catalog endpoints were added** — `GET /api/product/:slug`, `GET /api/catalog/filters`
  and `GET /api/home-sections`. The product page, the filter panel and the landing sections
  all received their data as EJS render locals, so none of them had an endpoint. The product
  one shares its implementation with the HTML page (`buildProductDetails`), so the two cannot
  show different prices.
- **Sort values must match `sortMap` in `shop.controller.ts`.** An unrecognised key is not an
  error there — it falls through to `newest`, so a wrong value produces a sort control that
  silently does nothing. Three of the seven were wrong until they were checked against the
  running server; there is now a test pinning them.
- **Dual-mounted routes now answer by mount, not by header.** `GET /cart` and `GET /api/cart`
  are the *same* route — one wanting a page, the other data. The handler picks using
  `wantsJson(req)` (`common/utils/wants-json.util.ts`), which treats an `/api` request as an
  API request whatever headers it sent. That also means an unauthenticated `/api/*` request
  gets a 401 it can act on rather than a 302 to an HTML login page. Same for `/wishlist`.
- **The cart is re-costed on every read.** `buildCart` drops items whose product was deleted,
  re-prices anything whose offer moved since it was added, and splits the rest into
  buyable / out-of-stock / unavailable. **Never cache a cart price client-side**, and total
  only the buyable bucket — the other two cannot be checked out.
- **The pending-payment snapshot moved out of the session** into a `PendingOrder` collection
  keyed by the Razorpay order id, with a 30-minute TTL. Verification finds it by the id
  Razorpay returns, so a lost session can no longer leave a customer charged with no order.
  Covers the first-attempt, retry and payment-failure paths.
- **PayPal is dropped, not ported.** `paypalClientId` was hardcoded to the empty string, so
  the button could never work. The three live paths are Razorpay, wallet and COD.
- **Stock is rechecked before any payment sheet opens.** A shopper should learn a size sold
  out before being charged, not after.
- **The orders routes were the second root-mounted router unreachable under `/api`** — every
  one of the nine was a 404, exactly as the auth routes had been. They are now registered on
  both paths, with the `/api` forms dropping the odd inner segment
  (`/api/orders/filtered`, not `/api/orders/api/filtered`). There is a parity test with a
  negative control. **Check this first for any root-mounted router you build against.**
- **Cancellation and return reasons come from the server**, sent with the order. They are a
  server enum and it rejects anything outside its own list, so a hardcoded client copy would
  drift the moment one is added.
- **Order actions mirror the server's state rules** — cancel only while Pending or
  Processing, return only once Delivered. Offering a button the server will refuse is worse
  than not offering it; the server still decides.
- **The referral paginators are now mounted.** `getPaginatedReferrals` and
  `getPaginatedEarnings` existed as handlers but had no routes, so page 2 of either list had
  never worked for anyone. Fixed in step 8 — this was defect #1 in
  [docs/defects.md](docs/defects.md).
- **The profile router was the third root-mounted router unreachable under `/api`**, after
  auth and orders. Every guard now uses `wantsJson`, so `/api/profile`, `/api/wallet`,
  `/api/referrals` and `/api/addresses` all answer 401 JSON rather than redirecting an XHR
  caller to an HTML login page.
- **Address pagination is gone.** The server paginated at two per page, which made a handful
  of addresses feel like a filing cabinet. The list endpoint returns them all.
- **The email-change OTP flow is deliberately not ported.** It is one of the remaining
  express-session dependencies; moving it belongs with that work rather than being
  half-migrated. The profile page shows the email read-only with a note.
- **Three validation rules deliberately differ from the originals** — the email TLD
  allowlist is gone (it rejected `.io`, `.dev` and every newer TLD), names now allow
  apostrophes, hyphens and non-ASCII letters, and new passwords need 8 characters with a
  letter and a digit rather than 6 of anything. Login deliberately does *not* enforce the
  password rule, so accounts created under the old one can still sign in. Reasoning is at
  the top of `src/lib/schemas.ts`.
- **`exactOptionalPropertyTypes` is deliberately off** while the rest of `strict` is on. It
  fights React and RTK typings for little gain here; the reasoning is in `tsconfig.json`.
- **The footer's dead links were resolved rather than ported.** 11 of the EJS footer's 15
  links pointed at unmounted routes. Customer-service links now go to `/help`, which is the
  page that actually holds the FAQ and contact form; shop links go to `/shop`. **Privacy
  Policy, Terms of Service and Cookie Policy were removed** — no content exists behind them
  anywhere in the codebase, and a link to a missing legal page is worse than no link. The
  social icons were `href="#"` placeholders and are gone too. See the open items below.

---

## Documents

| | |
|---|---|
| [docs/pages-storefront.md](docs/pages-storefront.md) | 21 storefront + 6 auth + 2 error pages — routes, guards, render locals, endpoints, modals, client state |
| [docs/pages-admin.md](docs/pages-admin.md) | 14 admin pages, the admin shell, and the full admin API surface |
| [docs/components.md](docs/components.md) | Layouts, 29 partials, navigation maps, shared scripts, and the cross-cutting patterns (toasts, modals, pagination, formatting, validation, loading states) |
| [docs/design-tokens.md](docs/design-tokens.md) | The Tailwind theme, with the literal values read out of the current CSS |
| [docs/defects.md](docs/defects.md) | ~20 pre-existing bugs, ~1,900 lines of dead code, and 10 open decisions |

Read `components.md` before writing any component and `defects.md` before trusting any
endpoint.

---

## Target stack

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS** for all styling — **not** plain CSS, and **not** Bootstrap
- **Redux Toolkit** (+ RTK Query) for state and data fetching
- **axios** for HTTP — JWT travels in an httpOnly cookie, so `withCredentials: true`
- **React Router** for routing
- **Vitest** + **React Testing Library** + **MSW** for unit and component tests
- **Playwright** for E2E

> **Tailwind has a scope consequence worth pricing in.** The existing views are built on
> Bootstrap 5 — its grid, its utilities, and 45 live `bootstrap.Modal` / `Toast` / `Tooltip`
> instantiations. Choosing Tailwind means the markup **cannot be ported across and restyled
> later**; every view is a visual rebuild, not a translation. Budget for it, and expect the
> design to drift from the current look unless someone is deliberately matching it.

---

## Scope

| | Files | Lines | Inline script | Inline style | Markup |
|---|---:|---:|---:|---:|---:|
| Storefront pages | 21 | 18,825 | 6,389 | 6,507 | 6,228 |
| Auth pages | 6 | 1,438 | 1,052 | 96 | 295 |
| Admin pages | 14 | 20,104 | ~8,600 | ~7,200 | ~3,500 |
| Error pages | 2 | 20 | 0 | 0 | 20 |
| Layouts | 4 | 655 | | | |
| Partials | 29 | 5,578 | | | |
| **Views total** | **76** | **46,620** | | | |
| Live `public/js` | 8 | 4,799 | | | |
| `public/css` | 7 | 4,686 | | | |

**The real work is ~11,200 lines of imperative DOM code** — 429 `addEventListener`,
425 `querySelector`, 295 `innerHTML`, 137 `fetch` — becoming components. Estimating from the
view count alone undercounts this by roughly 3×.

Two entries in that table are misleading and worth calling out:

- **`cart.ejs` has zero inline script and `checkout.ejs` has 17 lines.** Their behaviour
  lives in `public/js/user/cart.js` (1,282 lines) and `checkout.js` (2,053). Judge those two
  pages by the JS.
- **~1,900 lines are dead** — unreferenced partials, never-loaded scripts, two stylesheets
  that don't load. Don't port them. See [docs/defects.md](docs/defects.md).

Largest single units: `admin/order-details` (2,320), `product-details` (2,550),
`admin/orders` (1,960), `admin/dashboard` (1,873), `profile` (1,729), `shop` (1,597), plus
`checkout.js` (2,053) and `cart.js` (1,282).

---

## Design decisions

Settled — recorded here so they don't get relitigated.

### 1. Brand colour is `#E03A2F`

The codebase carries two conflicting palettes: `user.css` defines
`--color-accent-red: #E03A2F` (what the storefront actually renders, plus about a dozen
hardcoded repeats in the navbar), while `design-system.css` defines
`--primary-color: #dc3545` (Bootstrap red, used by the status badges).

`#E03A2F` becomes `brand`. `#dc3545` survives only as the semantic `danger`, so destructive
actions stay visually distinct from brand actions. Full theme in
[docs/design-tokens.md](docs/design-tokens.md).

### 2. The admin shell gets modernized

Same nine routes, same information architecture — but with icons, active-route highlighting,
an admin identity menu, and a collapsible sidebar. The dead notification bell goes.

The current shell is nine text-only links with no active state and a header containing
nothing but a bell that opens a permanently-empty dropdown. A faithful port would carry those
gaps forward for no benefit.

### 3. Documentation is split

This README stays an overview; the inventory lives in `docs/`. One 1,000-line file would be
unreadable and would produce noisy diffs every time a single page's spec changed.

## Open items

Decisions still needed, and things deliberately left out. The fuller list — including the
pre-existing backend defects — is in [docs/defects.md](docs/defects.md).

- **Legal pages don't exist.** Privacy Policy, Terms of Service and Cookie Policy were linked
  from the EJS footer but never written. They are omitted from the React footer; add them
  back once there is content. An ecommerce site arguably needs them.
- **No social accounts.** The footer's social icons were `href="#"`. Supply real URLs and
  they can come back.
- **PayPal was dropped** — the controller hardcoded an empty client id, so it had never
  worked. Razorpay, wallet and COD are the payment methods.
- **`/coupons` has no page**, and its route 500s. Absent from the router until someone
  decides whether the page is wanted.
- **`/about` and `/help` are still placeholders.** `/about` is 759 lines of static markup;
  `/help` is an FAQ accordion plus `POST /help/contact`. Neither blocks anything.
- **Phase 5 is next**: delete the EJS layer, drop `express-session`, `connect-mongo` and
  `connect-flash`, remove the auth shims, and remove the duplicate bare mounts that exist
  only to keep those views working.

---

## Backend contract

### API surface

- **`/api` is the mount to use.** Prefixed routers (cart, wishlist, wallet, coupons,
  referrals, checkout, help, about, and all admin routers) are mounted twice — on their
  historic path for the EJS views, and under `/api`.
- **Root-mounted routers are *not* dual-mounted.** They already declare `/api/...` endpoints
  internally (47 of them, across addresses, catalog, shop and checkout). `/api/shop` returns
  JSON; `/shop` returns HTML.
- **Live docs at `/docs`**, raw OpenAPI at `/docs.json` — 156 documented operations, 15 tags,
  11 schemas. Read this before guessing a payload shape.
- 93% of controller responses were already JSON before any of this started, so most screens
  have an endpoint waiting for them.

> `/docs` builds its spec by reading the route **sources** at startup. `npm run dev` works
> because tsx serves `.ts` directly. A compiled `npm start` needs the sources shipped
> alongside `dist`, or the spec generated at build time. **Unresolved — settle before
> deploying.**

### Auth

JWT in httpOnly cookies. Nothing is readable from JavaScript, so there is no token to store,
attach, or refresh manually — just send credentials.

```ts
axios.create({ baseURL: '/api', withCredentials: true })
```

| | Shopper | Admin |
|---|---|---|
| Access cookie | `user_at` | `admin_at` |
| Refresh cookie | `user_rt` | `admin_rt` |
| Access lifetime | 20 min | 60 min |
| Refresh endpoint | `POST /auth/refresh` | `POST /admin/auth/refresh` |

- Refresh lasts 7 days and **rotates single-use** — the presented token is revoked as part of
  the exchange. On a 401, call refresh once and retry; if refresh also 401s, send the user to
  login. **Do not retry in a loop.**
- The two audiences are independent: one browser can hold an admin and a shopper login at
  once, and a shopper token will not satisfy an admin route.
- A blocked user is rejected at verification time, not just at login — a valid token stops
  working the moment an admin blocks them, and blocking revokes every outstanding refresh
  token.

### Behaviour the frontend must respect

- **Prices are computed per request, never stored.** The largest of the category, brand,
  product and variant offers wins. Do not cache a price client-side and assume it holds.
  (The current `shop.ejs` recomputes prices in the browser — do not port that.)
- **Order status is derived, not set.** `calculateOrderStatus` recomputes it from item
  statuses on every item update. `Partially Delivered` and `Partially Returned` are roll-ups —
  no item ever holds those values.
- **Uploads are served from `/uploads/...`** and their URLs are stored in the database.
  `public/` stays at the repo root; do not move it into the bundle.
- **Rate limits** apply to auth (10/15min), OTP (5/15min), password reset (5/hour), coupon
  apply (10/15min), payments (30/15min) and a 500/15min `/api` backstop. Surface 429s
  meaningfully rather than as generic errors.

---

## Route map

```
Storefront                        Auth                    Admin
/                landing          /login                  /admin/login
/home            (same page)      /signup                 /admin/dashboard
/shop                             /verify-otp             /admin/products
/product/:slug                    /forgot-password        /admin/products/add
/cart                             /reset-otp              /admin/products/:id
/wishlist                         /reset-password         /admin/products/:id/edit
/checkout                                                 /admin/categories
/checkout/order-success/:orderId                          /admin/brands
/checkout/order-failure/:txnId                            /admin/orders
/checkout/retry-payment/:txnId                            /admin/orders/:orderId
/orders                                                   /admin/returns
/orders/:orderId                                          /admin/users
/profile                                                  /admin/coupons
/profile/edit                                             /admin/sales-report
/profile/change-password
/addresses
/wallet
/referrals
/about
/help
/coupons          ← broken today, see docs/defects.md
```

`/` and `/home` render the same page in the current app; the only difference is a guard.
Build one route.

---

## Conversion order

Sequenced so each step unblocks the next, and the riskiest work lands with the most context
behind it. **Steps 0–2 are what stop the current duplication from being recreated in React** —
resist the urge to start on pages before they're done.

| # | Step | Notes |
|---|---|---|
| 0 | ~~**Scaffold + design system**~~ | ✅ done |
| 1 | ~~**Primitives**~~ | ✅ done — except `<FilterBar>` and `<ImageUploader>`, deferred to the steps that first need them (9 and 8) |
| 2 | ~~**Shells**~~ | ✅ done — plus the RTK Query data layer |
| 3 | ~~**Auth**~~ | ✅ done |
| 4 | ~~**Storefront browse**~~ | ✅ done |
| 5 | ~~**Cart & wishlist**~~ | ✅ done |
| 6 | ~~**Checkout**~~ | ✅ done — PayPal dropped, payment state moved server-side |
| 7 | ~~**Orders & returns**~~ | ✅ done |
| 8 | ~~**Profile, addresses, wallet, referrals**~~ | ✅ done — the `/coupons` page is still an open decision |
| 9 | ~~**Admin catalog**~~ | ✅ done |
| 10 | ~~**Admin orders, returns, users**~~ | ✅ done |
| 11 | ~~**Admin dashboard & sales report**~~ | ✅ done — two new backend endpoints |

### The four highest-leverage consolidations

Worth doing deliberately rather than discovering page by page:

1. **One `<ResourceListPage>`** replaces products, categories, brands and coupons — ~6,700
   lines of near-duplicate script, four config objects.
2. **One `<ProductForm mode>`** replaces add-product and edit-product — ~2,400 lines.
3. **One toast + one confirm dialog** replaces 262 SweetAlert calls, 35 Toastr calls, and a
   Toastify library that is loaded on every admin page and never called.
4. **One `<Pagination>`** replaces three implementations (two byte-identical, none of them
   loaded on the storefront) plus per-page reimplementations.

---

## Phase 4 checklist

### 1. Migrate transient state out of `express-session`

> express-session is still there. Phase 3's exit criteria said remove it, but ~90 uses keep
> transient, non-auth state in it. Ripping that out then would have risked the checkout path
> for no gain — it's better done with the React rewrite, when the client can hold that state.
> `passport.session()` is gone; passport now only verifies credentials.

| Session field | Uses | What it holds | Suggested owner |
|---|---|---|---|
| `appliedCoupon` | 51 | Coupon applied to the current cart | Redux (re-validate server-side at place-order) |
| `pendingUser` | 13 | Signup details held between OTP request and verify | Redux, or a short-lived server record |
| `emailChangeOtp` | 13 | OTP challenge during an email change | same |
| `paymentFailure` | 9 | Failed-payment record behind the retry page | Redux, or a query param + server lookup |
| ~~`pendingRazorpayOrder`~~ | ~~6~~ | **Done in step 6** — moved to a `PendingOrder` collection | ✅ |
| flash messages | 16 | One-shot UI notices | toasts — but see the flash bug below |

✅ **`pendingRazorpayOrder` is resolved.** It now lives in a `PendingOrder` collection keyed by
the Razorpay order id, with a 30-minute TTL. Verification finds it by the id Razorpay returns,
so it no longer depends on the session surviving the trip to the payment provider — which
previously left customers charged with no order when a session expired mid-payment.

> A correction to an earlier note here: this was described as "the only record of the basket
> mid-payment", implying a closed tab would lose the cart. That was wrong. The cart is cleared
> only *after* verification succeeds, so it survives. The snapshot's real job is narrower —
> freezing the price and coupon so the order created matches the amount charged.

⚠️ **Flash messages are already broken.** They are written in 8 places and rendered in exactly
one template (admin login). Blocked-user notices, "please log in", coupon errors and wallet
failures are all silently dropped today. Replacing flash with toasts is a bug fix, not just a
migration — see [docs/components.md](docs/components.md).

Once all of the above are migrated, `express-session`, `connect-mongo` and `connect-flash`
come out, and the shims below go with them.

### 2. Remove the auth compatibility shims

Both live in `common/middlewares/jwt-auth.middleware.ts` and exist only for the EJS layer:

- `req.isAuthenticated()` is shimmed because passport defined it and 24 call sites still use it.
- `req.session.userId` is mirrored from the JWT because 71 places read it, 49 of them with no
  `req.user` fallback.

The JWT is the source of truth in both cases. Delete the shims when the EJS views go.

### 3. Delete the EJS layer

`src/backend/views/`, plus `ejs` and `express-ejs-layouts` from package.json, and the
duplicate bare route mounts in `app.ts` (keep only `/api`).

### 4. Library replacements

| Currently | Replace with |
|---|---|
| Bootstrap 5 + 45 modal instantiations | **Tailwind** + headless components (Radix / Headless UI) — no Bootstrap |
| SweetAlert2 (262 calls) | `useToast()` + `useConfirm()` + `<LoadingOverlay>` — see the breakdown in components.md |
| Toastr (35 calls) **and** Toastify (0 calls, loaded anyway) | consolidate into the one toast library |
| Cropper.js (two versions loaded on some pages) | `react-cropper` or `react-easy-crop` |
| Chart.js 4.4.0 | Recharts |
| Geoapify autocomplete | official React usage of `@geoapify/geocoder-autocomplete` |
| Razorpay Checkout | dynamic script load in a `useRazorpay()` hook |
| jQuery 3.6.0 | remove — it is loaded solely because Toastr needs it |
| 137 `fetch` calls | axios instance + RTK Query |
| `stateDistrictData.js` (~40KB bundled) | `GET /api/states-districts` — it is already an endpoint |
| Bootstrap Icons webfont | `react-icons/bs` (1:1, 143 icons in use) |

---

## Testing

**Backend: 154 tests. Frontend: 350.** Both suites pass and both typecheck clean under
`strict`. Keep it that way — run `npm test` on both sides before and after touching anything
shared.

The frontend tests target the pieces where a mistake is expensive and invisible: the refresh
interceptor (including that concurrent 401s share **one** refresh — single-use rotation
means three parallel refreshes would revoke each other), the route guards, the confirm
promise plumbing, pagination windowing, the validation schemas, the shells' signed-in vs
signed-out behaviour, and the formatting and pricing helpers.

Still to add: MSW for network-level mocking, and Playwright for E2E. Priority journeys:

- browse → product → add to cart → checkout → COD order placed
- signup with OTP → login → logout
- wallet top-up → pay from wallet
- cancel order → refund to wallet
- admin: login → add product → verify it appears in the storefront

**Note on test fixtures:** seed users with a *plaintext* password. The User model hashes on
save, so pre-hashing stores `bcrypt(bcrypt(pw))` and no login can succeed. This bug sat in the
auth suite undetected because those tests only asserted on failed logins.

---

## Planned layout

```
src/frontend/
├── src/
│   ├── app/          store, router, providers
│   ├── features/     one folder per backend module (auth, cart, catalog, ...)
│   ├── components/   shared UI primitives
│   ├── api/          axios client + per-module endpoints
│   ├── lib/          format, pricing, validation schemas, image validation
│   └── types/        shared with backend where practical
├── docs/             this specification
├── index.html
└── vite.config.ts
```

There is no `tailwind.config.ts`: Tailwind 4 is CSS-first, so the theme lives in the
`@theme` block of `src/styles/index.css` — each token there generates its own utilities.

Feature folders mirror the backend's 16 modules — `auth`, `users`, `catalog`, `reviews`,
`cart`, `wishlist`, `addresses`, `checkout`, `orders`, `returns`, `coupons`, `wallet`,
`referrals`, `payments`, `reports`, `content` — so the two sides stay navigable together.
