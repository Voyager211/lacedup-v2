# Admin Pages & Shell

The 14 admin pages, the shell they sit in, and the full admin API surface. Same format as
[pages-storefront.md](pages-storefront.md): route, guard, render locals, size, endpoints,
modals, libraries, client state.

---

## Scope

| | Files | Lines |
|---|---:|---:|
| Admin pages | 14 | 20,104 |
| Shell (`layout.ejs` + 7 partials) | 8 | 1,378 |
| **Total** | **22** | **21,482** |

| View | Lines | Script | Style | Markup |
|---|---:|---:|---:|---:|
| `order-details.ejs` | 2,320 | 1,373 | 466 | 481 |
| `orders.ejs` | 1,960 | 710 | 865 | 385 |
| `dashboard.ejs` | 1,873 | 851 | 748 | 274 |
| `brands.ejs` | 1,836 | 737 | 735 | 364 |
| `categories.ejs` | 1,765 | 704 | 704 | 357 |
| `coupons.ejs` | 1,680 | 913 | 583 | 184 |
| `edit-product.ejs` | 1,574 | 984 | 419 | 171 |
| `products.ejs` | 1,521 | 569 | 667 | 286 |
| `add-product.ejs` | 1,428 | 850 | 423 | 155 |
| `sales-report.ejs` | 1,221 | 292 | 577 | 352 |
| `returns.ejs` | 1,219 | 318 | 519 | 382 |
| `product-detail.ejs` | 907 | 116 | 510 | 281 |
| `users.ejs` | 571 | 239 | 243 | 89 |
| `login.ejs` | 229 | 139 | 48 | 42 |

---

## Auth & mounting

Every admin router is mounted twice — bare and under `/api`
([app.ts:182-191](../../backend/app.ts#L182)). Use `/api/admin/...` in React.

**Guard:** [is-admin.middleware.ts](../../backend/common/middlewares/is-admin.middleware.ts),
applied as `router.use(isAdmin)` at the top of every admin router except the auth one.
Requires `req.isAuthenticated() && req.session.role === 'admin'`; on failure it flashes and
redirects to `/admin/login`. The coupons router uniquely runs `requireAuth` *before*
`isAdmin`, so it returns JSON 401 to XHR clients instead of redirecting.

**Cookies:** [jwt-auth.middleware.ts](../../backend/common/middlewares/jwt-auth.middleware.ts)
picks the audience by path — anything under `/admin` or `/api/admin` uses `admin_at` /
`admin_rt`. The two audiences are independent, so one browser can hold an admin and a
shopper login simultaneously, and a shopper token will not satisfy an admin route.

**Login flow** (`GET`/`POST /admin/login`,
[admin-auth.controller.ts](../../backend/modules/auth/admin-auth.controller.ts)):
server-side form validation → flash + redirect on failure (with `formData` flashed back to
re-fill the form) → `passport.authenticate('local')` for the credential check →
rejects `user.role !== 'admin'` → `issueSession(res, user, 'admin')`. Logout
(`GET /admin/logout`) calls `endSession`, which revokes the refresh-token row and clears
both cookies. `POST /admin/auth/refresh` rotates.

Admin login is the **only** page using
[layouts/login-layout.ejs](../../backend/views/layouts/login-layout.ejs) (15 lines) — it is
not the admin shell and has no sidebar. It is also the **only place in the whole app that
renders a flash message**; see [defects.md](defects.md).

---

# The admin shell

## Current state

[admin/layout.ejs](../../backend/views/admin/layout.ejs) — 278 lines (192 script).

```
div#admin-main-content.d-flex
  ├── partials/sidebar        fixed left nav
  └── main.admin-content
        ├── partials/header   ← notification bell, nothing else
        ├── <%- body %>
        └── partials/footer   ← © year, 3 lines
div#notificationsDropdown     ← hard-coded in the layout, permanently empty
```

It reads exactly one local: `title`. Nothing marks the active nav item, and neither the
layout nor the header knows who is signed in.

### Sidebar — the admin route map

[admin/partials/sidebar.ejs](../../backend/views/admin/partials/sidebar.ejs), 21 lines.
Logo → `/admin/dashboard`, then nine text-only links, then a logout button pinned to the
bottom.

| # | Label | Route |
|---|---|---|
| 1 | Dashboard | `/admin/dashboard` |
| 2 | Products | `/admin/products` |
| 3 | Categories | `/admin/categories` |
| 4 | Brands | `/admin/brands` |
| 5 | Orders | `/admin/orders` |
| 6 | Returns | `/admin/returns` |
| 7 | Users | `/admin/users` |
| 8 | Coupons | `/admin/coupons` |
| 9 | Sales | `/admin/sales-report` |

Two more are commented out: `/admin/offers` and `/admin/settings`. Neither route exists.

**No icons on any item. No active-state logic. No nesting.** Add-product, edit-product,
product-detail and order-details have no sidebar entry — they are reached from their list
pages.

### Header

[admin/partials/header.ejs](../../backend/views/admin/partials/header.ejs) is 5 lines: a
right-aligned notification bell. No search, no profile menu, no admin name, no breadcrumb,
no logout. The bell opens a dropdown that says "No notifications yet" — there is no
notifications API and never has been.

## Target state (decided)

Keep the same nine routes and information architecture. Change the chrome:

- **Icons** on every nav item (Bootstrap Icons are already the app's set — see
  [design-tokens.md](design-tokens.md))
- **Active-route highlighting** driven by React Router's `NavLink`
- **An identity menu** in the header: admin name, avatar, logout — replacing the bare
  sidebar logout button
- **Drop the notification bell** and its empty dropdown; reinstate it only if a
  notifications feature is actually built
- Collapsible sidebar on narrow viewports — the current one is fixed-width with no mobile
  handling at all

Everything else about the shell — the fixed left nav, the scrollable content column, the
footer — carries over.

## Shell partials — reusable component candidates

### `breadcrumbs.ejs` (104 lines)

**Param:** `breadcrumbs: Array<{ label, url?, icon? }>`. Renders an `<ol.breadcrumb>` with
`>` separators, linking every item that has a `url` and is not last, marking the last one
`aria-current="page"`. Ships its own `<style>` block, duplicated into every page that
includes it.

Per-page payloads (all rooted at Dashboard except where noted):

| Page | Trail |
|---|---|
| dashboard | Dashboard → Overview |
| products | Dashboard → Products |
| product-detail | Dashboard → Products → *productName* |
| categories / brands / orders / returns / users | Dashboard → *section* |
| order-details | Dashboard → Orders → Order Details |
| sales-report | Dashboard → Sales Report |
| coupons | Dashboard → Coupons — uses a different root icon (`speedometer2` vs `house-door`) |

`add-product`, `edit-product` and `login` render no breadcrumbs. In React, derive the trail
from the route tree instead of passing it per page.

### `pagination.ejs` (103 lines)

**Params:** `currentPage`, `totalPages`. Renders nothing when `totalPages <= 1`. Emits Prev /
**every page number** (no windowing, no ellipsis) / Next as `data-page` anchors inside
`ul#pagination-container`. It does not navigate — the host page must delegate on
`.pagination-btn`.

Used by only three pages (orders, returns, users). Products, categories, brands, coupons and
sales-report each hand-roll their own pagination in JS. See
[components.md](components.md) for the full pagination situation.

### `filters-bar.ejs` (736 lines) — the model for `<FilterBar>`

The best-designed component in the codebase, and **exactly one page uses it**. Fully
parameterised search + filter + AJAX-refresh, with CSS namespaced by `formId` so two
instances can coexist on one page.

Config:

| Param | Default | Meaning |
|---|---|---|
| `searchPlaceholder` | `'Search...'` | |
| `searchLabel` | `'Search'` | |
| `filters` | `[]` | see below |
| `formId` | `'filterForm'` | also namespaces the CSS and the search input id |
| `filterValues` | `{}` | current values, for re-render |
| `apiEndpoint` | `'/admin/api/filtered'` | |
| `tableSelector` | `'.table tbody'` | |
| `updateTableCallback` | `'updateTable'` | looked up on `window` |
| `updateStatsCallback` | `'updateStats'` | looked up on `window` |

Each `filters[]` entry is `{ name, label, type: 'select' | 'daterange' | 'date', colSize = 2,
allOption = 'All', options: [{ value, label }] }`.

Behaviour: builds `URLSearchParams` from the page number plus search plus every non-empty
form field, fetches `${apiEndpoint}?${params}`, expects `{ success, data, message }`, then
calls `window[updateTableCallback](data)` and `window[updateStatsCallback](data)`. Guards
re-entry with `isLoading`, shows a loading state, toasts on error, and registers
`window.applyFilters` / `fetchCallback` / `paginationCallback`.

The React `<FilterBar>` keeps this contract but replaces the `window`-callback indirection
with props and the fetch with an RTK Query hook. **Then use it on all seven list pages**,
not one.

### `coupon-modal.ejs` (128 lines)

Static markup, no params — a Bootstrap modal `#couponModal` wrapping `#couponForm` with
fields `code` (maxlength 20, uppercased), `name`, `description`, `discountType`
(`percentage|fixed`), `discountValue` (prefix swaps `%`/`₹`), `maximumDiscountAmount` (shown
only for percentage), `minimumOrderValue`, `usageLimit`, `userLimit`, `validFrom` / `validTo`
(`datetime-local`), `isActive`. The coupons page mutates its title and button text for edit
mode. → `<CouponFormDialog mode="create" | "edit">`.

### `footer.ejs` (3 lines)

`© {year} LacedUp Co.` No params.

---

# Pages

## Dashboard — `/admin/dashboard`

| | |
|---|---|
| View | [admin/dashboard.ejs](../../backend/views/admin/dashboard.ejs) — 1,873 lines (851 script) |
| Route | `renderDashboard`, [dashboard.controller.ts:38](../../backend/modules/reports/dashboard.controller.ts) |
| Locals | `title`, `layout` — **that is all**; the page is 100% client-fetched |
| Libs | **Chart.js 4.4.0** — 3 chart instances (`#dynamicSalesChart`, `#revenueChart`); SweetAlert2 ×3. No modals |
| State | a single `period` selector (`weekly` \| `monthly` \| `yearly`) driving every request |

Endpoints, all taking `?period=`:

| Endpoint | Returns |
|---|---|
| `/admin/dashboard/api/stats` | headline counters |
| `/admin/dashboard/api/sales` | sales time series |
| `/admin/dashboard/api/revenue-distribution` | revenue split |
| `/admin/dashboard/api/best-selling-products?limit=10` | top products |
| `/admin/dashboard/api/best-selling-categories?limit=10` | top categories |
| `/admin/dashboard/api/best-selling-brands?limit=10` | top brands |
| `/admin/dashboard/api/best-selling-category` | single top category |
| `/admin/dashboard/ledger-report/export-pdf?…&download=true` | PDF blob, fetched via XHR → `<a download>` |

`/admin/dashboard/api/best-selling-brand` (singular) exists and is never called.

Server-side period windows ([dashboard.controller.ts:15](../../backend/modules/reports/dashboard.controller.ts)):
weekly = last 12 weeks, monthly = last 12 months, yearly = last 5 years.

Because the page carries no server data, it ports cleanly: eight RTK Query hooks keyed on
`period`, Chart.js → **Recharts**, and the PDF export becomes a normal download link.

## Login — `/admin/login`

| | |
|---|---|
| View | [admin/login.ejs](../../backend/views/admin/login.ejs) — 229 lines (139 script) |
| Route | `getLogin` / `postLogin`, [admin-auth.controller.ts:5](../../backend/modules/auth/admin-auth.controller.ts) · `nocache`, no `isAdmin` |
| Layout | `layouts/login-layout` — not the admin shell |
| Locals | `title`, `layout`, `message` (flash), `formData` (flash — re-fills the form after a failed post) |
| Client | a classic form post with `novalidate`, a password-visibility toggle, and `/js/validation.js`. **No fetch, no SweetAlert** |

This page defines its own `showFieldError` and email/password validators *while also loading*
`validation.js`, duplicating the same email TLD allowlist. In React it becomes a normal
controlled form posting to `POST /api/admin/login`.

## Products — `/admin/products`

| | |
|---|---|
| View | [admin/products.ejs](../../backend/views/admin/products.ejs) — 1,521 lines (569 script) |
| Route | `listProducts`, [product.controller.ts:13](../../backend/modules/catalog/product.controller.ts) |
| Locals | `products`, `categories`, `brands`, `currentPage`, `totalPages`, `totalRecords`, `searchQuery`, `title` |
| Libs | SweetAlert2 ×4. No modals |
| State | `currentFilters` = `q`, `category`, `brand` (multi-select, comma-joined → server `$in`), `minPrice`, `maxPrice`, `status`, `stock`, `sort`, `page`. Page size 10, server-fixed |

| Action | Endpoint |
|---|---|
| List / search / filter / sort / paginate | `GET /admin/products/api?q&category&brand&minPrice&maxPrice&status&stock&sort&page` |
| Toggle list/unlist | `PATCH /admin/products/api/:id/toggle` |
| Soft delete | `PATCH /admin/products/api/:id/delete` |
| Add / edit / detail (pages) | `GET /admin/products/add`, `/:id/edit`, `/:id` |

The server-rendered table body is discarded on first paint — the page immediately refetches
and rebuilds it from JSON. So the React version loses nothing by being client-fetched.

## Add product — `/admin/products/add`

| | |
|---|---|
| View | [admin/add-product.ejs](../../backend/views/admin/add-product.ejs) — 1,428 lines (850 script) |
| Route | `renderAddPage`, [product.controller.ts:172](../../backend/modules/catalog/product.controller.ts) |
| Locals | `title`, `categories`, `brands`, `message` (flash) |
| Submit | `POST /admin/products/api/add` — `multer().none()`, body carries `base64Images[]` |
| Live lookups | `GET /admin/brands/api/:id`, `GET /admin/categories/api/:id` — fetched on change to show the applicable offers |
| Modals | `#cropModal` |
| Libs | **Cropper.js**, SweetAlert2 ×4, `/js/validation.js`, `/utils/imageValidation.js` |

**Image pipeline:** minimum 3, maximum 6 images. Bulk file input → crop each in sequence →
base64 → submitted as form fields. The server re-validates with `validateBase64Image` and
rejects counts outside 3–6.

## Edit product — `/admin/products/:id/edit`

| | |
|---|---|
| View | [admin/edit-product.ejs](../../backend/views/admin/edit-product.ejs) — 1,574 lines (984 script) |
| Route | `renderEditPage`, [product.controller.ts](../../backend/modules/catalog/product.controller.ts) |
| Locals | `title`, `product`, `categories`, `brands`, `message` |
| Submit | `PATCH /admin/products/api/:id` |

The controller un-shifts the product's currently *inactive* category and brand back into the
dropdowns with an `isCurrentInactive` flag, so editing a product whose category was disabled
still shows the right selection. Reproduce that — otherwise the form silently reassigns.

Otherwise identical to add-product. **One `<ProductForm mode>` serves both**, which collapses
~2,400 lines of near-duplicate script.

## Product detail — `/admin/products/:id`

| | |
|---|---|
| View | [admin/product-detail.ejs](../../backend/views/admin/product-detail.ejs) — 907 lines (116 script / 510 style / 281 markup) |
| Route | `renderDetailPage`, [product.controller.ts:59](../../backend/modules/catalog/product.controller.ts) |
| Locals | `title`, `product` (variants carry calculated prices), `allImages` (`[mainImage, ...subImages]`), `activeOffers` (category + brand + product offers merged, sorted by value desc) |
| Client | **no fetch calls at all** — read-only. Bootstrap Carousel for the gallery, one SweetAlert toast helper |

## Categories — `/admin/categories`

| | |
|---|---|
| View | [admin/categories.ejs](../../backend/views/admin/categories.ejs) — 1,765 lines (704 script / 704 style) |
| Route | `listCategories`, [category.controller.ts](../../backend/modules/catalog/category.controller.ts) |
| Locals | `categories`, `currentPage`, `totalPages`, `totalRecords`, `searchQuery`, `statusFilter`, `title` |
| Modals | `#addCategoryModal`, `#editCategoryModal`, `#cropperModal` |
| Libs | **Cropper.js 1.6.1 loaded page-locally** — a different version from the 1.5.13 the layout already loaded; `/utils/imageValidation.js`; SweetAlert2 ×12 |
| State | `q`, `status` (`all|active|inactive`), `page`. Page size 10 |

## Brands — `/admin/brands`

Structurally the twin of Categories: 1,836 lines (737 script / 735 style), same modal set
(`#addBrandModal`, `#editBrandModal`, `#cropperModal`), same Cropper version clash,
SweetAlert2 ×12 plus 3 `Swal.mixin` toast presets. Locals are the same with `brands` in place
of `categories`.

## Coupons — `/admin/coupons`

| | |
|---|---|
| View | [admin/coupons.ejs](../../backend/views/admin/coupons.ejs) — 1,680 lines (913 script) |
| Route | `loadCouponPage`, [admin-coupon.controller.ts](../../backend/modules/coupons/admin-coupon.controller.ts) · guards `requireAuth` **then** `isAdmin` |
| Locals | `title`, `coupons`, `count`, `searchQuery`, `statusFilter`, `currentPage`, `totalPages`, `hasPrevPage`, `hasNextPage`, `prevPage`, `nextPage`, `pageNumbers` |
| Layout | card grid (`.coupons-grid`), not a table — each card includes [utils/coupon-card.ejs](../../backend/views/utils/coupon-card.ejs) plus an actions bar |
| Modals | the shared `partials/coupon-modal` |
| Libs | SweetAlert2 ×11 + 1 `Swal.mixin` |

Status filter adds an `expired` bucket server-side (`validTo < now`) on top of active/inactive.

> Its 500 branch renders `admin/error`, which **does not exist**. See [defects.md](defects.md).

## The four list pages share one shape

Products, categories, brands and coupons are the same page four times:

```
GET    /admin/{resource}/api?q&status&page     list
GET    /admin/{resource}/api/:id               read one
POST   /admin/{resource}/api/create            create
PUT    /admin/{resource}/api/:id               update
PATCH  /admin/{resource}/api/:id/toggle        activate / deactivate
DELETE /admin/{resource}/api/:id               soft delete
```

(Coupons deviates slightly: `GET /admin/coupons/:id`, `POST /admin/coupons/create`,
`PUT /admin/coupons/:id` sit outside the `/api` segment; toggle and delete follow the
pattern. Products uses `PATCH .../api/:id/delete` rather than `DELETE`.)

**Build one `<ResourceListPage>`** — filter bar, table or grid, pagination, create/edit
dialog, toggle and delete confirmations — and configure it four times. That is ~6,700 lines
of current script replaced by one component plus four config objects.

## Orders — `/admin/orders`

| | |
|---|---|
| View | [admin/orders.ejs](../../backend/views/admin/orders.ejs) — 1,960 lines (710 script / 865 style) |
| Route | `getAllOrders`, [admin-order.controller.ts](../../backend/modules/orders/admin-order.controller.ts) |
| Locals | `title`, `orders` (delivery address flattened from `addressId.address[addressIndex]`), `currentPage`, `totalPages`, `totalOrders`, `orderStats`, `todayOrders`, `totalItems`, `filters: { status, paymentMethod, paymentStatus, search, sortBy, sortOrder }`, `layout`, `orderStatuses`, `paymentStatuses`, `ORDER_STATUS`, `PAYMENT_STATUS` |
| API | `GET /admin/orders/api/filtered?…`, `GET /admin/orders/api/statistics` |
| Libs | Bootstrap Toast. **No SweetAlert2, no modals, no bulk selection** |

Filters are hand-rolled inline rather than using `filters-bar` — search, status, payment
method, payment status, `sortBy` (`createdAt|totalAmount|status`), `sortOrder`. Uses the
`pagination` partial for the server-rendered pass *and* a JS `updatePagination` for the AJAX
pass, so pagination markup exists twice.

## Order details — `/admin/orders/:orderId`

The largest page in the application.

| | |
|---|---|
| View | [admin/order-details.ejs](../../backend/views/admin/order-details.ejs) — 2,320 lines (1,373 script / 466 style / 481 markup) |
| Route | `getOrderDetails`, [admin-order.controller.ts](../../backend/modules/orders/admin-order.controller.ts) |
| Locals | `title`, `order` (with computed `comprehensiveStatusHistory`), `orderStatuses`, `paymentStatuses`, `cancellationReasons`, `returnReasons`, `ORDER_STATUS`, `PAYMENT_STATUS`, `validTransitions`, `getStatusColor` (**a function passed as a local**), `getPaymentStatusColor`, `layout` |
| Modals | `#statusModal`, `#updateStatusModal`, `#returnItemModal` |
| Libs | **SweetAlert2 ×23** — the highest in the app; Bootstrap Toast |

| Action | Endpoint |
|---|---|
| Update order status | `PATCH /admin/orders/:orderId` |
| Allowed transitions | `GET /admin/orders/:orderId/transitions` |
| Cancel order | `PATCH /admin/orders/:orderId/cancel` |
| Return order | `PATCH /admin/orders/:orderId/return` |
| Update item status | `PATCH /admin/orders/:orderId/items/:itemId/status` |
| Return item | `PATCH /admin/orders/:orderId/items/:itemId/return` |
| Cancel item | `PATCH /admin/orders/:orderId/items/:itemId/cancel` — live, but **commented out in the view** |
| Re-read as JSON | `GET /admin/orders/api/:orderId` |

The script is dominated by hand-written DOM synchronisation — `updateOrderStatusInUI`,
`updateItemStatusInUI`, `updatePaymentStatusInUI`, `updateModalDataAfterStatusChange`,
`updateButtonVisibility`, `fetchAndUpdateOrderStatus` and friends, plus client-side copies of
`getStatusColor` / `getPaymentStatusColor` that already arrive as locals. **Nearly all of
that disappears** under React: re-render from state, and let a mutation's cache invalidation
refresh the order.

Three overlapping status modals collapse into one `<OrderStatusDialog>`.

> **Empty-dropdown trap.** `getValidTransitions` has no entry for `Partially Delivered` or
> `Partially Returned`, so `/transitions` returns `[]` and the admin sees an empty status
> dropdown with no explanation. The order is *not* stuck — it progresses through item-level
> updates and the order status recomputes. Surface that in the UI: explain why, and point at
> the per-item actions.

> The view also still carries a `testReturnModal()` debug function.

## Returns — `/admin/returns`

| | |
|---|---|
| View | [admin/returns.ejs](../../backend/views/admin/returns.ejs) — 1,219 lines (318 script) |
| Route | `getAllReturns`, [admin-return.controller.ts](../../backend/modules/returns/admin-return.controller.ts) |
| Locals | `title`, `returns`, `currentPage`, `totalPages`, `totalReturns`, `pendingReturns`, `approvedReturns`, `totalRefundAmount`, `orderStatuses`, `returnStatuses`, `paymentStatuses`, `refundStatuses`, `returnReasons`, `ORDER_STATUS`, `RETURN_STATUS`, `PAYMENT_STATUS`, `filters: { status, refundStatus, search, dateRange, sortBy, sortOrder }`, `layout` |
| API | `GET /admin/returns/api/filtered?page&search&status&dateRange&sortBy&sortOrder`, `PATCH /admin/returns/:returnId/approve`, `PATCH /admin/returns/:returnId/reject` |
| Modals | `#approveReturnModal`, `#rejectReturnModal` |
| Libs | Bootstrap Modal / Toast / Dropdown. **No SweetAlert2** |

**The only page that uses `filters-bar`** — its instance is the reference implementation:
`formId: 'returnFilterForm'`, `apiEndpoint: '/admin/returns/api/filtered'`, callbacks
`updateReturnsTable` / `updateStatistics`, filters `status`, `dateRange`, `sortBy`,
`sortOrder`.

Live but unused by the UI: `GET /admin/returns/statistics`, `GET /admin/returns/export`,
`PATCH /admin/returns/orders/:orderId/approve`, `PATCH /admin/returns/orders/:orderId/reject`.

## Sales report — `/admin/sales-report`

| | |
|---|---|
| View | [admin/sales-report.ejs](../../backend/views/admin/sales-report.ejs) — 1,221 lines (292 script) |
| Route | `getSalesReport`, [sales-report.controller.ts:178](../../backend/modules/reports/sales-report.controller.ts) |
| Locals | `title`, `salesStats`, `dailyAnalysis`, `orders` (pre-formatted server-side: `_id`, `orderId`, `date` as an `en-IN` string, `customer`, `paymentMethod`, `status`, `amount`, `discount`, `finalAmount`), `filters: { timePeriod, paymentMethod, orderStatus, startDate, endDate }`, `pagination: { currentPage, totalPages, totalOrders, itemsPerPage, hasPrev, hasNext }`, `layout` |
| Exports | `GET /admin/sales-report/export-pdf?…` and `export-excel?…` — both `window.open`, generated server-side (`pdfkit` / `exceljs`). No client-side PDF or XLSX library |
| Client | native `<input type="date">` ×4. No date-picker library, no modals, no charts. Errors use `alert()` |

> ⚠️ **This page has no JSON endpoint.** Its "AJAX" refresh refetches its own HTML with an
> `X-Requested-With` header, parses the response with `DOMParser`, and swaps `.stats-section`,
> the analysis table, the order rows and the pagination into place — then `history.pushState`.
> **The controller has no `X-Requested-With` branch**, so it returns the full page, layout and
> all, every time.
>
> React needs a real endpoint here. This is the one admin page requiring a backend change, and
> it is why the sales report is scheduled last.

Note the server pre-formats dates and money into display strings. Return raw values from the
new endpoint and format in the client — see the formatting section of
[components.md](components.md).

## Users — `/admin/users`

| | |
|---|---|
| View | [admin/users.ejs](../../backend/views/admin/users.ejs) — 571 lines (239 script) |
| Route | `listUsers`, [admin-user.controller.ts:45](../../backend/modules/users/admin-user.controller.ts) |
| Locals | `users`, `currentPage`, `totalPages`, `searchQuery`, `statusFilter`, `totalUserCount`, `title` |
| API | `GET /admin/users/api?q&status&page` (`status` ∈ `all|blocked|unblocked`), `PATCH /admin/users/:id/block`, `PATCH /admin/users/:id/unblock` |
| Libs | SweetAlert2 ×4 |

**Block/unblock only** — no create, edit or delete. Server search covers name, email and
phone, and hard-filters `role: 'user'`.

Blocking is enforced at JWT verification time, not just at login, and revokes every
outstanding refresh token — so a blocked user stops working immediately rather than when
their access token expires.

The page includes the `pagination` partial *and* re-renders an identical pagination block in
JS, and throws away the server-rendered table body on first paint.

---

# Admin API surface

Every path below also exists prefixed with `/api`. All are behind `isAdmin`.

**Auth** — `POST /admin/login` (302), `POST /admin/auth/refresh`, `GET /admin/logout` (302).

**Users** — `GET /admin/users/api` · `PATCH /admin/users/:id/block` · `PATCH /admin/users/:id/unblock`.

**Categories** — `GET /admin/categories/api` · `GET /admin/categories/api/:id` ·
`POST /admin/categories/api/create` · `PUT /admin/categories/api/:id` ·
`PATCH /admin/categories/api/:id/toggle` · `DELETE /admin/categories/api/:id`.

**Brands** — identical shape under `/admin/brands/api`.

**Products** — `GET /admin/products/api` · `POST /admin/products/api/add` ·
`PATCH /admin/products/api/:id` · `PATCH /admin/products/api/:id/delete` ·
`PATCH /admin/products/api/:id/toggle`.

**Orders** — `GET /admin/orders/api/filtered` · `GET /admin/orders/api/statistics` ·
`GET /admin/orders/api/:orderId` · `PATCH /admin/orders/:orderId` ·
`GET /admin/orders/:orderId/transitions` · `PATCH /admin/orders/:orderId/cancel` ·
`PATCH /admin/orders/:orderId/return` · `PATCH /admin/orders/:orderId/items/:itemId/status` ·
`PATCH /admin/orders/:orderId/items/:itemId/cancel` ·
`PATCH /admin/orders/:orderId/items/:itemId/return`.
Plus three broken entries — see [defects.md](defects.md).

**Returns** — `GET /admin/returns/statistics` · `GET /admin/returns/export` ·
`GET /admin/returns/api/filtered` · `PATCH /admin/returns/:returnId/approve` ·
`PATCH /admin/returns/:returnId/reject` · `PATCH /admin/returns/orders/:orderId/approve` ·
`PATCH /admin/returns/orders/:orderId/reject`.

**Coupons** — `GET /admin/coupons/api` · `PATCH /admin/coupons/api/:id/toggle` ·
`DELETE /admin/coupons/api/:id` · `GET /admin/coupons/:id` · `POST /admin/coupons/create` ·
`PUT /admin/coupons/:id`.

**Dashboard** — the eight `/admin/dashboard/api/*` endpoints listed above, plus
`GET /admin/dashboard/ledger-report/export-pdf`.

**Sales report** — `GET /admin/sales-report/export-pdf` and `export-excel` only. **No JSON
endpoint for the report itself.**

Request and response shapes are in the OpenAPI spec at `/docs`.
