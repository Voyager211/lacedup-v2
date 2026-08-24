# Layouts, Components & Cross-Cutting Patterns

What gets built once and reused everywhere: the four layouts, the 29 partials, both
navigation maps, the shared client scripts, and the cross-cutting patterns (toasts, modals,
pagination, formatting, validation, loading states, flash messages).

This is the document to read before writing any component. Almost every pattern below exists
two or three times in the current codebase; the point of listing them is to build each one
once instead.

---

## 1. Layouts

`express-ejs-layouts` is configured in [app.ts:62-65](../../backend/app.ts#L62):

```ts
app.set('view engine', 'ejs');
app.set('views', VIEWS_DIR);
app.use(expressLayouts);
app.set('layout', 'admin/layout');   // the global default is the ADMIN layout
```

> The global default being `admin/layout` means every storefront controller has to pass
> `layout: 'user/layouts/user-layout'` explicitly — about 40 render sites do. Miss it and
> the page renders inside the admin chrome. Two known routes get this wrong; see
> [defects.md](defects.md).

| Layout | File | Lines | Used by |
|---|---|---:|---|
| Storefront | [user/layouts/user-layout.ejs](../../backend/views/user/layouts/user-layout.ejs) | 290 | ~34 render sites |
| Auth | [user/layouts/auth-layout.ejs](../../backend/views/user/layouts/auth-layout.ejs) | 72 | the 6 auth pages |
| Admin login | [layouts/login-layout.ejs](../../backend/views/layouts/login-layout.ejs) | 15 | admin login only |
| Admin | [admin/layout.ejs](../../backend/views/admin/layout.ejs) | 278 | all 14 admin pages |

### `user-layout` — 290 lines

**Locals:** `title` (defaults to `'LacedUp Co.'`), `body`; transitively needs `user` and
`active` because the navbar reads both.

**Structure:** head → navbar → `<main id="main-content">` → footer → scripts → 170 lines of
inline Toastr override CSS.

**Inline script:** Toastr global config (top-right, 4s timeout, max 3 open, no duplicates,
progress bar) plus a `window.showToast = { success, error, warning, info }` façade.

**Assets it loads on every storefront page:**

| | |
|---|---|
| CSS | Bootstrap 5.3.3, bootstrap-icons 1.10.5, Cropper.js 1.5.13, Geoapify geocoder-autocomplete, Toastr (**`latest` — unpinned**) |
| CSS (local) | `/css/user.css`, `/css/design-system.css`, `/css/components/coupon-card.css` |
| JS | Geoapify, SweetAlert2 v11, jQuery 3.6.0 (only because Toastr needs it), Bootstrap bundle, Toastr, Cropper.js |
| JS (local) | `/js/user/cart.js`, `/js/user/wishlist.js` |

`/css/pagination.css` is linked but **commented out** (line 26), so the storefront's
pagination styling never applies.

Because `cart.js` and `wishlist.js` load globally, add-to-cart and wishlist-toggle work on
every storefront page. In React those become mutations on a shared cart/wishlist slice.

### `auth-layout` — 72 lines

No navbar, no footer. Loads Bootstrap, bootstrap-icons (**unpinned**), `/css/user.css` and
SweetAlert2 — but **not** `design-system.css` and **not** Toastr. So badge tokens and toasts
are unavailable here while SweetAlert is.

Its inline `<style>` defines a page-transition overlay (fixed backdrop, spinner, text). The
JavaScript that drives it, `window.PageTransition`, **does not exist anywhere in the repo** —
three views guard on it and always fall through. Dead CSS plus three dead branches.

### `login-layout` — 15 lines

Bootstrap **5.3.0** CSS only (no JS bundle), unpinned bootstrap-icons, `/css/admin.css`.
Title renders as `{title} | LacedUp Co. Admin`. Admin login only.

### `admin/layout` — 278 lines

Covered in [pages-admin.md](pages-admin.md#the-admin-shell). Loads Bootstrap **5.3.0**,
bootstrap-icons (unpinned), Cropper.js 1.5.13, **Toastify** (never called), SweetAlert2
(**loaded twice**, head and body), Chart.js 4.4.0, Geoapify (no admin page uses it),
`/css/design-system.css`, `/css/admin.css`, `/css/components/coupon-card.css`,
`/js/utils/pagination.js`.

### Version drift to resolve

| | Storefront | Admin |
|---|---|---|
| Bootstrap | 5.3.3 | 5.3.0 |
| bootstrap-icons | 1.10.5 (pinned) | unpinned |
| Toast library | Toastr + jQuery | Toastify (loaded, never called) |
| Cropper.js | 1.5.13 | 1.5.13 in the layout, **1.6.1 loaded again per page** on categories/brands |

All of it goes away with npm dependencies and a single Vite build.

---

## 2. Storefront partials

[backend/src/views/user/partials/](../../backend/src/views/user/partials/) — 21 files, 4,399
lines, plus [views/utils/coupon-card.ejs](../../backend/views/utils/coupon-card.ejs).

### Live

| Partial | Lines | Params | Included by | React target |
|---|---:|---|---|---|
| `navbar.ejs` | 537 | `active`, `user`, `searchQuery` | `user-layout` | `<Navbar>` + `<SearchTypeahead>` + `<CartBadge>` |
| `footer.ejs` | 72 | none | `user-layout` | `<Footer>` |
| `breadcrumb.ejs` | 50 | `breadcrumbs: [{label, href?}]` | 11 pages | derive from the route tree |
| `product-card.ejs` | 113 | `product`, `isWishlistPage?`, `userWishlistProductIds?` | home, landing, shop, wishlist, product-details | `<ProductCard>` |
| `cart-item-card.ejs` | 160 | `item` | cart | `<CartLineItem>` |
| `profile-sidebar.ejs` | 191 | `user`, `active` | 6 account pages | `<AccountSidebar>` |
| `profile-card.ejs` | 171 | `user` | `profile-sidebar` only | fold into `<AccountSidebar>` |
| `addresses.ejs` | **927** | `address?` | address-book, checkout | `<AddressFormDialog>` |
| `banner.ejs` | 288 | none (hardcoded) | home, landing | `<HeroCarousel>` |
| `category-carousel.ejs` | 288 | `categories` | home, landing | `<CategoryCarousel>` |
| `shop-by-brands.ejs` | 175 | `brands` | home, landing | `<BrandGrid>` |
| `testimonials.ejs` | 52 | none (3 hardcoded) | home, landing | `<Testimonials>` |
| `join-community.ejs` | 28 | none | home, landing | `<NewsletterCta>` — **its form has no action or handler today** |
| `order-search.ejs` | 227 | none | orders | `<OrderSearch>` |
| `checkout-coupons-modal.ejs` | 259 | none (fetches client-side) | checkout | `<AvailableCouponsDialog>` |
| `utils/coupon-card.ejs` | 79 | `coupon`, `context?`, `currentTotal?`, `clickable?`, `showApplyButton?` | **admin** coupons only | `<CouponCard>` |

### Dead — do not port (635 lines)

| Partial | Lines | Why |
|---|---:|---|
| `header.ejs` | **0** | empty file, included nowhere |
| `coupon-card.ejs` | 402 | a second coupon card, same prop contract, different markup. Unreferenced — probably written for the missing `/coupons` page |
| `order-card.ejs` | 139 | unreferenced; `orders.ejs` renders its own markup |
| `new-banner.ejs` | 56 | unreferenced countdown promo; also has a `setInterval` with no cleanup |
| `pagination.ejs` | 38 | unreferenced (admin has its own) |

### Not a UI partial

`otp-email.ejs` (226 lines) is a **transactional email template**, read with `fs` by
[send-otp.util.ts](../../backend/common/utils/send-otp.util.ts). It stays on the backend.

### Notable duplication

- **Three coupon card implementations**: `utils/coupon-card.ejs` (live, admin-only, styled by
  `/css/components/coupon-card.css`), `user/partials/coupon-card.ejs` (402 lines, dead), and a
  third rendered in JS inside `checkout.js`. Build one `<CouponCard>`.
- **`profile-card` only ever renders inside `profile-sidebar`** — 285 lines of CSS between
  them, duplicated into every account page render. One component.
- **`addresses.ejs` is included by two pages** and carries the whole address CRUD flow — 11
  fields with pre-rendered error divs, a state/district cascade, and Geoapify autocomplete.

---

## 3. Navigation

### Storefront

There is no separate header partial — everything is in `navbar.ejs`.

| # | Label | Route | Active state |
|---|---|---|---|
| 1 | Home | `/` | `active === 'home'` |
| 2 | Shop | `/shop` | `active === 'shop'` |
| 3 | About | `/about` | **never highlights** |
| 4 | Help | `/help` | **never highlights** |

Brand logo links to `/`. Mobile is a plain Bootstrap `navbar-expand-lg` collapse — **there is
no offcanvas**; the same DOM reflows.

**Search.** `<form method="GET" action="/shop">` with a 300ms-debounced typeahead against
`GET /api/search-suggestions?q=`. The response carries product **names only** — no images or
prices. Full keyboard navigation (arrows, Enter, Escape), click-outside close, and three
dropdown states: loading, results, empty. → `<SearchTypeahead>`.

**Signed in:** wishlist icon (no badge, no count), cart icon with `#cartCount` badge, and a
profile dropdown showing the user's name with Profile and Logout.

**Signed out:** Login and Sign Up buttons.

**Cart badge.** `GET /cart/count` → `{ count }`. Hidden at zero. Refreshed on mount, on
`visibilitychange`, and by a **30-second `setInterval` that is never cleared**. Exposes
`window.updateNavbarCartCount` and `window.fetchCartCount`, which four other scripts call.

→ RTK Query `useGetCartCountQuery` with `pollingInterval: 30000` and `refetchOnFocus: true`,
and mutations that invalidate the tag instead of calling a global.

**Two quirks worth not porting:** the profile link is `href="#"` with an inline
`console.log('Profile clicked')` debug handler, and logout branches on the non-existent
`window.PageTransition`.

### Footer

| Column | Links |
|---|---|
| Brand | logo → `/`, tagline, social icons (all `href="#"`) |
| Shop | New Arrivals → `/shop`, Bestsellers → `/shop`, Sneakers → `/categories`, Limited Editions → `/categories` |
| About | Our Story → `/about`, Culture → `/about`, Events → `/contact`, Careers → `/contact` |
| Customer Service | Contact → `/contact`, FAQs → `/faq`, Shipping & Returns → `/returns`, Payment & Policies → `/terms` |
| Bottom | Privacy Policy → `/privacy`, Terms of Service → `/terms`, Cookie Policy → `/cookies` |

> **11 of the 15 footer links 404.** `/categories`, `/contact`, `/faq`, `/returns`, `/terms`,
> `/privacy` and `/cookies` are not mounted in `app.ts`. Decide per link: build the page,
> point it somewhere real, or remove it. Do not port them as-is.

### Admin

See [pages-admin.md](pages-admin.md#sidebar--the-admin-route-map) — nine items, and the
agreed modernization.

---

## 4. Shared client scripts

Only **nine local script files are ever referenced** across all 78 views (verified by
grepping every `src="/js/..."` and `src="/utils/..."` tag), and one of those references is
inside a malformed comment.

| File | Lines | What it is | React target |
|---|---:|---|---|
| [validation.js](../../../public/js/validation.js) | 475 | `class FormValidator(formId, options)`. Rules keyed by lowercased field name: name, brand, productName, features, phone (`/^[6-9]\d{9}$/`), email (regex **plus** a hardcoded TLD allowlist), password (6+ chars), confirmPassword, price/stock/offer numerics, description. Renders `.field-error` after each input and a `.general-error` alert at the top | **Zod schemas** + `react-hook-form`. One schema per form, not one class keyed on field names |
| [imageValidation.js](../../../public/utils/imageValidation.js) | 219 | Extension + MIME + size validation. 7 allowed types, **20MB max**. Also `validateBase64Image` for the crop pipeline. Already dual-exports for Node | Move to `lib/imageValidation.ts` and **share it with the backend** — it is already isomorphic |
| [cart.js](../../../public/js/user/cart.js) | 1,282 | The entire cart page | `features/cart/` |
| [checkout.js](../../../public/js/user/checkout.js) | 2,053 | The entire checkout flow — addresses, coupons, all payment paths | `features/checkout/` |
| [wishlist.js](../../../public/js/user/wishlist.js) | 261 | Wishlist add/remove, loaded globally | `features/wishlist/` |
| [orders-common.js](../../../public/js/user/orders-common.js) | 326 | Cancel/return order and item, invoice download, with SweetAlert reason pickers | `useOrderActions()` + `<ReasonPickerDialog>` |
| [stateDistrictData.js](../../../public/js/user/stateDistrictData.js) | 147 | All Indian states and UTs with ~700 districts — **~40KB of literal data shipped to the browser** | **Do not bundle.** `GET /api/states-districts` already serves it → `useGetStatesDistrictsQuery` with a long cache |
| [utils/pagination.js](../../../public/js/utils/pagination.js) | 36 | `window.renderPagination(...)` — renders **every** page number, no windowing | delete |
| [product-details-debug.js](../../../public/js/product-details-debug.js) | 87 | a cart-fix monkey-patch reporting via `alert()` | delete |

**Never loaded by anything** — `public/js/user/pagination.js` (168) and
`public/js/admin/pagination.js` (168, byte-identical to it),
`public/js/admin/image-cropper.js` (329), `public/js/product-details-fix.js` (117), and two
zero-byte files (`public/js/user/shop.js`, `public/js/admin/add-product.js`).

---

## 5. Cross-cutting patterns

### 5.1 Toasts and dialogs — three libraries, actively conflicting

| Library | Loaded by | Call sites |
|---|---|---:|
| **SweetAlert2 v11** | all four layouts (admin loads it **twice**) | **262** |
| **Toastr** (+ jQuery) | `user-layout` only | 35 |
| **Toastify-js** | `admin/layout` only | **0 — loaded on every admin page, never called** |
| Bootstrap Toast | — | 3 (admin orders, returns, order-details) |

Worst offenders: `product-details.ejs` uses SweetAlert (20) **and** Toastr (12) for the same
class of feedback; `checkout.js` mixes 30 SweetAlert calls with 3 Toastr calls in one file;
`admin/order-details.ejs` has 23 SweetAlert calls. Toastr is unavailable on auth pages
because `auth-layout` does not load it. Admin has no working toast at all despite shipping
Toastify.

The 262 SweetAlert calls are really three distinct patterns:

| Pattern | Roughly | React target |
|---|---:|---|
| Transient feedback ("Added to cart") | ~120 | `useToast()` — one library, `sonner` or `react-hot-toast` |
| Confirmation ("Are you sure?") | ~120 | `useConfirm(): Promise<boolean>` + `<ConfirmDialog>` |
| Blocking loader (`didOpen: () => Swal.showLoading()`) | ~20 | `<LoadingOverlay>` or per-button pending state |

Plus the reason pickers (`input: 'select'` with an `inputValidator`) in `orders-common.js`,
which become `<ReasonPickerDialog>`.

### 5.2 Modals — 45 instantiations, 24 distinct ids

| Domain | Ids | Consolidate to |
|---|---|---|
| Image cropping | `cropModal` ×3, `cropperModal` ×2 | **one `<ImageCropperDialog>`** |
| Address | `addressModal` ×2 (checkout + address-book, duplicated markup) | `<AddressFormDialog>` |
| Order status (admin) | `statusModal`, `updateStatusModal`, `orderActionModal` | `<OrderStatusDialog>` |
| Returns (admin) | `approveReturnModal`, `rejectReturnModal`, `returnItemModal` | `<ReturnDecisionDialog>` |
| Catalog (admin) | `addBrandModal`, `editBrandModal`, `addCategoryModal`, `editCategoryModal` | `<ResourceFormDialog mode>` |
| Coupons | `couponModal` (admin), `availableCouponsModal` (checkout) | `<CouponFormDialog>`, `<AvailableCouponsDialog>` |
| Profile / auth | `emailVerificationModal`, `newEmailModal`, `otpVerificationModal`, `photoOptionsModal` | |
| Reviews | `writeReviewModal`, `reviewImageModal` | |
| Misc | `imageViewModal`, `shareModal`, `addMoneyModal` | |

Highest concentrations: `profile.ejs` (7), `checkout.js` (5), and four admin pages at 4 each.

→ One headless `<Modal>` primitive (Radix Dialog) with focus trapping and Escape handling,
then the consolidated dialogs above.

### 5.3 Pagination — three implementations, none of them shared

| Implementation | Lines | Where | Loaded? |
|---|---:|---|---|
| `public/js/utils/pagination.js` | 36 | admin layout | yes, admin only |
| `public/js/user/pagination.js` | 168 | — | **never** |
| `public/js/admin/pagination.js` | 168 | — | **never** (byte-identical to the above) |
| `admin/partials/pagination.ejs` | 103 | 3 admin pages | yes |
| `user/partials/pagination.ejs` | 38 | — | **never** |

So on the storefront, **every paginated page reimplements pagination inline**. Only the
unused EJS partial does page windowing; the loaded JS renders every page number, so a
1,000-page result would emit 1,000 buttons.

→ One `<Pagination currentPage totalPages onPageChange />` with windowing, plus a
`usePagination` hook or the RTK Query page param. Server responses already carry
`currentPage`, `totalPages`, `hasPrevPage`, `hasNextPage`, `prevPage`, `nextPage` and
sometimes `pageNumbers` — build against that shape.

### 5.4 Formatting — no helpers exist at all

There is **no `formatCurrency`, `formatPrice` or `formatDate` anywhere in the codebase**.
Instead:

- **65 inline `toLocaleString` calls** — heaviest in `admin/sales-report` (12),
  `admin/dashboard` (11), `user/order-details` (9).
- **Currency is rendered three ways**: `₹<%= Math.round(avgPrice) %>` (product-card, no
  separators), `₹<%= item.totalPrice.toLocaleString('en-IN') %>` (order-card),
  `₹<%= Math.round(item.price) %>` (cart-item-card). **`Intl.NumberFormat` with
  `style: 'currency'` appears nowhere.**
- **Dates use three different locale/format combinations for the same "valid till" concept** —
  `en-IN` with `month:'short'`, `en-GB` with `month:'short'`, and `en-IN` with `day:'2-digit'`.
- The sales report pre-formats dates and money into strings **server-side**, so that page's
  data arrives already stringified.

→ `lib/format.ts`: `formatINR(n)`, `formatDate(d, style)`, `formatDateTime(d)`. Use them
everywhere, and return raw numbers and ISO dates from any new endpoint.

### 5.5 Pricing — duplicated in templates

`product-card.ejs` recomputes the effective offer as
`max(categoryOffer, brandOffer, productOffer, variantOffer)` and derives the discount
percentage in EJS. `cart-item-card.ejs` computes its discount percentage separately.
`shop.ejs` does its own price math client-side after every filter change.

→ `lib/pricing.ts`: `effectiveOffer()`, `finalPrice()`, `discountPercent()` — mirroring the
server logic once, used for **display only**. Prices are computed per request server-side and
are authoritative; never cache one client-side and assume it holds.

### 5.6 Form validation — three coexisting approaches

1. The 475-line `FormValidator` class, loaded on 6 pages.
2. **Hand-rolled per-page validators** — `admin/login.ejs` defines its own `showFieldError`
   and email/password checks *while also loading* `validation.js`, duplicating the same TLD
   allowlist.
3. **Pre-rendered static error divs** — `addresses.ejs` ships 11 `<div class="error-message">`
   elements with hardcoded copy, toggled by page JS.

**The rules contradict each other:** `FormValidator` requires a name of 2+ characters;
`addresses.ejs` says 4+. Server-side validation lives separately in the controllers, so the
error copy exists in two layers and can drift.

→ Zod schemas in `lib/schemas/`, one per form, shared with `react-hook-form`. Where a schema
can be shared with the backend's `express-validator` rules, do it.

### 5.7 Loading, empty and error states — five idioms, no skeletons

- **Loading:** Bootstrap `spinner-border` in 17 views (28 occurrences); a *blocking
  SweetAlert modal* in `orders-common.js` / `checkout.js` / `cart.js`; a spinning
  `bi-arrow-clockwise` swapped into buttons by `pagination.js`; a bespoke shimmer for the
  wallet balance in `checkout.css`; plus per-page `showLoadingState()` functions in admin.
- **Skeletons: zero.** No `skeleton`, `placeholder-glow` or `placeholder-wave` anywhere.
- **Empty states:** an `.empty-state` class redefined independently in `admin/coupons`,
  `admin/orders`, `admin/returns`, `user/address-book` and `user/wishlist`, plus `#no-results`,
  `#no-coupons-found`, `.search-no-results` and `.no-brands-message`. The shape is consistent
  — a large muted `bi-inbox` icon, a heading, subtext — but the implementation never is.
- **Error states:** only `checkout-coupons-modal.ejs` has a real one, with a "Try Again"
  button. It is the reference implementation.

→ One `<QueryBoundary loading empty error>` wrapping RTK Query state, plus skeleton variants.
This is a genuine UX improvement, not just consolidation.

### 5.8 Image upload and cropping — two parallel flows

| Flow | Where | Implementation |
|---|---|---|
| Product images (3–6, bulk) | admin add/edit-product | `ImageCropperManager` in `public/js/admin/image-cropper.js`… **except that file is never loaded**; the pages inline their own copy |
| Brand/category logos | admin brands/categories | `#cropperModal` with page-local handlers, Cropper **1.6.1** loaded on top of the layout's 1.5.13 |
| Profile avatar | user profile / edit-profile | `#photoOptionsModal` + `#cropModal` with their own crop code; uploads land at `/uploads/profiles/` |

All three share the same contract: validate (extension + MIME + ≤20MB) → crop → base64 →
POST. → `<ImageUploader accept maxSize aspect multiple>` + `useImageCropQueue()` for the
sequential bulk case, built on `react-cropper` or `react-easy-crop`.

### 5.9 Flash messages — written 8 times, rendered once

`connect-flash` is registered at [app.ts:73](../../backend/app.ts#L73) and **written in 8
places**: the blocked-user middleware, the admin guard, admin auth (×4, including a
`formData` re-fill channel), the coupon controller (×2), and the orders, wallet and profile
route guards.

It is **rendered in exactly one template** — `admin/login.ejs`. There is no flash partial and
no layout-level flash rendering; `user-layout` never touches `req.flash`. The `.alert`
styling in `user.css` under "FLASH MESSAGES" is effectively dead.

**So every other flash is silently dropped.** A blocked user is redirected with no
explanation. "Please log in to continue" never appears. Coupon and wallet errors vanish. This
is a live bug in production today, not just a migration concern.

→ Return `{ message, type }` in the response body; render through the single `<Toaster>`. For
redirect cases, carry it in router state:
`navigate('/login', { state: { toast: { type: 'error', message: '…' } } })`.

---

## 6. Component build list

Everything above, as a checklist. Build these in step 1 of the conversion order, before any
page work — they are what stop the current duplication from being recreated in React.

**Primitives**

- `<Button>` — variants, loading state
- `<Modal>` — Radix Dialog base, focus trap, Escape
- `<Badge variant tone size>` — replaces all 5 badge class families; see [design-tokens.md](design-tokens.md)
- `<Pagination>` + `usePagination`
- `<QueryBoundary loading empty error>` + skeletons
- `<Toaster>` + `useToast()`
- `<ConfirmDialog>` + `useConfirm()`
- `<LoadingOverlay>`
- Form fields: `<TextField>`, `<SelectField>`, `<PasswordField>` (strength meter + visibility toggle), `<OtpInput>` (3 current copies), `<ImageUploader>` + `<ImageCropperDialog>`

**Data / logic**

- `lib/format.ts` — `formatINR`, `formatDate`, `formatDateTime`
- `lib/pricing.ts` — `effectiveOffer`, `finalPrice`, `discountPercent`
- `lib/imageValidation.ts` — ported from `public/utils/imageValidation.js`, shared with the backend
- `lib/schemas/` — Zod schemas replacing `FormValidator`
- `useOrderActions()`, `useRazorpay()`, `useImageCropQueue()`

**Layout**

- `<StorefrontLayout>` — navbar, search typeahead, cart badge, profile menu, footer
- `<AuthLayout>` — the auth card shell
- `<AdminLayout>` — modernized shell per [pages-admin.md](pages-admin.md)
- `<AccountSidebar>` — merges `profile-sidebar` + `profile-card`
- `<Breadcrumbs>` — derived from the route tree

**Domain**

- `<ProductCard>`, `<ProductGallery>`, `<VariantSelector>`
- `<CartLineItem>`, `<AddressFormDialog>`, `<CouponCard>`, `<AvailableCouponsDialog>`
- `<OrderStatusBadge>`, `<ReasonPickerDialog>`, `<OrderStatusDialog>` (admin)
- `<FilterBar>` — port the contract from `admin/partials/filters-bar.ejs`, then use it on all seven list pages
- `<ResourceListPage>` — the generic admin CRUD page, configured four times
