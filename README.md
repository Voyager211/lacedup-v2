# LacedUp Co.

A sneaker store: a React storefront, an admin panel behind the same routes, and an
Express/MongoDB JSON API serving both. One origin in production — Express answers `/api`
and serves the compiled React app for everything else.

```
backend/     Express 5 + TypeScript + Mongoose — the API, the uploads, the OpenAPI docs
frontend/    Vite + React 19 + TypeScript + Tailwind — the storefront and the admin panel
```

Those two directories are the whole repo. Each is a self-contained npm package with its own
`package.json`, `node_modules`, tsconfig and test suite; nothing is hoisted to the root and
there is no workspace tying them together, so they install, build and test independently.

---

## Running it

You need Node (developed on 24) and a MongoDB you can reach — a local `mongod` or an Atlas
connection string.

```bash
# once
cd backend  && npm install && cp .env.example .env   # then fill in .env
cd frontend && npm install

# two terminals
cd backend  && npm run dev    # API on :3000
cd frontend && npm run dev    # SPA on :5173
```

Open **http://localhost:5173**, not :3000. In development Vite serves the app and proxies
`/api`, `/uploads`, `/images` and `/google` to Express, so the browser still sees a single
origin — which matters because auth rides in httpOnly cookies, and a genuinely cross-origin
setup would need CORS plus `SameSite=None` on every one of them.

At minimum `.env` needs `MONGODB_URI` and `JWT_SECRET`; the app refuses to issue a login
without the latter. Google sign-in, Razorpay, PayPal and Geoapify address autocomplete each
stay dormant until their keys are filled in. Email needs nothing: with `EMAIL_USER` and
`EMAIL_PASS` unset — or `MOCK_EMAIL=true` regardless — OTPs are printed to the server console
instead of being sent, which is enough to sign up and reset a password locally. Add
`MOCK_EMAIL_LOG=true` to also append them to `backend/logs/mock-emails.log`. Every key is
documented inline in [backend/.env.example](backend/.env.example).

### Scripts

Same names on both sides, run from inside that package:

| | `backend/` | `frontend/` |
|---|---|---|
| `npm run dev` | `tsx watch` on :3000 | Vite on :5173, proxying the API |
| `npm run build` | `tsc` → `backend/dist`, plus the EJS email template `tsc` will not copy | typecheck, then production build → `frontend/dist` |
| `npm start` | runs the compiled server | — |
| `npm run typecheck` | `tsc --noEmit` | `tsc --noEmit` |
| `npm test` | Vitest + an in-memory MongoDB | Vitest + Testing Library + jsdom |
| `npm run test:coverage` | v8 coverage | v8 coverage |

For a production run, build the frontend first: the server looks for `frontend/dist` on every
request and serves it if it is there, so `npm start` in `backend/` on its own gives you the
API and nothing to look at.

---

## How the two halves meet

**Everything the API answers is under `/api`, and each endpoint answers on exactly one URL.**
Anything else falls through to the React app so client-side deep links survive a refresh —
except `/api`, `/docs`, `/uploads`, `/images` and `/google`, which 404 as themselves rather
than returning a page of HTML to a mistyped fetch.

**Guards answer JSON, never a redirect.** Signed out is 401, signed in without the right
audience is 403, and the SPA decides where to send the visitor.

**Live API docs at http://localhost:3000/docs**, raw OpenAPI at `/docs.json`. The spec is
built at startup from `@swagger` JSDoc blocks in the route files. Read it before guessing a
payload shape.

### Auth

JWT in httpOnly cookies. Nothing is readable from JavaScript, so there is no token to store,
attach or refresh by hand — `withCredentials: true` and the browser does the rest.

| | Shopper | Admin |
|---|---|---|
| Access / refresh cookie | `user_at` / `user_rt` | `admin_at` / `admin_rt` |
| Access lifetime | 20 min | 60 min |
| Refresh endpoint | `POST /api/auth/refresh` | `POST /api/admin/auth/refresh` |

Refresh lasts 7 days and rotates single-use — presenting it revokes it. On a 401, refresh
once and retry; if that 401s too, go to login. Do not retry in a loop. The two audiences are
independent, so one browser can hold an admin and a shopper login at the same time and
neither token satisfies the other's routes. A blocked user is rejected at verification time
rather than only at login: the block takes effect on the next request and revokes every
outstanding refresh token.

---

## Backend

A modular monolith. Sixteen modules under [backend/src/modules/](backend/src/modules/) — auth,
users, catalog, cart, wishlist, coupons, checkout, orders, returns, payments, wallet,
referrals, reviews, addresses, reports, content — each owning its own routes, controller,
Mongoose models and types. Cross-cutting pieces live in
[common/](backend/src/common/) (middlewares, utils, the order constants, test helpers) and
[config/](backend/src/config/) (env, db, swagger, paths).

> **The one thing to check before adding a route.** Some routers mount under `/api` and
> declare bare paths; others mount at the root and declare `/api/...` internally, because
> mounting those under `/api` too would produce `/api/api/*`. Look at which kind you are
> editing — getting this wrong is the most repeated bug in this codebase.

[config/paths.ts](backend/src/config/paths.ts) is the single source of truth for every
filesystem location, all resolved from `__dirname` rather than `process.cwd()` so the server
behaves the same whichever directory it is started from. It names three anchors: the source
tree (`BACKEND_SRC`, which is `backend/src` under `tsx` and `backend/dist` after a build), the
package (`BACKEND_ROOT`, which owns `public/` and `logs/`), and the repo (`PROJECT_ROOT`,
which only locates `frontend/dist`).

Uploads are the reason that distinction matters. `backend/public/uploads/` holds
runtime-generated files whose URLs are stored in the database, so it is data rather than
source: it sits beside the source tree, never inside it, and a rebuild of `dist/` must not be
able to touch it.

### Rules the rest of the code assumes

- **Prices are computed per request, never stored.** The largest of the category, brand,
  product and variant offers wins. Do not cache a price client-side and assume it holds.
- **Order status is derived, not set.** It is recomputed from item statuses on every item
  update; `Partially Delivered` and `Partially Returned` are roll-ups that no individual item
  ever holds.
- **Rate limits are real and they are per-route**: auth 10/15min, OTP 5/15min, password reset
  5/hour, coupon apply 10/15min, payments 30/15min, plus a 500/15min `/api` backstop. Surface
  429s as themselves rather than as a generic error.
- Payment methods are `cod`, `card`, `upi`, `netbanking`, `paypal` and `wallet`; card, UPI and
  netbanking go through Razorpay.

---

## Frontend

Vite + React 19 + TypeScript, Tailwind for all styling, Redux Toolkit and RTK Query for state
and data fetching, React Router for routing, axios underneath.

[frontend/src/features/](frontend/src/features/) is organised by feature rather than by file
type — `catalog/`, `cart/`, `checkout/`, `orders/`, `account/`, `admin/` and so on, each
holding its pages, its `*.api.ts` endpoint definitions and its tests together. Shared
primitives (Button, Modal, Pagination, table, toast, the layouts) are in
[components/](frontend/src/components/), the router and guards in
[app/](frontend/src/app/), and pure helpers — formatting, pricing, pagination, Zod schemas —
in [lib/](frontend/src/lib/).

Every page is React, storefront and admin alike — 37 page components across 42 routes, with
no placeholders left. The primitives have a gallery at `/_gallery`, registered only when
`import.meta.env.DEV` so it costs the production bundle nothing.

---

## Testing

770 tests across the two packages, and they are the fastest way to understand either half.

```bash
cd backend  && npm test    # 281 — supertest against the Express app, mongodb-memory-server
cd frontend && npm test    # 489 — Testing Library + jsdom, MSW for the network
```

The backend suite boots a real in-memory MongoDB and drives the app through HTTP, so the
tests exercise routing, guards and validation rather than controllers in isolation. It runs
single-threaded in one forked process — Mongoose keeps connection state on the module — which
is why it takes a couple of minutes. [app.ts](backend/src/app.ts) is deliberately separate
from [server.ts](backend/src/server.ts) so supertest can import the app without opening a
database connection or binding a port.

Alongside the feature tests are a handful that pin a convention rather than a feature: no API
route may answer with a redirect; no module may mix `export =` with a named export, which
type-checks and passes Vitest but stops `tsx` from booting the server; and the four admin list
endpoints must keep returning the shapes the admin's one list component knows how to
normalise.

---

## Further reading

- [frontend/README.md](frontend/README.md) — the React rewrite in detail: status, route map,
  the full backend contract, design decisions, open items
- [frontend/docs/](frontend/docs/) — page-by-page specs for the storefront and admin, the
  component inventory, the Tailwind theme, and a running list of known defects
- [backend/docs/](backend/docs/) — how SKU-based carts work

## Deployment

The frontend is on **Vercel**, the backend on **Render**, and the browser only ever talks to
the Vercel origin — `vercel.json` rewrites `/api`, `/uploads`, `/images`, `/google` and
`/docs` through to Render. That is the same trick the Vite dev proxy plays, and it is load
bearing: the auth cookies are `SameSite=Lax`, so a browser that saw two different sites would
not send them at all, and there is no CORS middleware for it to fall back on. Point the app
straight at the Render URL and every login silently fails.

```
            ┌── /assets, /index.html ──────────────► Vercel (static)
browser ────┤
 (one       └── /api, /uploads, /images, /google ──► Vercel rewrite ──► Render ──► MongoDB
  origin)
```

### Render — the API

Render reads [render.yaml](render.yaml) from the repo root as a Blueprint, which carries the
build, the health check and the full env var list. **Name the service `lacedup-api`**; the
rewrite destinations in `frontend/vercel.json` are literal URLs, so a different name means
editing them (Vercel cannot interpolate env vars into a rewrite).

Set `MONGODB_URI` to an Atlas connection string, and allow `0.0.0.0/0` in the Atlas network
list — Render's free tier has no static outbound IPs to allowlist instead. `JWT_SECRET`,
`JWT_REFRESH_SECRET` and `SESSION_SECRET` are generated by Render; everything else is
optional and its feature stays dormant until it is filled in.

Two things in the blueprint are not decoration. The build runs `npm ci --include=dev` because
`NODE_ENV=production` is npm's signal to skip devDependencies and `typescript` is one of them.
And the health check is `/healthz` rather than `/`, because `/` is the React shell — which in
this topology is Vercel's job and simply is not on this host, so the root would 404 and read
as a failed deploy.

### Vercel — the app

Import the repo and set **Root Directory to `frontend`**. [frontend/vercel.json](frontend/vercel.json)
supplies the build, the output directory, the rewrites and the SPA fallback, so there is
nothing to configure by hand and no environment variables to set — the API base URL is the
relative `/api` and stays that way.

### After the first deploy

1. **Check the proxy depth.** `GET /healthz` through the Vercel domain echoes the IP the
   server resolved. It must be yours. If it is a datacentre address, `TRUST_PROXY` is wrong
   for the number of hops and every visitor is sharing one rate-limit bucket — the 500/15min
   `/api` backstop will then throttle the whole site at once. It is 2 for Vercel in front of
   Render; drop it to 1 if you ever point a browser straight at the API.
2. **Finish Google sign-in.** Set `GOOGLE_CALLBACK_URL` on Render to
   `https://<your-vercel-domain>/google/callback` — the public origin, not the Render one, or
   consent returns the browser to the API host and sets the login cookie on a domain the app
   is not served from. Add that same URL to the authorised redirect URIs in the Google
   console, verbatim.
3. **Expect a cold start.** Render's free tier spins the service down when idle, so the first
   request after a quiet spell takes the better part of a minute. Everything after it is
   normal speed.

## Known gaps

- **Uploads do not survive a restart.** Render's filesystem is ephemeral, and product images
  are written to `backend/public/uploads/`. The images committed to the repo ship with the
  deploy and are fine; anything an admin uploads afterwards is gone at the next deploy or
  spin-down, leaving the URL in the database pointing at nothing. Fixing it properly means a
  Render persistent disk or moving image writes to object storage — accepted as-is for now.
- `frontend/docs/defects.md` tracks the pre-existing bugs and open decisions carried over
  from the pre-React app; read it before trusting an endpoint you have not used yet.
