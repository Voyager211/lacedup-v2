# Frontend

Not yet scaffolded. This file is the Phase 4 handoff: the target stack, the
backend contract to build against, and the work carried over from Phases 1–3.

---

## Target stack

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS** for all styling — **not** plain CSS, and **not** Bootstrap
- **Redux Toolkit** for state
- **axios** for HTTP (JWT travels in an httpOnly cookie, so `withCredentials: true`)
- **React Router** for routing
- **Vitest** + **React Testing Library** + **MSW** for unit/component tests
- **Playwright** for E2E

> **Tailwind has a scope consequence worth pricing in.** The existing EJS views
> are built on Bootstrap 5 — its grid, its utility classes, and 51 live
> `bootstrap.Modal` / `Toast` / `Tooltip` instantiations. Choosing Tailwind means
> the markup **cannot be ported across and restyled later**; every view is a
> visual rebuild, not a translation. That is a bigger job than swapping in
> `react-bootstrap` would have been. Budget for it, and expect the design to
> drift from the current look unless someone is deliberately matching it.

---

## What this replaces

76 EJS templates in [`../backend/views`](../backend/views). They are mostly not
markup:

| | Lines |
|---|---|
| inline `<script>` | ~18,600 |
| inline `<style>` | ~17,300 |
| actual markup | ~10,800 |
| **total** | **~46,700** |

Plus ~4,990 lines of client JS in `public/js` and ~4,040 in `public/css`.

So the real work is **~23,600 lines of imperative DOM code** becoming
components — 429 `addEventListener`, 425 `querySelector`, 295 `innerHTML`,
137 `fetch`. Estimating from the view count alone undercounts this roughly 3×.

Split: **admin 22 views / ~19,300 lines**, **storefront 50 views / ~22,400 lines**.

Largest single views: `user/product-details` (2,236), `admin/order-details`
(2,167), `admin/orders` (1,779), `admin/dashboard` (1,699), `user/shop` (1,421).

---

## Backend contract

The backend is finished and fully TypeScript. Build against it as a stable API.

### API surface

- **`/api` is the mount to use.** Prefixed routers (cart, wishlist, wallet,
  coupons, referrals, checkout, help, about, and all admin routers) are mounted
  twice — on their historic path for the EJS views, and under `/api`.
- **Root-mounted routers are *not* dual-mounted.** They already declare their
  own `/api/...` endpoints internally (47 of them, across addresses, catalog,
  shop and checkout). `/api/shop` returns JSON; `/shop` returns HTML.
- **Live docs at `/docs`**, raw OpenAPI at `/docs.json` — 156 documented
  operations, 15 tags, 11 schemas. Read this before guessing a payload shape.
- 93% of controller responses were already JSON before any of this started, so
  most screens have an endpoint waiting for them.

> `/docs` builds its spec by reading the route **sources** at startup. `npm run
> dev` works because tsx serves `.ts` directly. A compiled `npm start` needs the
> sources shipped alongside `dist`, or the spec generated at build time.
> **Unresolved — settle before deploying.**

### Auth (Phase 3, done)

JWT in httpOnly cookies. Nothing is readable from JavaScript, so there is no
token to store, attach, or refresh manually — just send credentials.

```ts
axios.create({ baseURL: '/api', withCredentials: true })
```

| | Shopper | Admin |
|---|---|---|
| Access cookie | `user_at` | `admin_at` |
| Refresh cookie | `user_rt` | `admin_rt` |
| Access lifetime | 20 min | 60 min |
| Refresh endpoint | `POST /auth/refresh` | `POST /admin/auth/refresh` |

- Refresh lasts 7 days and **rotates single-use** — the presented token is
  revoked as part of the exchange. On a 401, call refresh once and retry; if
  refresh also 401s, send the user to login. Do not retry in a loop.
- The two audiences are independent: one browser can hold an admin and a shopper
  login at once, and a shopper token will not satisfy an admin route.
- A blocked user is rejected at verification time, not just at login — a valid
  token stops working the moment an admin blocks them.

---

## Phase 4 checklist

### 1. Migrate transient state out of `express-session`

> express-session is still there. The plan's exit criteria said remove it, but
> ~90 uses keep transient, non-auth state in it: the OTP flows, the applied
> coupon, the Razorpay basket held between creating a payment and verifying it,
> the payment-failure record, and flash messages. Ripping that out now would
> risk the checkout path for no gain — it's better done with the React rewrite,
> when the client can hold that state. `passport.session()` is gone; passport
> now only verifies credentials.

Concretely, what still lives in the session and needs a home:

| Session field | Uses | What it holds | Suggested owner |
|---|---|---|---|
| `appliedCoupon` | 51 | Coupon applied to the current cart | Redux (re-validate server-side at place-order) |
| `pendingUser` | 13 | Signup details held between OTP request and verify | Redux, or a short-lived server record |
| `emailChangeOtp` | 13 | OTP challenge during an email change | Same as above |
| `paymentFailure` | 9 | Failed-payment record behind the retry page | Redux, or a query param + server lookup |
| `pendingRazorpayOrder` | 6 | **The basket, between creating a Razorpay order and verifying payment** | ⚠️ see below |
| flash messages | 16 | One-shot UI notices | Toasts, client-side |

⚠️ **`pendingRazorpayOrder` needs care.** No order row exists until the payment
signature verifies, so this session object is the *only* record of the basket
mid-payment. Moving it client-side means a closed tab loses the basket; moving
it server-side means a new collection with its own expiry. Decide deliberately —
this is the one item here that can lose a customer's cart.

Once all of the above are migrated, `express-session`, `connect-mongo` and
`connect-flash` come out, and the two compatibility shims below go with them.

### 2. Remove the auth compatibility shims

Both live in `common/middlewares/jwt-auth.middleware.ts` and exist only for the
EJS layer:

- `req.isAuthenticated()` is shimmed because passport defined it and 24 call
  sites still use it.
- `req.session.userId` is mirrored from the JWT because 71 places read it, 49 of
  them with no `req.user` fallback.

The JWT is the source of truth in both cases. Delete the shims when the EJS
views go.

### 3. Delete the EJS layer

`src/backend/views/`, plus `ejs` and `express-ejs-layouts` from package.json,
and the duplicate bare route mounts in `app.ts` (keep only `/api`).

### 4. Library replacements

| Currently | Replace with |
|---|---|
| Bootstrap 5 + 51 `bootstrap.Modal` | **Tailwind** + headless components (Radix / Headless UI) — no Bootstrap |
| SweetAlert2 (347 calls) | `sweetalert2-react-content`, or a Tailwind dialog |
| Cropper.js | `react-cropper` |
| Toastify **and** Toastr (both loaded today) | `react-toastify` — consolidate to one |
| Geoapify autocomplete | official React usage of `@geoapify/geocoder-autocomplete` |
| Razorpay Checkout | dynamic script load in a hook |
| 137 `fetch` calls | axios instance + RTK thunks |

---

## Backend behaviour the frontend must respect

- **Prices are computed per request, never stored.** The largest of the
  category, brand, product and variant offers wins. Do not cache a price
  client-side and assume it holds; re-read it from the API.
- **Order status is derived, not set.** `calculateOrderStatus` recomputes it
  from item statuses on every item update. `Partially Delivered` and
  `Partially Returned` are roll-ups — no item ever holds those values.
- **Admin status control is refused on partially-delivered orders.**
  `getValidTransitions` has no entry for the partial states, so the transitions
  endpoint returns `[]`. The order is *not* stuck — it progresses through
  item-level updates and recomputes automatically. **But an admin sees an empty
  dropdown with no explanation.** Worth fixing in the admin UI: show why, and
  point at the per-item actions.
- **Uploads are served from `/uploads/...`** and their URLs are stored in the
  database. `public/` stays at the repo root; do not move it into the bundle.
- **Rate limits** apply to auth (10/15min), OTP (5/15min), password reset
  (5/hour), coupon apply (10/15min), payments (30/15min) and a 500/15min API
  backstop. Surface 429s meaningfully rather than as generic errors.

---

## Open items inherited from earlier phases

Not blockers, but they will surface during Phase 4:

- **`transactionService` never existed.** Three call sites were removed in Phase
  1 rather than inventing the module. COD-completion and the user transactions
  list lost nothing functional, but if a transactions screen is wanted, that
  service has to be written.
- **Two admin endpoints are unreachable.** `GET /admin/orders/statistics` and
  `/export` are declared *after* `GET /:orderId`, so Express matches the
  parameterised route first. Documented as shadowed; reordering changes which
  handler runs, so it was left as a decision.
- **A doubled path segment:** `PATCH /admin/orders/orders/:orderId/fix-payment-status`.
- **Two mongodb drivers installed** (mongoose bundles 6.16, connect-mongo's peer
  resolves 6.20). Harmless at runtime; the session store carries a cast.
  Disappears if connect-mongo goes in step 1.
- **Duplicate `processedDate`/`processedBy` vs `approvedAt`/`approvedBy`** on the
  Return schema — the service only writes the latter pair. Worth consolidating.
- **`/test-email`** is registered only when `NODE_ENV !== 'production'`; it
  reports `EMAIL_USER` and the length of `EMAIL_PASS`.

---

## Suggested conversion order

1. **Shell** — layout, nav, footer, router, Redux store, axios client with the
   refresh-on-401 interceptor, auth guard, Tailwind config and design tokens
2. **Auth** — login, signup, OTP, forgot/reset, Google OAuth redirect
3. **Storefront browse** — landing, home, shop, product details
4. **Cart & wishlist**
5. **Checkout** — riskiest: Razorpay, PayPal and wallet paths, plus the
   `pendingRazorpayOrder` decision above
6. **Orders & returns** — list, details, invoices
7. **Profile, addresses, wallet, referrals, coupons**
8. **Admin** — dashboard, orders, products, categories, brands, coupons,
   returns, sales report

---

## Testing

Backend currently: **99 tests, all passing**, `tsc --noEmit` clean under
`strict`. Keep it that way — run `npm test` before and after touching anything
shared.

For the frontend: Vitest + React Testing Library for components, MSW to mock the
API at the network layer, Playwright for E2E. Priority journeys:

- browse → product → add to cart → checkout → COD order placed
- signup with OTP → login → logout
- wallet top-up → pay from wallet
- cancel order → refund to wallet
- admin: login → add product → verify it appears in the storefront

**Note on test fixtures:** seed users with a *plaintext* password. The User model
hashes on save, so pre-hashing stores `bcrypt(bcrypt(pw))` and no login can
succeed. This bug sat in the auth suite undetected because those tests only
asserted on failed logins.

---

## Planned layout

```
src/frontend/
├── src/
│   ├── app/          store, router, providers
│   ├── features/     one folder per backend module (auth, cart, catalog, ...)
│   ├── components/   shared UI
│   ├── api/          axios client + per-module endpoints
│   └── types/        shared with backend where practical
├── index.html
├── tailwind.config.ts
└── vite.config.ts
```

Feature folders mirror the backend's 16 modules — `auth`, `users`, `catalog`,
`reviews`, `cart`, `wishlist`, `addresses`, `checkout`, `orders`, `returns`,
`coupons`, `wallet`, `referrals`, `payments`, `reports`, `content` — so the two
sides stay navigable together.
