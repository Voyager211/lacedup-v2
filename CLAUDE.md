# LacedUp Co.

Sneaker storefront + admin panel. Monorepo with two npm packages:

- `backend/` — Express 5 + TypeScript API, modular monolith (`src/modules/<domain>`), MongoDB via Mongoose. Deployed to **Render** from `main` ([render.yaml](render.yaml)).
- `frontend/` — Vite + React 19 SPA (storefront and admin), RTK Query, Tailwind 4. Deployed to **Vercel**, which forwards `/api`, `/uploads`, `/images` and `/google` to Render so the auth cookies stay on one domain.

Read [README.md](README.md) and [frontend/README.md](frontend/README.md) before touching an area you haven't worked in. Known inherited defects are in [frontend/docs/defects.md](frontend/docs/defects.md).

**Planned architecture (the roadmap below):** Express stays as the single API. A React Native app is expected in the future, so the API must stay usable by any client. Postgres + Prisma replace MongoDB. Only the **public storefront** moves to Next.js; the admin panel stays on Vite.

---

## Ground rules

These override default behaviour. Only the user can suspend one, and only by saying so explicitly.

### 1. Two branches only: `main` and `develop`

- `main` is production. Render deploys from it. Never commit directly to `main`.
- All work happens on `develop`.
- Never create other branches: no feature branches, no worktree branches, no temporary branches.
- Merge `develop` into `main` only when the user asks.

### 2. Commit and push after every piece of work

- When a task (one checkbox below) is done and its tests pass, commit and push to `origin develop`.
- Use short conventional commit messages: `type(scope): summary`, lowercase, imperative, under ~72 characters, and no body unless it's genuinely needed.
  - Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `build`, `ci`, `perf`.
  - Examples: `fix(checkout): keep cart on razorpay dismissal`, `test(cart): cover clear-on-success rule`, `docs(claude): tick phase 1 tasks`.
- The author is the user's git identity (Mohammed Al Fahad) and nobody else. **Never add `Co-Authored-By` trailers, "Generated with Claude", or any mention of Claude/AI** in commits, PR descriptions or code comments.
- Stage specific files. Never commit `.env`, `Bugs.md`, `MIGRATION-PLAN.md`, the project PDF or anything else that's gitignored or personal.
- Update the checkboxes in this file in the same commit as the work they track.

### 3. Tests are part of every task

The goal is to catch bugs before they reach production.

| Kind | Tool | Where |
|---|---|---|
| Backend unit + integration | Vitest + supertest + in-memory DB | `backend/src/**/__tests__/*.test.ts` |
| Frontend unit + component | Vitest + Testing Library + MSW | `frontend/src/**/*.test.tsx` |
| End-to-end | Playwright | `e2e/` (set up in Phase 0) |

- Write tests for every feature, fix and endpoint. For a bug fix, **write a failing test that reproduces it first**, then fix it.
- Run the affected suite after each section, and run the full backend + frontend suites before every push.
- Run the Playwright suite before any merge to `main`, and after changes to checkout, payments, auth or cart.
- Never push with failing tests. If a failure isn't related to the change, report it to the user; don't skip or delete the test.
- Tests never touch the production database.

### 4. Seed the database after each module

- When a module is complete, add or extend its seed data so real data from the database shows up on the frontend and in the API docs.
- Build seed data from the actual data shapes: models/Prisma schema, DTOs, Zod schemas and the response objects the frontend reads. Seeded records must render correctly on the pages that use them.
- Use `@faker-js/faker` with a fixed seed so the data is repeatable.
- Seeders must be idempotent (safe to run repeatedly) and must **refuse to run when `NODE_ENV=production` or when the connection string points at the production database**.
- Seed referentially consistent data: orders reference real users, products and addresses; wallet balances match their transactions.

### 5. Swagger docs as we go

- Every new or changed endpoint gets a `@swagger` JSDoc block in its `*.routes.ts` file in the same commit, covering the request body/params, every response code, and the security scheme.
- Shared shapes go in `components.schemas` in [backend/src/config/swagger.ts](backend/src/config/swagger.ts), referenced with `$ref`, not copied inline.
- Examples in the docs should match the seed data.
- Check the result at `http://localhost:3000/docs` before ticking the task.

---

## Commands

```bash
cd backend  && npm run dev        # API on :3000, docs on /docs
cd frontend && npm run dev        # SPA on :5173, proxies the API
npm test                          # in either package
npm run typecheck                 # in either package
npm run test:coverage             # in either package
```

---

## Roadmap

Check off tasks as they're done, in the same commit. Add new tasks and newly found bugs where they belong: bugs go under **Bugs found along the way** unless they block a phase.

### Phase 0 — Tooling the ground rules need

- [ ] Install Playwright, add `playwright.config.ts` and an `e2e/` folder, and wire up the `e2e` script
- [ ] Playwright setup that starts the backend and frontend against a dedicated test database
- [ ] First e2e smoke test: landing → shop → product page loads with real data
- [ ] Add `@faker-js/faker` and a seed runner (`npm run seed`, `npm run seed:reset`) with a guard against the production database
- [ ] Seed the existing modules: users + admin, categories, brands, products + variants, addresses, carts, wishlists, coupons, orders, returns, reviews, wallets + transactions, referrals
- [ ] Update the Swagger security scheme from the old `user.sid` session cookie to the JWT cookies
- [ ] Audit Swagger coverage: list undocumented endpoints and document them
- [ ] Confirm `/docs` works from a compiled build (`npm run build && npm start`), not just under `tsx`

### Phase 1 — Fix production bugs (checkout)

Business rules the API must enforce, so a future mobile app gets them without extra work:
- The cart is emptied **only** when an order succeeds or the user removes items.
- A failed or dismissed payment (Razorpay or wallet) keeps the cart and sends the user to the retry-payment page.
- A second failure marks both the payment and the order as failed and sends the user to the order failure page.

- [ ] Trace the checkout flow end to end and find where the cart is currently emptied
- [ ] **Address modal on checkout:** write a failing test, fix the payload the modal sends, and make sure a failed address save never empties the cart
- [ ] **Razorpay dismissal/failure:** write a failing test, keep the cart, and redirect to the retry-payment page
- [ ] **Wallet payment failure:** same behaviour as Razorpay
- [ ] **Second failure:** mark the payment and order as failed and redirect to the order failure page
- [ ] Integration tests covering every rule above (success, dismissal, failure, retry success, retry failure)
- [ ] Playwright e2e: add to cart → checkout → Razorpay dismissed → retry → success; and → second failure → failure page
- [ ] Update the Swagger docs for any checkout endpoints that changed
- [ ] Merge `develop` into `main` once the user approves

### Phase 1b — Available coupons at checkout

No standalone `/coupons` page. Checkout lists the coupons that apply to the cart, using the existing `GET /coupons/available`.

- [ ] coupons: guard `/coupons/available` with the JWT auth middleware, replacing the unused `requireAuth` that relies on the old session check + integration tests
- [ ] checkout: list available coupons in the summary with one-tap apply + component tests
- [ ] checkout: Playwright e2e for applying a coupon from the list
- [ ] Seed coupons that exercise the list (public, min order value, per-user limit, expired)
- [ ] frontend: remove the stale `/coupons` comment in [router.tsx](frontend/src/app/router.tsx#L52)

### Phase 2 — MongoDB → Postgres + Prisma

The API's requests and responses must not change. The existing test suite is the safety net.

- [ ] Choose a Postgres host (and connection pooling) and a local dev setup (Docker Compose)
- [ ] Add Prisma; set up `schema.prisma`, the migrations workflow and a generated client
- [ ] Design the relational schema for all 20 models, turning nested documents into tables (product variants, cart items, order items, wishlist items, wallet transactions)
- [ ] Decide on ID strategy and keep old Mongo IDs where they're stored outside the database (Razorpay receipts, customer-facing order numbers, image URLs)
- [ ] Test infrastructure: a Postgres test database (Testcontainers or a dedicated schema) to replace `mongodb-memory-server`
- [ ] Move modules one at a time, running their tests after each:
  - [ ] auth (users, pending signups, password reset, email change, refresh tokens)
  - [ ] catalog (categories, brands, products, variants)
  - [ ] addresses
  - [ ] cart
  - [ ] wishlist
  - [ ] coupons
  - [ ] wallet + transactions (use real DB transactions)
  - [ ] checkout + pending orders
  - [ ] orders
  - [ ] returns
  - [ ] reviews
  - [ ] referrals
  - [ ] content (newsletter subscribers)
  - [ ] reports (dashboard, sales report: rewrite the aggregations in SQL)
- [ ] Rewrite the seeders against Prisma (`prisma db seed`)
- [ ] Write a data migration script from Atlas to Postgres; rehearse it on a copy and check row counts and totals
- [ ] Remove Mongoose, `mongodb-memory-server` and the Mongo-specific config
- [ ] Update `render.yaml`, `.env.example` and the README for Postgres
- [ ] Full test suite and Playwright green; production cutover once the user approves

### Phase 3 — Banner module

Designed around the API so the mobile app can use the same endpoints.

- [ ] Data model: banner (image, mobile image, title, link, alt text, active flag, start/end dates) and placements (slot key, position/order)
- [ ] Define the slot keys (`home.hero`, `shop.top`, `category.<id>`, `brand.<id>`, …) in a shared constant
- [ ] Admin API: create, update, delete, reorder, activate/deactivate; image upload through Cloudinary
- [ ] Public API: `GET /api/banners?slot=` returning active, in-date banners in order
- [ ] Integration tests: scheduling window, ordering, inactive banners hidden, admin-only guards, upload validation
- [ ] Swagger docs for every banner endpoint
- [ ] Admin UI: banner list, create/edit form with image cropping, placement assignment, reordering
- [ ] Storefront: a `<BannerSlot slot="…">` component placed on the landing, shop, category and brand pages
- [ ] Frontend component tests
- [ ] Seed banners for every slot
- [ ] Playwright e2e: admin creates a banner → it appears in its slot on the storefront

### Phase 4 — Storefront to Next.js

Express stays as the API. The admin panel stays on Vite.

- [ ] Monorepo layout decision: `apps/storefront` (Next.js), `apps/admin` (Vite), a shared package for API types and common UI
- [ ] Split the admin panel out of the current SPA into its own Vite app; make sure it still builds, tests and deploys
- [ ] Set up the Next.js App Router app with Tailwind 4 and the existing design tokens
- [ ] Forward `/api`, `/uploads`, `/images` and `/google` to Express so cookies stay on one domain
- [ ] Server-render the public pages: landing, shop, product, category, brand, about, help, banners
- [ ] Keep logged-in pages client-rendered: cart, wishlist, checkout, orders, account, addresses, wallet, referrals
- [ ] Auth pages (login, signup, OTP, password reset, Google sign-in) working with the existing JWT cookies
- [ ] SEO: metadata, Open Graph, sitemap, robots.txt, product structured data
- [ ] Move Render off the free plan and run Vercel's functions in a region near Render's Singapore server
- [ ] Carry over the component tests; Playwright suite green against the Next.js storefront
- [ ] Vercel deployment for both apps; cutover once the user approves

### Future — React Native readiness (keep in mind during every phase)

- [ ] Accept `Authorization: Bearer` tokens alongside cookies (build it when the mobile app starts)
- API routes return JSON only, never redirects or HTML ([no-api-redirects.test.ts](backend/src/__tests__/no-api-redirects.test.ts) enforces this)
- Business rules (cart, payments, retries, stock) live on the server, never only in the web client

---

## Bugs found along the way

Add new entries here as `- [ ] area: description`. Move one into a phase if it blocks that phase.

- [ ] addresses: pagination is 2 per page ([address.controller.ts:470](backend/src/modules/addresses/address.controller.ts#L470))
- [ ] admin orders: status dropdown is empty with no explanation for `Partially Delivered` / `Partially Returned`, which have no entry in `getValidTransitions` ([order.service.ts:1516](backend/src/modules/orders/order.service.ts#L1516))
- [ ] returns: duplicate `processedDate`/`processedBy` vs `approvedAt`/`approvedBy` fields on the schema
- [ ] backend: `/test-email` route exposes `EMAIL_USER` and the length of `EMAIL_PASS` outside production

## Open decisions

- [x] `/coupons` page for users: dropped; available coupons are listed at checkout instead (Phase 1b)
- [x] Legal pages (privacy, terms, cookies) and footer social links: keep as they are, placeholders only, out of scope
